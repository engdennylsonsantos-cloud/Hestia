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
