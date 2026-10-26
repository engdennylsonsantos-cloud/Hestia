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

  it('arco de raio 0,822 centrado em t = −0,411, da posição fechada à folha aberta a 90°', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const arc = openingPlanPaths(m, opts()).find((p) => p.role === 'swing')!;
    const leaf = m.parts.find((p) => p.role === 'leaf')!;
    const leafS = (leaf.box.s0 + leaf.box.s1) / 2;
    const center = { t: -0.411, s: leafS };
    for (const q of arc.pts) expect(Math.hypot(q.t - center.t, q.s - center.s)).toBeCloseTo(0.822, 9);
    const first = arc.pts[0]!;
    const last = arc.pts.at(-1)!;
    const fechada = { t: 0.411, s: leafS };
    const aberta = { t: -0.411, s: leafS + 0.822 };
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
  it('low: só a linha da folha fechada, sem arco', () => {
    const paths = openingPlanPaths(modelo(cena('ot_p90')), opts({ detail: 'low' }));
    expect(paths).toHaveLength(1);
    expect(paths[0]!.role).toBe('leaf');
    expect(paths[0]!.closed).toBe(false);
    expect(paths.some((p) => p.role === 'swing')).toBe(false);
    expect(largura(boxOf(paths[0]!))).toBeCloseTo(0.822, 9);
  });

  it('high: acrescenta a folha fechada (0,822 × 0,04) e o alizar/peitoril do tipo', () => {
    const c = cena('ot_p90', { casing: { width: 0.05, thickness: 0.015 } });
    const paths = openingPlanPaths(modelo(c), opts({ detail: 'high' }));
    const fechadas = folhas(paths).filter((p) => largura(boxOf(p)) > 0.8);
    expect(fechadas).toHaveLength(1);
    expect(largura(boxOf(fechadas[0]!))).toBeCloseTo(0.822, 9);
    expect(profundidade(boxOf(fechadas[0]!))).toBeCloseTo(0.04, 9);
    expect(paths.some((p) => p.role === 'casing' && p.closed)).toBe(true);
    const janela = cena('ot_j120', { sillBoard: { projection: 0.03, thickness: 0.02 } });
    expect(openingPlanPaths(modelo(janela), opts({ detail: 'high' })).some((p) => p.role === 'sillBoard')).toBe(true);
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
});
