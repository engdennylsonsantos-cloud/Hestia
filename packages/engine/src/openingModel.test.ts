import { describe, expect, it } from 'vitest';
import { intersection, multiArea } from '@hestia/geom';
import { createEmptyProject, makeWall, openingAngle3d, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel, partTransformed, projectParts, slicePartsAtZ } from './openingModel.ts';
import { CLOSED, type OpeningPart, type PartBox } from './openingModelTypes.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  t: OpeningType;
}

/** Parede de 4 m com um vão no meio, como nos testes do 3D. */
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

const modelo = (c: Cena) => buildOpeningModel(c.p, c.o, c.g, frameOfWall(c.p, 'w')!);
const de = (parts: OpeningPart[], role: OpeningPart['role']) => parts.filter((x) => x.role === role);
const folha = (parts: OpeningPart[]) => parts.find((x) => x.role === 'leaf')!;
const largura = (b: PartBox) => b.t1 - b.t0;
const altura = (b: PartBox) => b.z1 - b.z0;

const multi = (ring: Array<{ t: number; s: number }>): Array<Array<Array<{ x: number; y: number }>>> => [
  [ring.map((p) => ({ x: p.t, y: p.s }))],
];

/** As duas peças se cruzam em algum z (perfil do batente considerado); amostra a faixa de z comum. */
function temIntersecao(m: ReturnType<typeof modelo>, a: OpeningPart, b: OpeningPart, state = CLOSED): boolean {
  const z0 = Math.max(a.box.z0, b.box.z0);
  const z1 = Math.min(a.box.z1, b.box.z1);
  if (z1 - z0 <= 1e-9) return false;
  const passos = Math.max(2, Math.min(80, Math.ceil((z1 - z0) / 0.01)));
  const corte = state === CLOSED ? (z: number) => slicePartsAtZ(m, z, CLOSED) : (z: number) => slicePartsAtZ(m, z, state);
  for (let i = 0; i <= passos; i++) {
    const z = z0 + ((z1 - z0) * i) / passos;
    const rings = corte(z);
    const ra = rings.find((x) => x.part.id === a.id)?.ring;
    const rb = rings.find((x) => x.part.id === b.id)?.ring;
    if (ra && rb && multiArea(intersection(multi(ra), multi(rb))) > 1e-7) return true;
  }
  return false;
}

/** Colisão de área entre dois grupos de peças em cotas representativas (ombreira e travessa), com perfil e movimento. */
function colide(
  m: ReturnType<typeof modelo>,
  aIds: ReadonlySet<string>,
  bIds: ReadonlySet<string>,
  state: { angle: number; slide: number },
): boolean {
  const zs = [1.5, m.height - 0.05 + 0.005];
  for (const z of zs) {
    const corte = slicePartsAtZ(m, z, state);
    const a = corte.filter((x) => aIds.has(x.part.id));
    const b = corte.filter((x) => bIds.has(x.part.id));
    for (const ra of a) {
      for (const rb of b) {
        if (multiArea(intersection(multi(ra.ring), multi(rb.ring))) > 1e-7) return true;
      }
    }
  }
  return false;
}

const ids = (parts: OpeningPart[], filtro: (p: OpeningPart) => boolean): Set<string> => new Set(parts.filter(filtro).map((p) => p.id));

describe('buildOpeningModel: porta de giro padrão ot_p90', () => {
  it('medidas exatas da folha, altura e dobradiça nas quatro combinações', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const f = folha(m.parts);
    expect(largura(f.box)).toBeCloseTo(2 * 0.411, 9);
    expect(f.box.t0).toBeCloseTo(-0.411, 9);
    expect(f.box.t1).toBeCloseTo(0.411, 9);
    expect(f.box.z0).toBeCloseTo(0.008, 9);
    expect(f.box.z1).toBeCloseTo(2.061, 9);
    expect(f.box.s1 - f.box.s0).toBeCloseTo(0.04, 9);

    for (const flipHand of [false, true]) {
      const ch = cena('ot_p90', {}, { flipHand });
      const abertura = modelo(ch).openings[0]!;
      expect(abertura.kind).toBe('side');
      expect(abertura.hingeT).toBeCloseTo(flipHand ? 0.411 : -0.411, 9);
      expect(abertura.latchT).toBeCloseTo(flipHand ? -0.411 : 0.411, 9);
      expect(abertura.radius).toBeCloseTo(2 * 0.411, 9);
      const hf = folha(modelo(ch).parts);
      const motion = hf.motion;
      if (!motion || motion.kind !== 'rotate' || motion.axis !== 'z') throw new Error('folha sem giro em z');
      expect(motion.t).toBeCloseTo(flipHand ? 0.411 : -0.411, 9);
    }
  });

  it('flipFacing troca o lado s da folha e da abertura', () => {
    const c1 = cena('ot_p90', {}, { flipFacing: false });
    const c2 = cena('ot_p90', {}, { flipFacing: true });
    const f1 = folha(modelo(c1).parts);
    const f2 = folha(modelo(c2).parts);
    expect(Math.sign((f1.box.s0 + f1.box.s1) / 2)).toBe(1);
    expect(Math.sign((f2.box.s0 + f2.box.s1) / 2)).toBe(-1);
    expect(modelo(c1).openings[0]!.side).toBe(1);
    expect(modelo(c2).openings[0]!.side).toBe(-1);
  });

  it('a folha fechada não tem volume em comum com ombreira ou travessa (perfil em L)', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const m = modelo(cena('ot_p90', {}, { flipHand, flipFacing }));
        const f = folha(m.parts);
        for (const p of m.parts) {
          if (p.role !== 'jamb' && p.role !== 'head') continue;
          expect(temIntersecao(m, f, p), `${p.id} hand=${flipHand} facing=${flipFacing}`).toBe(false);
        }
      }
    }
  });

  it('a folha fica dentro do vão em t e z', () => {
    const c = cena('ot_p90');
    const f = folha(modelo(c).parts);
    expect(f.box.t0).toBeGreaterThanOrEqual(-c.g.width / 2 - 1e-9);
    expect(f.box.t1).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
    expect(f.box.z0).toBeGreaterThanOrEqual(0);
    expect(f.box.z1).toBeLessThanOrEqual(c.g.height + 1e-9);
  });

  it('peças de batente ficam dentro da parede e do vão (padrão frameDepthMode core)', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_p90', {}, { flipHand, flipFacing });
        const m = modelo(c);
        expect(m.core.s1 - m.core.s0).toBeCloseTo(0.14, 9);
        expect(m.thickness).toBeCloseTo(0.184, 9);
        for (const p of m.parts.filter((x) => x.role === 'jamb' || x.role === 'stop' || x.role === 'head')) {
          expect(p.box.s0, p.id).toBeGreaterThanOrEqual(-m.thickness / 2 - 1e-9);
          expect(p.box.s1, p.id).toBeLessThanOrEqual(m.thickness / 2 + 1e-9);
          expect(Math.abs(p.box.t0), p.id).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
          expect(Math.abs(p.box.t1), p.id).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
          expect(p.box.z0, p.id).toBeGreaterThanOrEqual(0);
          expect(p.box.z1, p.id).toBeLessThanOrEqual(c.g.height + 1e-9);
        }
      }
    }
  });

  it('ids únicos e determinismo (comparação profunda)', () => {
    const c = cena('ot_p90');
    const a = modelo(c);
    const b = modelo(c);
    expect(a).toEqual(b);
    expect(new Set(a.parts.map((x) => x.id)).size).toBe(a.parts.length);
  });
});

describe('buildOpeningModel: estilos de batente da porta de giro', () => {
  it('simple: caixa única J×D, sem batedor; folha centrada em s', () => {
    const c = cena('ot_p90', { frameStyle: 'simple' });
    const m = modelo(c);
    expect(de(m.parts, 'stop')).toHaveLength(0);
    expect(de(m.parts, 'jamb')).toHaveLength(2);
    expect(de(m.parts, 'head')).toHaveLength(1);
    const f = folha(m.parts);
    expect((f.box.s0 + f.box.s1) / 2).toBeCloseTo(0, 9);
    expect(f.box.z1).toBeCloseTo(c.g.height - 0.05 - 0.004, 9);
  });

  it('aduela: batente de 0,03 m de largura, profundidade do núcleo inteiro e uma peça em L', () => {
    const c = cena('ot_p90', { frameStyle: 'aduela' });
    const m = modelo(c);
    const jamb = de(m.parts, 'jamb')[0]!;
    expect(jamb.box.t1 - jamb.box.t0).toBeCloseTo(0.03, 9);
    expect(jamb.box.s1 - jamb.box.s0).toBeCloseTo(0.14, 9);
    expect(de(m.parts, 'stop')).toHaveLength(0);
    expect(jamb.profile?.pts).toHaveLength(6);
  });

  it('block: sem batente, folha ocupa |t| ≤ hw − gap e articula em ±(hw − gap)', () => {
    const c = cena('ot_p90', { frameStyle: 'block' });
    const m = modelo(c);
    expect(m.parts.filter((x) => x.role === 'jamb' || x.role === 'stop' || x.role === 'head')).toHaveLength(0);
    const f = folha(m.parts);
    expect(f.box.t0).toBeCloseTo(-(c.g.width / 2 - 0.004), 9);
    expect(f.box.t1).toBeCloseTo(c.g.width / 2 - 0.004, 9);
    expect(m.openings[0]!.hingeT).toBeCloseTo(-(c.g.width / 2 - 0.004), 9);
  });
});

describe('buildOpeningModel: porta dupla, pivotante, correr e vão livre', () => {
  it('dupla: duas folhas de lh − 0,002, dobradiças em ±lh e dois itens de abertura', () => {
    const c = cena('ot_p160');
    const m = modelo(c);
    const folhas = de(m.parts, 'leaf');
    expect(folhas).toHaveLength(2);
    for (const f of folhas) expect(largura(f.box)).toBeCloseTo(0.761 - 0.002, 9);
    expect(m.openings).toHaveLength(2);
    expect(m.openings.map((x) => x.hingeT).sort((a, b) => a - b)).toEqual([-0.761, 0.761]);
    expect(m.openings.every((x) => x.kind === 'side' && x.side === 1)).toBe(true);
  });

  it('pivotante: folha inteira, eixo a W/4 da ombreira da dobradiça e raio 3·hw/2', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_pp80', {}, { flipHand, flipFacing });
        const m = modelo(c);
        const f = folha(m.parts);
        expect(largura(f.box)).toBeCloseTo(2 * (c.g.width / 2 - 0.05 - (0.04 / 2 + 0.004)), 9);
        const a = m.openings[0]!;
        expect(a.kind).toBe('pivot');
        expect(a.hingeT).toBeCloseTo((flipHand ? 1 : -1) * (c.g.width / 4), 9);
        expect(a.radius).toBeCloseTo((3 * c.g.width) / 4, 9);
        expect(a.side).toBe(flipFacing ? -1 : 1);
      }
    }
  });

  it('correr: batente sem batedor, dois trilhos, duas folhas em pistas opostas e uma móvel', () => {
    const c = cena('ot_pc160');
    const m = modelo(c);
    expect(de(m.parts, 'stop')).toHaveLength(0);
    expect(de(m.parts, 'track')).toHaveLength(2);
    const folhas = de(m.parts, 'leaf');
    expect(folhas).toHaveLength(2);
    for (const f of folhas) {
      expect(largura(f.box)).toBeCloseTo(0.78, 9);
      expect(f.box.s1 - f.box.s0).toBeCloseTo(0.04, 9);
    }
    expect(Math.abs(folhas[0]!.box.s0 - folhas[1]!.box.s0)).toBeGreaterThan(0.02);
    const movel = folhas.find((f) => f.motion?.kind === 'slide' && (f.motion.dt !== 0 || f.motion.travel > 0));
    if (!movel || movel.motion?.kind !== 'slide') throw new Error('sem folha móvel');
    expect(Math.abs(movel.motion.dt)).toBe(1);
    expect(movel.motion.travel).toBeCloseTo(0.72, 9);
  });

  it('vão livre: void = true e nenhuma peça de batente, folha ou vidro', () => {
    const c = cena('ot_vao90');
    const m = modelo(c);
    expect(m.void).toBe(true);
    expect(m.parts.some((x) => x.role === 'jamb' || x.role === 'stop' || x.role === 'head' || x.role === 'leaf' || x.role === 'glass')).toBe(false);
    expect(m.openings).toHaveLength(0);
  });
});

describe('buildOpeningModel: janelas', () => {
  it('fixa: caixilho, vidro no vão interno e item kind fixed', () => {
    const c = cena('ot_jfixa60');
    const m = modelo(c);
    expect(de(m.parts, 'jamb')).toHaveLength(2);
    expect(de(m.parts, 'head')).toHaveLength(1);
    expect(de(m.parts, 'sillFrame')).toHaveLength(1);
    expect(de(m.parts, 'glass')).toHaveLength(1);
    expect(de(m.parts, 'leaf')).toHaveLength(0);
    const g = de(m.parts, 'glass')[0]!;
    expect(largura(g.box)).toBeCloseTo(0.5, 9);
    expect(g.box.z0).toBeCloseTo(0.05, 9);
    expect(g.box.z1).toBeCloseTo(0.55, 9);
    expect(m.openings[0]!.kind).toBe('fixed');
  });

  it('maxim-ar: moldura de folha com vidro, eixo no topo e kind top', () => {
    const c = cena('ot_j60');
    const m = modelo(c);
    expect(de(m.parts, 'leaf')).toHaveLength(4);
    expect(de(m.parts, 'glass')).toHaveLength(1);
    const a = m.openings[0]!;
    expect(a.kind).toBe('top');
    const folha = de(m.parts, 'leaf')[0]!;
    const motion = folha.motion;
    if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('maxim-ar sem giro em t');
    expect(motion.z).toBeCloseTo(c.g.height - 0.05, 9);
    expect(motion.s).toBeCloseTo(0, 9);
    expect(motion.sign).toBe(1);
  });

  it('basculante: eixo horizontal central, kind tilt e metade superior para o lado de abertura', () => {
    const c = cena('ot_j60', { plan: 'tilt' });
    const m = modelo(c);
    const a = m.openings[0]!;
    expect(a.kind).toBe('tilt');
    expect(a.axisZ).toBeCloseTo(0.05 + 0.5 * (c.g.height - 0.1), 9);
    const motion = de(m.parts, 'leaf')[0]!.motion;
    if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('basculante sem giro em t');
    expect(motion.z).toBeCloseTo(a.axisZ!, 9);
    expect(motion.sign).toBe(-1);
  });

  it('correr 2 e 3 folhas: folhas em pistas defasadas, trilhos e itens de correr', () => {
    for (const [id, n] of [
      ['ot_j120', 2],
      ['ot_j240', 3],
    ] as const) {
      const c = cena(id);
      const m = modelo(c);
      expect(de(m.parts, 'glass'), id).toHaveLength(n);
      expect(de(m.parts, 'leaf'), id).toHaveLength(4 * n);
      expect(de(m.parts, 'track'), id).toHaveLength(2);
      expect(m.openings.filter((x) => x.kind === 'slide'), id).toHaveLength(n);
      const vidros = de(m.parts, 'glass');
      const sCenters = vidros.map((x) => (x.box.s0 + x.box.s1) / 2);
      expect(new Set(sCenters.map((x) => Math.round(x * 1000))).size, id).toBe(n);
    }
  });

  it('vão livre de janela: só a soleira, sem batente, folha ou vidro', () => {
    const c = cena('ot_jv120');
    const m = modelo(c);
    expect(m.void).toBe(true);
    expect(de(m.parts, 'sillFrame')).toHaveLength(1);
    expect(m.parts.some((x) => x.role === 'jamb' || x.role === 'head' || x.role === 'leaf' || x.role === 'glass')).toBe(false);
    expect(m.openings).toHaveLength(0);
  });
});

describe('buildOpeningModel: detalhes (estilo, maçaneta, grade, bandeiras, alizar, peitoril e vergas)', () => {
  it('leafStyle panel: quatro almofadas em relevo de 0,006 nas duas faces', () => {
    const c = cena('ot_p90', { leafStyle: 'panel' });
    const m = modelo(c);
    const paineis = de(m.parts, 'leafPanel');
    expect(paineis).toHaveLength(4);
    const f = folha(m.parts);
    for (const p of paineis) {
      expect(p.box.s0).toBeCloseTo(f.box.s0 - 0.006, 9);
      expect(p.box.s1).toBeCloseTo(f.box.s1 + 0.006, 9);
    }
  });

  it('maçaneta lever padrão da porta de giro: roseta e haste nas duas faces', () => {
    const m = modelo(cena('ot_p90'));
    const handles = de(m.parts, 'handle');
    expect(handles).toHaveLength(4);
    expect(handles.every((x) => x.leaf === 0 && x.motion)).toBe(true);
    const rosetas = handles.filter((x) => x.id.includes('rosette'));
    expect(rosetas).toHaveLength(2);
    for (const r of rosetas) {
      expect(r.box.s1 - r.box.s0).toBeCloseTo(0.012, 9);
      expect(r.box.t1 - r.box.t0).toBeCloseTo(0.05, 9);
      expect(Math.abs((r.box.z0 + r.box.z1) / 2 - 1)).toBeLessThan(1e-9);
    }
  });

  it('maçaneta knob e pull respeitam a forma e o lado', () => {
    const knob = modelo(cena('ot_p90', { handle: 'knob' }));
    expect(de(knob.parts, 'handle')).toHaveLength(2);
    for (const k of de(knob.parts, 'handle')) expect(k.box.t1 - k.box.t0).toBeCloseTo(0.05, 9);
    const pull = modelo(cena('ot_p90', { handle: 'pull' }));
    const barra = de(pull.parts, 'handle')[0]!;
    expect(barra.box.z1 - barra.box.z0).toBeCloseTo(0.4, 9);
    expect(barra.box.s0).toBeGreaterThan(0);
  });

  it('grid 2×2 na janela fixa: um montante vertical e um horizontal', () => {
    const c = cena('ot_jfixa60', { grid: { cols: 2, rows: 2 } });
    const m = modelo(c);
    const muntins = de(m.parts, 'muntin');
    expect(muntins).toHaveLength(2);
    const vertical = muntins.find((x) => x.box.t1 - x.box.t0 < x.box.z1 - x.box.z0)!;
    const horizontal = muntins.find((x) => x.box.z1 - x.box.z0 < x.box.t1 - x.box.t0)!;
    expect(vertical).toBeDefined();
    expect(horizontal).toBeDefined();
  });

  it('bandeira superior: travessa e vidro fixo acima; a folha desce e não gera item', () => {
    const c = cena('ot_p90', { transom: { height: 0.3 } });
    const m = modelo(c);
    const barra = m.parts.find((x) => x.id === 'transom-bar')!;
    const vidro = m.parts.find((x) => x.id === 'transom-glass')!;
    expect(barra).toBeDefined();
    expect(vidro).toBeDefined();
    expect(vidro.box.z1).toBeCloseTo(c.g.height - 0.05, 9);
    expect(barra.box.z0).toBeCloseTo(c.g.height - 0.05 - 0.3 - 0.04, 9);
    expect(folha(m.parts).box.z1).toBeLessThan(barra.box.z0);
    expect(m.openings).toHaveLength(1);
  });

  it('bandeiras laterais: vidro fixo e montante de 0,04; a folha diminui e não gera item', () => {
    const base = modelo(cena('ot_p90'));
    const c = cena('ot_p90', { sidelights: { left: true, right: true, width: 0.2 } });
    const m = modelo(c);
    expect(m.parts.filter((x) => x.id.startsWith('sidelight-glass'))).toHaveLength(2);
    const mullions = m.parts.filter((x) => x.id.startsWith('sidelight-mullion'));
    expect(mullions).toHaveLength(2);
    for (const x of mullions) expect(x.box.t1 - x.box.t0).toBeCloseTo(0.04, 9);
    expect(largura(folha(m.parts).box)).toBeLessThan(largura(folha(base.parts).box));
    expect(m.openings).toHaveLength(1);
  });

  it('alizar: 3 peças por face na porta e 4 na janela, sobre a face acabada', () => {
    const porta = modelo(cena('ot_p90', { casing: { width: 0.07, thickness: 0.015 } }));
    expect(de(porta.parts, 'casing')).toHaveLength(6);
    const janela = modelo(cena('ot_j120', { casing: { width: 0.07, thickness: 0.015 } }));
    expect(de(janela.parts, 'casing')).toHaveLength(8);
    for (const x of de(janela.parts, 'casing')) {
      expect(Math.min(Math.abs(x.box.s0), Math.abs(x.box.s1))).toBeGreaterThanOrEqual(0.184 / 2 - 1e-9);
      expect(Math.max(Math.abs(x.box.s0), Math.abs(x.box.s1))).toBeCloseTo(0.184 / 2 + 0.015, 9);
    }
  });

  it('alizar: borda interna na face do batente, grupo por face e nenhum volume com parede/batente', () => {
    const c = cena('ot_p90', { casing: { width: 0.07, thickness: 0.015 } });
    const m = modelo(c);
    const casing = de(m.parts, 'casing');
    const grupos = new Map<string, number>();
    for (const p of casing) {
      expect(p.group, p.id).toBeDefined();
      grupos.set(p.group!, (grupos.get(p.group!) ?? 0) + 1);
      // Fora da parede (face acabada) e sem invadir o batente (que termina em T/2).
      expect(Math.min(Math.abs(p.box.s0), Math.abs(p.box.s1))).toBeGreaterThanOrEqual(m.thickness / 2 - 1e-9);
      for (const b of m.parts.filter((x) => x.role === 'jamb' || x.role === 'head')) {
        expect(temIntersecao(m, p, b), `${p.id} × ${b.id}`).toBe(false);
      }
    }
    expect([...grupos.values()].sort()).toEqual([3, 3]);
    const lateral = casing.find((p) => p.id.startsWith('casing-left'))!;
    expect(Math.max(Math.abs(lateral.box.t0), Math.abs(lateral.box.t1))).toBeCloseTo(0.4 + 0.07, 9);
    expect(Math.min(Math.abs(lateral.box.t0), Math.abs(lateral.box.t1))).toBeCloseTo(0.4, 9);
  });

  it('alizar sides swing/opposite: só a face pedida', () => {
    const swing = modelo(cena('ot_p90', { casing: { width: 0.07, thickness: 0.015, sides: 'swing' } }));
    expect(de(swing.parts, 'casing')).toHaveLength(3);
    for (const p of de(swing.parts, 'casing')) expect((p.box.s0 + p.box.s1) / 2).toBeGreaterThan(0);
    const opposite = modelo(cena('ot_p90', { casing: { width: 0.07, thickness: 0.015, sides: 'opposite' } }));
    expect(de(opposite.parts, 'casing')).toHaveLength(3);
    for (const p of de(opposite.parts, 'casing')) expect((p.box.s0 + p.box.s1) / 2).toBeLessThan(0);
  });

  it('peitoril saliente só em janela: projeta além das duas faces', () => {
    const m = modelo(cena('ot_j120', { sillBoard: { projection: 0.03, thickness: 0.02 } }));
    const s = de(m.parts, 'sillBoard');
    expect(s).toHaveLength(1);
    expect(s[0]!.box.t1 - s[0]!.box.t0).toBeCloseTo(1.2 + 0.06, 9);
    expect(s[0]!.box.s1 - s[0]!.box.s0).toBeCloseTo(0.184 + 0.06, 9);
    expect(s[0]!.box.z0).toBeCloseTo(-0.02, 9);
    const porta = modelo(cena('ot_p90', { sillBoard: { projection: 0.03, thickness: 0.02 } }));
    expect(de(porta.parts, 'sillBoard')).toHaveLength(0);
  });

  it('verga e contraverga de concreto com transpasse, fora do vão', () => {
    const m = modelo(cena('ot_p90', { lintel: {}, sillBeam: { over: 0.2, height: 0.25 } }));
    const verga = de(m.parts, 'lintel')[0]!;
    const contra = de(m.parts, 'sillBeam')[0]!;
    expect(verga.material).toBe('concrete');
    expect(verga.box.t1 - verga.box.t0).toBeCloseTo(0.9 + 0.6, 9);
    expect(verga.box.z0).toBeCloseTo(2.1, 9);
    expect(contra.box.t1 - contra.box.t0).toBeCloseTo(0.9 + 0.4, 9);
    expect(contra.box.z1).toBeCloseTo(0, 9);
  });
});

describe('buildOpeningModel: as dez famílias nas quatro combinações', () => {
  const familias: Array<{ nome: string; base: string; extra?: Partial<OpeningType> }> = [
    { nome: 'porta de giro', base: 'ot_p90' },
    { nome: 'porta dupla', base: 'ot_p160' },
    { nome: 'porta de correr', base: 'ot_pc160' },
    { nome: 'porta pivotante', base: 'ot_pp80' },
    { nome: 'vão de porta', base: 'ot_vao90' },
    { nome: 'janela fixa', base: 'ot_jfixa60' },
    { nome: 'janela basculante', base: 'ot_j60', extra: { plan: 'tilt' } },
    { nome: 'janela maxim-ar', base: 'ot_j60' },
    { nome: 'janela de correr 2', base: 'ot_j120' },
    { nome: 'janela de correr 3', base: 'ot_j240' },
    { nome: 'vão de janela', base: 'ot_jv120' },
  ];

  it('ids únicos e estáveis, caixas válidas e nada fora do vão exceto os acabamentos', () => {
    const permitidosFora = new Set<OpeningPart['role']>(['casing', 'sillBoard', 'lintel', 'sillBeam']);
    const deBatente = new Set<OpeningPart['role']>(['jamb', 'stop', 'head', 'sillFrame', 'track']);
    for (const familia of familias) {
      for (const flipHand of [false, true]) {
        for (const flipFacing of [false, true]) {
          const c = cena(familia.base, familia.extra ?? {}, { flipHand, flipFacing });
          const m = modelo(c);
          const caso = `${familia.nome} hand=${flipHand} facing=${flipFacing}`;
          expect(new Set(m.parts.map((x) => x.id)).size, caso).toBe(m.parts.length);
          expect(m.parts.map((x) => x.id)).toEqual(modelo(c).parts.map((x) => x.id));
          expect(m, caso).toEqual(modelo(c));
          const batente = m.parts.filter((x) => x.role === 'jamb' || x.role === 'head');
          for (const folhaPart of m.parts.filter((x) => x.role === 'leaf')) {
            for (const b of batente) expect(temIntersecao(m, folhaPart, b), `${caso} ${folhaPart.id} × ${b.id}`).toBe(false);
          }
          for (const p of m.parts) {
            expect(p.box.t1 - p.box.t0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            expect(p.box.s1 - p.box.s0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            expect(p.box.z1 - p.box.z0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            if (!permitidosFora.has(p.role)) {
              expect(Math.abs(p.box.t0), `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
              expect(Math.abs(p.box.t1), `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
              expect(p.box.z0, `${caso} ${p.id}`).toBeGreaterThanOrEqual(-1e-9);
              expect(p.box.z1, `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.height + 1e-9);
            }
            if (deBatente.has(p.role)) {
              expect(p.box.s0, `${caso} ${p.id}`).toBeGreaterThanOrEqual(-m.thickness / 2 - 1e-9);
              expect(p.box.s1, `${caso} ${p.id}`).toBeLessThanOrEqual(m.thickness / 2 + 1e-9);
            }
          }
        }
      }
    }
  });
});

describe('partTransformed, slicePartsAtZ e projectParts', () => {
  it('folha de giro a π/2: centro vai para o lado side, a dobradiça fica e o comprimento se mantém', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_p90', {}, { flipHand, flipFacing });
        const f = folha(modelo(c).parts);
        const motion = f.motion;
        if (!motion || motion.kind !== 'rotate' || motion.axis !== 'z') throw new Error('folha sem giro em z');
        const ob = partTransformed(f, { angle: Math.PI / 2, slide: 0 });
        const caso = `hand=${flipHand} facing=${flipFacing}`;
        expect(Math.sign(ob.center.s - motion.s), caso).toBe(flipFacing ? -1 : 1);
        expect(Math.abs(ob.center.s - motion.s), caso).toBeCloseTo((f.box.t1 - f.box.t0) / 2, 9);
        const base = ob.corners.slice(0, 4);
        // O canto da face de articulação fica no eixo; o canto oposto descreve o comprimento da folha.
        const d = (p: { t: number; s: number }): number => Math.hypot(p.t - motion.t, p.s - motion.s);
        const hinge = base.reduce((a, b) => (d(a) <= d(b) ? a : b));
        expect(d(hinge), caso).toBeCloseTo(0, 9);
        expect(hinge.z, caso).toBeCloseTo(f.box.z0, 9);
        const arestas: Array<[number, number]> = [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0],
        ];
        const lados = arestas.map(([i, j]) => Math.hypot(base[i]!.t - base[j]!.t, base[i]!.s - base[j]!.s)).sort((a, b) => b - a);
        expect(lados[0], caso).toBeCloseTo(f.box.t1 - f.box.t0, 9);
      }
    }
  });

  it('maxim-ar: o eixo é o topo da folha e a folha aberta vai para side', () => {
    const c = cena('ot_j60');
    const m = modelo(c);
    const vidro = de(m.parts, 'glass')[0]!;
    const motion = vidro.motion;
    if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('maxim-ar sem giro em t');
    expect(motion.z).toBeCloseTo(c.g.height - 0.05, 9);
    const ob = partTransformed(vidro, { angle: Math.PI / 2, slide: 0 });
    expect(ob.center.z).toBeCloseTo(motion.z, 9);
    expect(Math.sign(ob.center.s - motion.s)).toBe(c.g.flipFacing ? -1 : 1);
  });

  it('correr: a folha móvel desloca travel em t e continua dentro do vão', () => {
    const c = cena('ot_pc160');
    const m = modelo(c);
    const movel = de(m.parts, 'leaf').find((f) => f.motion?.kind === 'slide' && f.motion.travel > 0);
    if (!movel || movel.motion?.kind !== 'slide') throw new Error('sem folha móvel');
    const antes = partTransformed(movel, CLOSED);
    const depois = partTransformed(movel, { angle: 0, slide: 1 });
    expect(depois.center.t - antes.center.t).toBeCloseTo(movel.motion.dt * movel.motion.travel, 9);
    expect(depois.bounds.t0).toBeGreaterThanOrEqual(-c.g.width / 2 - 1e-9);
    expect(depois.bounds.t1).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
  });

  it('corte a 1,5 m da porta de giro: duas ombreiras em L (6 vértices cada) e a folha', () => {
    const m = modelo(cena('ot_p90'));
    const corte = slicePartsAtZ(m, 1.5, CLOSED);
    const ombreiras = corte.filter((x) => x.part.role === 'jamb');
    expect(ombreiras).toHaveLength(2);
    for (const o of ombreiras) expect(o.ring).toHaveLength(6);
    expect(corte.some((x) => x.part.role === 'head')).toBe(false);
    const f = corte.find((x) => x.part.role === 'leaf')!;
    const ts = f.ring.map((p) => p.t);
    const ss = f.ring.map((p) => p.s);
    expect(Math.max(...ts) - Math.min(...ts)).toBeCloseTo(2 * 0.411, 9);
    expect(Math.max(...ss) - Math.min(...ss)).toBeCloseTo(0.04, 9);
  });

  it('área do anel em L é J·D − ov·R nos dois lados', () => {
    const m = modelo(cena('ot_p90'));
    const corte = slicePartsAtZ(m, 1.5, CLOSED).filter((x) => x.part.role === 'jamb');
    const areaCadarco = (ring: Array<{ t: number; s: number }>): number => {
      let a = 0;
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i]!;
        const q = ring[(i + 1) % ring.length]!;
        a += p.t * q.s - q.t * p.s;
      }
      return Math.abs(a) / 2;
    };
    const esperada = 0.05 * 0.14 - 0.015 * (0.04 + 0.004);
    for (const o of corte) {
      expect(areaCadarco(o.ring)).toBeCloseTo(esperada, 9);
      expect(o.ring).toHaveLength(6);
    }
  });

  it('partTransformed de peça com perfil e sem movimento devolve a caixa envolvente', () => {
    const m = modelo(cena('ot_p90'));
    for (const p of [...de(m.parts, 'jamb'), de(m.parts, 'head')[0]!]) {
      const ob = partTransformed(p, CLOSED);
      expect(ob.bounds).toEqual(p.box);
      expect(ob.corners).toHaveLength(8);
    }
  });

  it('projectParts respeita o perfil: elevação retângulo, corte transversal da travessa em L', () => {
    const m = modelo(cena('ot_p90'));
    const elev = projectParts(m, 's', CLOSED);
    for (const p of [...de(m.parts, 'jamb'), de(m.parts, 'head')[0]!]) {
      expect(elev.find((x) => x.part.id === p.id)!.ring).toHaveLength(4);
    }
    const corte = projectParts(m, 't', CLOSED);
    expect(corte.find((x) => x.part.role === 'head')!.ring).toHaveLength(6);
    expect(corte.find((x) => x.part.role === 'jamb')!.ring).toHaveLength(4);
  });

  it('corte a 2,3 m devolve só a verga quando o tipo tem', () => {
    const m = modelo(cena('ot_p90', { lintel: { height: 0.2 } }));
    const corte = slicePartsAtZ(m, 2.3, CLOSED);
    expect(corte).toHaveLength(1);
    expect(corte[0]!.part.role).toBe('lintel');
  });

  it('elevação (axis s): retângulos de batente, folha, vidro e maçaneta', () => {
    const proj = projectParts(modelo(cena('ot_p90', { leafStyle: 'glass' })), 's', CLOSED);
    const roles = new Set(proj.map((x) => x.part.role));
    for (const r of ['jamb', 'head', 'leaf', 'glass', 'handle'] as const) expect(roles.has(r), r).toBe(true);
    for (const x of proj) expect(x.ring, x.part.id).toHaveLength(4);
  });

  it('elevação: leafStyle panel devolve as 4 almofadas', () => {
    const proj = projectParts(modelo(cena('ot_p90', { leafStyle: 'panel' })), 's', CLOSED);
    expect(proj.filter((x) => x.part.role === 'leafPanel')).toHaveLength(4);
  });

  it('elevação: grid 2×2 na janela fixa devolve 1 montante vertical e 1 horizontal', () => {
    const proj = projectParts(modelo(cena('ot_jfixa60', { grid: { cols: 2, rows: 2 } })), 's', CLOSED);
    const muntins = proj.filter((x) => x.part.role === 'muntin');
    expect(muntins).toHaveLength(2);
    const dimensoes = muntins.map((x) => {
      const us = x.ring.map((p) => p.u);
      const zs = x.ring.map((p) => p.z);
      return { w: Math.max(...us) - Math.min(...us), h: Math.max(...zs) - Math.min(...zs) };
    });
    expect(dimensoes.filter((d) => d.w < d.h)).toHaveLength(1);
    expect(dimensoes.filter((d) => d.h < d.w)).toHaveLength(1);
  });

  it('corte transversal (axis t) devolve anéis em (s, z) e profundidade ordenável', () => {
    const proj = projectParts(modelo(cena('ot_p90')), 't', CLOSED);
    const folhaProj = proj.find((x) => x.part.role === 'leaf')!;
    const ss = folhaProj.ring.map((p) => p.u);
    expect(Math.max(...ss) - Math.min(...ss)).toBeCloseTo(0.04, 9);
    expect(Number.isFinite(folhaProj.depth)).toBe(true);
  });
});

describe('folha × batente: varredura de abertura sem interseção (spec E3 §5)', () => {
  const combos = [
    { flipHand: false, flipFacing: false },
    { flipHand: false, flipFacing: true },
    { flipHand: true, flipFacing: false },
    { flipHand: true, flipFacing: true },
  ];

  it('giro, dupla, pivotante e vai-e-vem: volume zero de 0 até angle3d, a cada 5°, nos 4 flips', () => {
    for (const [base, leaves] of [
      ['ot_p90', 1],
      ['ot_p160', 2],
      ['ot_pp80', 1],
      ['ot_pvv90', 1],
    ] as const) {
      for (const flips of combos) {
        const c = cena(base, {}, flips);
        const m = modelo(c);
        const batente = ids(m.parts, (p) => p.role === 'jamb' || p.role === 'head');
        const max = (openingAngle3d(c.t) * Math.PI) / 180;
        for (let g = 0; g <= Math.round((max * 180) / Math.PI); g += 5) {
          const state = { angle: (g * Math.PI) / 180, slide: 0 };
          for (let leaf = 0; leaf < leaves; leaf++) {
            const folha = ids(m.parts, (p) => p.leaf === leaf && (p.role === 'leaf' || p.role === 'glass' || p.role === 'leafPanel' || p.role === 'handle'));
            const caso = `${base} hand=${flips.flipHand} facing=${flips.flipFacing} ${g}° folha ${leaf}`;
            expect(colide(m, folha, batente, state), caso).toBe(false);
          }
        }
      }
    }
  });

  it('dupla: as duas folhas não se interseccionam em nenhum ângulo', () => {
    for (const flips of combos) {
      const c = cena('ot_p160', {}, flips);
      const m = modelo(c);
      const max = (openingAngle3d(c.t) * Math.PI) / 180;
      for (let g = 0; g <= Math.round((max * 180) / Math.PI); g += 5) {
        const state = { angle: (g * Math.PI) / 180, slide: 0 };
        const a = ids(m.parts, (p) => p.leaf === 0 && p.role === 'leaf');
        const b = ids(m.parts, (p) => p.leaf === 1 && p.role === 'leaf');
        expect(colide(m, a, b, state), `${g}°`).toBe(false);
      }
    }
  });

  it('correr, embutir, dobrável e sanfonada: sem interseção ao longo do deslocamento/dobra', () => {
    const casos: Array<{ base: string; passos: number; estado: (k: number) => { angle: number; slide: number } }> = [
      { base: 'ot_pc160', passos: 10, estado: (k) => ({ angle: 0, slide: k / 10 }) },
      { base: 'ot_pe80', passos: 10, estado: (k) => ({ angle: 0, slide: k / 10 }) },
      { base: 'ot_pd120', passos: 14, estado: (k) => ({ angle: (k * Math.PI) / 28, slide: 0 }) },
      { base: 'ot_ps90', passos: 15, estado: (k) => ({ angle: (k * Math.PI) / 36, slide: 0 }) },
    ];
    for (const caso of casos) {
      for (const flips of combos) {
        const m = modelo(cena(caso.base, {}, flips));
        const batente = ids(m.parts, (p) => p.role === 'jamb' || p.role === 'head');
        const folhas = ids(m.parts, (p) => p.role === 'leaf' || p.role === 'leafPanel' || p.role === 'glass');
        for (let k = 0; k <= caso.passos; k++) {
          expect(colide(m, folhas, batente, caso.estado(k)), `${caso.base} k=${k} hand=${flips.flipHand} facing=${flips.flipFacing}`).toBe(false);
        }
      }
    }
  });
});

describe('buildOpeningModel: geometria do batente na parede', () => {
  it('padrão core: D = 0,14 do núcleo; wall: D = 0,184 da parede; fixed: valor do tipo', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const jamb = de(m.parts, 'jamb')[0]!;
    expect(jamb.box.s1 - jamb.box.s0).toBeCloseTo(0.14, 9);
    const parede = modelo(cena('ot_p90', { frameDepthMode: 'wall' }));
    expect(de(parede.parts, 'jamb')[0]!.box.s1 - de(parede.parts, 'jamb')[0]!.box.s0).toBeCloseTo(0.184, 9);
    const fixo = modelo(cena('ot_p90', { frameDepthMode: 'fixed', frameDepth: 0.09 }));
    expect(de(fixo.parts, 'jamb')[0]!.box.s1 - de(fixo.parts, 'jamb')[0]!.box.s0).toBeCloseTo(0.09, 9);
  });

  it('cada ombreira e a travessa são UMA peça com perfil em L e caixa envolvente exata', () => {
    const m = modelo(cena('ot_p90'));
    expect(de(m.parts, 'jamb')).toHaveLength(2);
    expect(de(m.parts, 'stop')).toHaveLength(0);
    expect(de(m.parts, 'head')).toHaveLength(1);
    const head = de(m.parts, 'head')[0]!;
    expect(head.profile?.plane).toBe('sz');
    expect(head.profile?.pts).toHaveLength(6);
    expect(altura(head.box)).toBeCloseTo(0.05, 9);
    for (const p of [...de(m.parts, 'jamb'), head]) {
      const pts = p.profile!.pts;
      const ts = pts.map((q) => (p.profile!.plane === 'ts' ? q[0] : q[1]));
      const ss = pts.map((q) => (p.profile!.plane === 'ts' ? q[1] : q[0]));
      if (p.profile!.plane === 'ts') {
        expect(Math.min(...ts), p.id).toBeCloseTo(p.box.t0, 9);
        expect(Math.max(...ts), p.id).toBeCloseTo(p.box.t1, 9);
        expect(Math.min(...ss), p.id).toBeCloseTo(p.box.s0, 9);
        expect(Math.max(...ss), p.id).toBeCloseTo(p.box.s1, 9);
      } else {
        expect(Math.min(...ts), p.id).toBeCloseTo(p.box.z0, 9);
        expect(Math.max(...ts), p.id).toBeCloseTo(p.box.z1, 9);
        expect(Math.min(...ss), p.id).toBeCloseTo(p.box.s0, 9);
        expect(Math.max(...ss), p.id).toBeCloseTo(p.box.s1, 9);
      }
    }
  });
});
