import { describe, expect, it } from 'vitest';
import { coreSpan, createEmptyProject, DEFAULT_OPENING_TYPES, makeWall, openingFrame, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel } from './openingModel.ts';
import type { OpeningPart, PartBox } from './openingModelTypes.ts';

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

function volumeComum(a: PartBox, b: PartBox): boolean {
  const e = 1e-9;
  return (
    Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0) > e &&
    Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0) > e &&
    Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > e
  );
}

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

  it('a folha fechada não tem volume em comum com ombreira, batedor ou travessa', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const m = modelo(cena('ot_p90', {}, { flipHand, flipFacing }));
        const f = folha(m.parts);
        for (const p of m.parts) {
          if (p.role !== 'jamb' && p.role !== 'stop' && p.role !== 'head') continue;
          expect(volumeComum(f.box, p.box), `${p.id} hand=${flipHand} facing=${flipFacing}`).toBe(false);
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

  it('peças de batente ficam dentro do núcleo e do vão', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_p90', {}, { flipHand, flipFacing });
        const m = modelo(c);
        expect(m.core.s1 - m.core.s0).toBeCloseTo(0.14, 9);
        for (const p of m.parts.filter((x) => x.role === 'jamb' || x.role === 'stop' || x.role === 'head')) {
          expect(p.box.s0, p.id).toBeGreaterThanOrEqual(m.core.s0 - 1e-9);
          expect(p.box.s1, p.id).toBeLessThanOrEqual(m.core.s1 + 1e-9);
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

  it('aduela: batente de 0,03 m de largura e profundidade do núcleo inteiro', () => {
    const c = cena('ot_p90', { frameStyle: 'aduela' });
    const m = modelo(c);
    const jamb = de(m.parts, 'jamb')[0]!;
    const stop = de(m.parts, 'stop')[0]!;
    const larguraTotal = Math.max(jamb.box.t1, stop.box.t1) - Math.min(jamb.box.t0, stop.box.t0);
    expect(larguraTotal).toBeCloseTo(0.03, 9);
    expect(jamb.box.s1 - jamb.box.s0).toBeCloseTo(0.14, 9);
    expect(de(m.parts, 'stop')).toHaveLength(3);
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
        expect(largura(f.box)).toBeCloseTo(2 * 0.361, 9);
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
    expect(movel).toBeDefined();
    if (movel.motion?.kind === 'slide') {
      expect(Math.abs(movel.motion.dt)).toBe(1);
      expect(movel.motion.travel).toBeCloseTo(0.72, 9);
    }
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

  it('basculante: eixo na base e kind bottom', () => {
    const c = cena('ot_j60', { plan: 'tilt' });
    const m = modelo(c);
    expect(m.openings[0]!.kind).toBe('bottom');
    const motion = de(m.parts, 'leaf')[0]!.motion;
    if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('basculante sem giro em t');
    expect(motion.z).toBeCloseTo(0.05, 9);
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

describe('buildOpeningModel: geometria do batente no núcleo', () => {
  it('profundidade do batente limitada ao núcleo (DEC-1): D = 0,09 < 0,14', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const f = frameOfWall(c.p, 'w')!;
    const core = coreSpan(f.type);
    const fr = openingFrame(c.t, core.to - core.from);
    expect(fr.frameDepth).toBeCloseTo(0.09, 9);
    const jamb = de(m.parts, 'jamb')[0]!;
    expect(jamb.box.s1 - jamb.box.s0).toBeCloseTo(0.09, 9);
  });

  it('cada ombreira tem corpo e batedor; a travessa tem o batedor embaixo do corpo', () => {
    const m = modelo(cena('ot_p90'));
    expect(de(m.parts, 'jamb')).toHaveLength(2);
    expect(de(m.parts, 'stop')).toHaveLength(3);
    expect(de(m.parts, 'head')).toHaveLength(1);
    const head = de(m.parts, 'head')[0]!;
    const stopHead = m.parts.find((x) => x.id === 'stop-head')!;
    expect(stopHead.box.z1).toBeCloseTo(head.box.z0, 9);
    expect(altura(head.box)).toBeLessThan(0.05);
  });
});
