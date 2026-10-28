import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel } from './openingModel.ts';
import { openingPlanPaths, type OpeningPlanOptions, type OpeningPlanPath } from './openingPlan.ts';
import type { OpeningModel } from './openingModelTypes.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  t: OpeningType;
}

/** Parede de 4 m com um vão no meio, como nos testes do modelo único. */
function cena(base: string, extra: Partial<OpeningType> = {}, flips: { flipHand?: boolean; flipFacing?: boolean } = {}): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'v',
      kind: t.kind,
      typeId: 'ot_x',
      hostId: 'w',
      offset: 2,
      flipHand: flips.flipHand ?? false,
      flipFacing: flips.flipFacing ?? false,
      sillOverride: null,
      mark: '',
    },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f), t: p.openingTypes.ot_x! };
}

const modelo = (c: Cena): OpeningModel => buildOpeningModel(c.p, c.o, c.g, frameOfWall(c.p, 'w')!);

const opts = (over: Partial<OpeningPlanOptions> = {}): OpeningPlanOptions => ({
  detail: 'mid',
  angle: Math.PI / 2,
  planDisplay: 'symbolic',
  showSwing: true,
  swingStyle: 'arc',
  cutZ: 1,
  ...over,
});

interface Box {
  t0: number;
  t1: number;
  s0: number;
  s1: number;
}

const boxOf = (p: OpeningPlanPath): Box => ({
  t0: Math.min(...p.pts.map((q) => q.t)),
  t1: Math.max(...p.pts.map((q) => q.t)),
  s0: Math.min(...p.pts.map((q) => q.s)),
  s1: Math.max(...p.pts.map((q) => q.s)),
});

const largura = (b: Box): number => b.t1 - b.t0;
const profundidade = (b: Box): number => b.s1 - b.s0;

/** Interseção de área entre dois retângulos alinhados (as peças da planta são retângulos). */
function areaComum(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0)) * Math.max(0, Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0));
}

const folhas = (paths: OpeningPlanPath[]): OpeningPlanPath[] => paths.filter((p) => p.role === 'leaf' && p.closed);

describe('openingPlanPaths: porta de giro ot_p90 (nível médio)', () => {
  it('a folha aberta é um retângulo de 0,822 × 0,04 na posição do modelo', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const leaf = folhas(openingPlanPaths(m, opts()));
    expect(leaf).toHaveLength(1);
    const b = boxOf(leaf[0]!);
    const lados = [largura(b), profundidade(b)].sort((x, y) => x - y);
    expect(lados[0]).toBeCloseTo(0.04, 9);
    expect(lados[1]).toBeCloseTo(0.822, 9);
    // A dobradiça fica em t = −0,411: o retângulo aberto começa nela.
    expect(Math.min(b.t0, b.t1)).toBeGreaterThanOrEqual(-0.411 - 0.04 - 1e-9);
    const part = m.parts.find((p) => p.role === 'leaf')!;
    expect(part.box.t0).toBeCloseTo(-0.411, 9);
    expect(part.box.t1).toBeCloseTo(0.411, 9);
  });

  it('ombreiras e batedores aparecem nas posições do modelo', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const paths = openingPlanPaths(m, opts());
    for (const part of m.parts.filter((p) => p.role === 'jamb' || p.role === 'stop')) {
      if (part.box.z0 > opts().cutZ || part.box.z1 < opts().cutZ) continue;
      const found = paths.find((p) => p.role === part.role && p.closed && Math.abs(boxOf(p).t0 - part.box.t0) < 1e-9 && Math.abs(boxOf(p).s0 - part.box.s0) < 1e-9);
      expect(found, part.id).toBeDefined();
    }
  });

  it('arco de raio 0,822 centrado no pivô da folha, da posição fechada à folha aberta a 90°', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const arc = openingPlanPaths(m, opts()).find((p) => p.role === 'swing')!;
    const o = m.openings[0]!;
    const center = { t: o.pivot.t, s: o.pivot.s };
    for (const q of arc.pts) expect(Math.hypot(q.t - center.t, q.s - center.s)).toBeCloseTo(0.822, 9);
    const first = arc.pts[0]!;
    const last = arc.pts.at(-1)!;
    const fechada = { t: o.latchT, s: o.pivot.s };
    const aberta = { t: o.hingeT, s: o.pivot.s + 0.822 };
    expect(Math.hypot(first.t - fechada.t, first.s - fechada.s)).toBeCloseTo(0, 9);
    expect(Math.hypot(last.t - aberta.t, last.s - aberta.s)).toBeCloseTo(0, 9);
  });

  it('flipHand espelha em t; flipFacing espelha em s', () => {
    const base = boxOf(folhas(openingPlanPaths(modelo(cena('ot_p90')), opts()))[0]!);
    const hand = boxOf(folhas(openingPlanPaths(modelo(cena('ot_p90', {}, { flipHand: true })), opts()))[0]!);
    const facing = boxOf(folhas(openingPlanPaths(modelo(cena('ot_p90', {}, { flipFacing: true })), opts()))[0]!);
    expect(hand.t0).toBeCloseTo(-base.t1, 9);
    expect(hand.t1).toBeCloseTo(-base.t0, 9);
    expect(hand.s0).toBeCloseTo(base.s0, 9);
    expect(facing.s0).toBeCloseTo(-base.s1, 9);
    expect(facing.s1).toBeCloseTo(-base.s0, 9);
    expect(facing.t0).toBeCloseTo(base.t0, 9);
  });
});

describe('openingPlanPaths: níveis low e high', () => {
  it('low: folha aberta com arco, sem a folha fechada', () => {
    const paths = openingPlanPaths(modelo(cena('ot_p90')), opts({ detail: 'low' }));
    expect(folhas(paths)).toHaveLength(1);
    expect(paths.some((p) => p.role === 'swing')).toBe(true);
    expect(largura(boxOf(folhas(paths)[0]!))).toBeLessThan(0.822);
  });

  it('high: mantém só a folha aberta e acrescenta o alizar/peitoril do tipo', () => {
    const c = cena('ot_p90', { casing: { width: 0.05, thickness: 0.015 } });
    const paths = openingPlanPaths(modelo(c), opts({ detail: 'high' }));
    expect(folhas(paths).filter((p) => largura(boxOf(p)) > 0.8)).toHaveLength(0);
    expect(paths.some((p) => p.role === 'casing' && p.closed)).toBe(true);
    const janela = cena('ot_j120', { sillBoard: { projection: 0.03, thickness: 0.02 } });
    expect(openingPlanPaths(modelo(janela), opts({ detail: 'high' })).some((p) => p.role === 'sillBoard')).toBe(true);
  });

  it('alizar no nível alto: um contorno por lado e por face, unido pelo grupo', () => {
    const c = cena('ot_p90', { casing: { width: 0.07, thickness: 0.015 } });
    const paths = openingPlanPaths(modelo(c), opts({ detail: 'high', cutZ: 1.5 }));
    const casings = paths.filter((p) => p.role === 'casing' && p.closed);
    expect(casings).toHaveLength(4);
    for (const p of casings) expect(p.pts).toHaveLength(4);
    const porFace = [casings.filter((p) => boxOf(p).s0 > 0), casings.filter((p) => boxOf(p).s1 < 0)];
    for (const face of porFace) {
      expect(face).toHaveLength(2);
      const lados = face.map((p) => boxOf(p)).sort((a, b) => a.t0 - b.t0);
      expect(lados[0]!.t1).toBeCloseTo(-0.4, 9);
      expect(lados[1]!.t0).toBeCloseTo(0.4, 9);
    }
  });

  it('em nenhum nível a folha fechada atravessa ombreira ou batedor', () => {
    for (const detail of ['low', 'mid', 'high'] as const) {
      for (const flipHand of [false, true]) {
        for (const flipFacing of [false, true]) {
          const paths = openingPlanPaths(modelo(cena('ot_p90', {}, { flipHand, flipFacing })), opts({ detail }));
          const batente = paths.filter((p) => p.closed && (p.role === 'jamb' || p.role === 'stop' || p.role === 'head'));
          // A folha fechada é o retângulo de largura cheia; no low ela é uma linha (sem área).
          for (const f of folhas(paths).filter((p) => largura(boxOf(p)) > 0.8)) {
            for (const b of batente) expect(areaComum(boxOf(f), boxOf(b)), `${detail} ${f.role}`).toBeCloseTo(0, 12);
          }
        }
      }
    }
  });

  it('folhas de giro: nenhuma folha fechada em low/mid/high/projected; só a aberta e o arco no pivô', () => {
    for (const base of ['ot_p90', 'ot_p160', 'ot_pp80', 'ot_pvv90']) {
      const c = cena(base);
      const m = modelo(c);
      for (const detail of ['low', 'mid', 'high'] as const) {
        for (const planDisplay of ['symbolic', 'projected'] as const) {
          const paths = openingPlanPaths(m, opts({ detail, planDisplay, angle: Math.PI / 2 }));
          const caso = `${base} ${detail} ${planDisplay}`;
          const abertas = folhas(paths);
          expect(abertas.length, caso).toBeGreaterThanOrEqual(m.openings.length);
          for (const p of abertas) {
            // A folha fechada teria comprimento da folha em `t`; a aberta a 90° tem só a espessura.
            const b = boxOf(p);
            expect(largura(b), `${caso} folha fechada`).toBeLessThan(0.1);
          }
          const arcos = paths.filter((p) => p.role === 'swing');
          expect(arcos.length, caso).toBeGreaterThanOrEqual(m.openings.length);
          for (const a of arcos) {
            const noPivo = m.openings.some((o) => {
              const raios = a.pts.map((q) => Math.hypot(q.t - o.pivot.t, q.s - o.pivot.s));
              return Math.max(...raios) - Math.min(...raios) < 1e-7;
            });
            expect(noPivo, `${caso} arco no pivô`).toBe(true);
          }
          // Arco do giro lateral termina na posição fechada e a folha aberta fica a `radius` do pivô.
          for (const o of m.openings.filter((x) => x.kind === 'side')) {
            const arco = arcos.find((a) => Math.abs(a.pts[0]!.t - o.latchT) < 1e-9 && Math.abs(a.pts[0]!.s - o.pivot.s) < 1e-9)!;
            expect(arco, `${caso} arco do trinco`).toBeDefined();
            const fim = arco.pts.at(-1)!;
            expect(Math.hypot(fim.t - o.pivot.t, fim.s - o.pivot.s), `${caso} raio`).toBeCloseTo(o.radius, 9);
          }
        }
      }
    }
  });

  it('angle2d = 45° muda o arco e a folha aberta', () => {
    const m = modelo(cena('ot_p90'));
    const a = openingPlanPaths(m, opts());
    const b = openingPlanPaths(m, opts({ angle: Math.PI / 4 }));
    const arcA = a.find((p) => p.role === 'swing')!;
    const arcB = b.find((p) => p.role === 'swing')!;
    expect(arcA.pts.at(-1)).not.toEqual(arcB.pts.at(-1));
    expect(boxOf(folhas(a)[0]!)).not.toEqual(boxOf(folhas(b)[0]!));
  });

  it('showSwing = false remove o arco; swingStyle dash o deixa tracejado', () => {
    const m = modelo(cena('ot_p90'));
    expect(openingPlanPaths(m, opts({ showSwing: false })).some((p) => p.role === 'swing')).toBe(false);
    const dash = openingPlanPaths(m, opts({ swingStyle: 'dash' })).find((p) => p.role === 'swing')!;
    expect(dash.dash).toEqual([4, 3]);
    const line = openingPlanPaths(m, opts({ swingStyle: 'line' })).find((p) => p.role === 'swing')!;
    expect(line.pts).toHaveLength(2);
  });
});

describe('openingPlanPaths: janelas', () => {
  it('correr 2 folhas: duas folhas em pistas distintas e seta', () => {
    const paths = openingPlanPaths(modelo(cena('ot_j120')), opts());
    const leaves = folhas(paths);
    expect(leaves).toHaveLength(2);
    const centros = leaves.map((p) => (boxOf(p).s0 + boxOf(p).s1) / 2);
    expect(Math.abs(centros[0]! - centros[1]!)).toBeGreaterThan(0.02);
    expect(paths.some((p) => p.role === 'arrow')).toBe(true);
    expect(paths.some((p) => p.role === 'track')).toBe(true);
  });

  it('fixa: três linhas do caixilho e o vidro', () => {
    const paths = openingPlanPaths(modelo(cena('ot_jfixa60')), opts());
    const linhas = paths.filter((p) => !p.closed && (p.role === 'jamb' || p.role === 'glass'));
    expect(linhas).toHaveLength(3);
    for (const l of linhas) expect(largura(boxOf(l))).toBeCloseTo(0.6, 9);
    const alto = openingPlanPaths(modelo(cena('ot_jfixa60')), opts({ detail: 'high' }));
    expect(alto.filter((p) => !p.closed && p.role === 'glass').length).toBeGreaterThanOrEqual(3);
  });

  it('maxim-ar: arco tracejado do lado de flipFacing', () => {
    for (const flipFacing of [false, true]) {
      const paths = openingPlanPaths(modelo(cena('ot_j60', {}, { flipFacing })), opts());
      const arc = paths.find((p) => p.role === 'swing')!;
      expect(arc.dash).toEqual([4, 3]);
      for (const q of arc.pts) {
        if (flipFacing) expect(q.s).toBeLessThanOrEqual(1e-9);
        else expect(q.s).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it('basculante: linha inclinada em torno do centro, sem arco, mais as três linhas do caixilho', () => {
    const c = cena('ot_j60', { plan: 'tilt' });
    const angle = (30 * Math.PI) / 180;
    const paths = openingPlanPaths(modelo(c), opts({ angle }));
    expect(paths.some((p) => p.role === 'swing')).toBe(false);
    expect(paths.filter((p) => !p.closed && (p.role === 'jamb' || p.role === 'glass'))).toHaveLength(3);
    const linha = paths.find((p) => p.role === 'leaf' && !p.closed)!;
    expect(linha).toBeDefined();
    const [a, b] = linha.pts;
    const centro = { t: (a!.t + b!.t) / 2, s: (a!.s + b!.s) / 2 };
    expect(centro.t).toBeCloseTo(0, 9);
    const inclinacao = Math.atan2(Math.abs(b!.s - a!.s), Math.abs(b!.t - a!.t));
    expect(inclinacao).toBeCloseTo(angle, 9);
    for (const detail of ['mid', 'high'] as const) {
      const p = openingPlanPaths(modelo(c), opts({ detail, angle }));
      expect(p.some((x) => x.role === 'swing'), detail).toBe(false);
    }
  });
});

describe('openingPlanPaths: portas novas (spec E §3.5)', () => {
  it('vai-e-vem: dois arcos (principal contínuo, o outro tracejado) e a folha aberta dos dois lados', () => {
    for (const flips of [
      { flipHand: false, flipFacing: false },
      { flipHand: true, flipFacing: true },
    ]) {
      const paths = openingPlanPaths(modelo(cena('ot_pvv90', {}, flips)), opts({ detail: 'mid' }));
      const arcos = paths.filter((p) => p.role === 'swing');
      expect(arcos).toHaveLength(2);
      expect(arcos.filter((p) => p.dash?.[0] === 4)).toHaveLength(1);
      const folhasAbertas = folhas(paths);
      expect(folhasAbertas).toHaveLength(2);
      expect(Math.sign(boxOf(folhasAbertas[0]!).s0 - boxOf(folhasAbertas[1]!).s0)).not.toBe(0);
      const alto = openingPlanPaths(modelo(cena('ot_pvv90', {}, flips)), opts({ detail: 'high' }));
      expect(folhas(alto)).toHaveLength(2);
    }
  });

  it('embutir: folha fechada, cavidade tracejada e seta para a cavidade', () => {
    for (const flips of [
      { flipHand: false, flipFacing: false },
      { flipHand: true, flipFacing: false },
    ]) {
      const paths = openingPlanPaths(modelo(cena('ot_pe80', {}, flips)), opts({ detail: 'mid' }));
      expect(paths.some((p) => p.role === 'leaf' && p.closed)).toBe(true);
      const pocket = paths.find((p) => p.role === 'pocket' && p.closed)!;
      expect(pocket).toBeDefined();
      expect(pocket.dash).toEqual([6, 3]);
      const seta = paths.find((p) => p.role === 'arrow')!;
      expect(seta).toBeDefined();
      const b = boxOf(pocket);
      expect(Math.abs(b.t1 - b.t0)).toBeGreaterThan(0.5);
      const alto = openingPlanPaths(modelo(cena('ot_pe80', {}, flips)), opts({ detail: 'high' }));
      expect(alto.some((p) => p.role === 'pocket' && p.closed)).toBe(true);
    }
  });

  it('dobrável e sanfonada: zigue-zague com o número certo de segmentos', () => {
    for (const [base, leaves, esperado] of [
      ['ot_pd120', 2, 2],
      ['ot_pd120', 4, 4],
      ['ot_ps90', 1, 9],
    ] as const) {
      const c = cena(base, leaves === 4 ? { leaves: 4 } : {});
      const paths = openingPlanPaths(modelo(c), opts({ detail: 'mid' }));
      const paineis = folhas(paths);
      expect(paineis, `${base} ${leaves}`).toHaveLength(esperado);
      for (const p of paineis) {
        const b = boxOf(p);
        expect(largura(b) + profundidade(b)).toBeGreaterThan(0.01);
      }
      const alto = openingPlanPaths(modelo(c), opts({ detail: 'high' }));
      expect(folhas(alto).length).toBeGreaterThanOrEqual(esperado * 2);
    }
  });

  it('seccionada: linha da folha fechada e retângulo tracejado do painel recolhido para o lado de abertura', () => {
    for (const flipFacing of [false, true]) {
      const paths = openingPlanPaths(modelo(cena('ot_pg300', {}, { flipFacing })), opts({ detail: 'mid' }));
      const linhas = paths.filter((p) => p.role === 'leaf' && !p.closed);
      expect(linhas).toHaveLength(1);
      const recolhido = paths.find((p) => p.role === 'leaf' && p.closed && p.dash?.[0] === 6)!;
      expect(recolhido).toBeDefined();
      const b = boxOf(recolhido);
      expect(profundidade(b)).toBeCloseTo(Math.min(2.2, 2.5), 9);
      const side = flipFacing ? -1 : 1;
      expect(Math.sign((b.s0 + b.s1) / 2)).toBe(side);
      expect(paths.some((p) => p.role === 'track' && p.dash?.[0] === 4)).toBe(true);
      const alto = openingPlanPaths(modelo(cena('ot_pg300', {}, { flipFacing })), opts({ detail: 'high' }));
      expect(alto.filter((p) => p.role === 'leaf' && p.closed).length).toBeGreaterThanOrEqual(5);
    }
  });
});
