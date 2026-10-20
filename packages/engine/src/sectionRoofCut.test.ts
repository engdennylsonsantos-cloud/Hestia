import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { sectionOfRoofs, squareCutRun } from './section.ts';
import type { ResolvedRoof } from './roofs.ts';

const EAVE = 2.8;
const P = (x: number, y: number): Vec2 => ({ x, y });

/**
 * Uma água 8 × 6 subindo em y a `percent` %, beiral (aresta y = 0) em z = 2,80, uma só camada de `t` m (vertical).
 * Corte transversal em x = 4: t = y + 1, então o beiral está em t = 1 e a aresta alta em t = 7.
 */
function shed(percent: number, t: number, rafterCut?: 'plumb' | 'square'): ResolvedRoof {
  return {
    roofId: 's',
    typeId: 'rt_ceramica',
    levelId: 'lv_0',
    eaveZ: EAVE,
    joinedArea: 0,
    layers: [{ layerIndex: 0, materialId: 'mat_telha_ceramica', thickness: t, below: 0 }],
    planes: [{ polygon: [[[P(0, 0), P(8, 0), P(8, 6), P(0, 6)]]], origin: P(0, 0), up: P(0, 1), percent, z0: EAVE }],
    lines: [{ kind: 'eave', a: P(0, 0), b: P(8, 0) }],
    ...(rafterCut ? { rafterCut } : {}),
  };
}

const LINE = { a: P(4, -1), b: P(4, 7), depth: 4 };
/** Anel (t, z) da única camada de corte: [base no beiral, base na aresta alta, topo na aresta alta, topo no beiral]. */
const cutRing = (r: ReturnType<typeof sectionOfRoofs>): Vec2[] => r.cut[0]!.polygon[0]!;

describe('corte de caibro no corte (C5)', () => {
  it('deslocamento do corte esquadro: s = G·T/(1+G²); a 100 % (45°) com 10 cm, 5,00 cm na horizontal', () => {
    expect(squareCutRun(100, 0.1)).toBeCloseTo(0.05, 12);
    expect(squareCutRun(0, 0.1)).toBe(0);
  });

  it('prumo (padrão): a extremidade do beiral é vertical, base em t = 1 a z = 2,80 − 0,10', () => {
    const ring = cutRing(sectionOfRoofs([shed(100, 0.1)], LINE));
    expect(ring[0]!.x).toBeCloseTo(1, 9);
    expect(ring[0]!.y).toBeCloseTo(2.7, 9);
    expect(ring[3]!.x).toBeCloseTo(1, 9);
    expect(ring[3]!.y).toBeCloseTo(2.8, 9);
  });

  it('esquadro: a base do beiral recua 5,00 cm ao longo da água e o corte fica perpendicular, com 7,07 cm', () => {
    const ring = cutRing(sectionOfRoofs([shed(100, 0.1, 'square')], LINE));
    const base = ring[0]!;
    const top = ring[3]!;
    // a base sobe 5 cm na seção: z = (2,80 + 0,05) − 0,10 = 2,75 a t = 1,05
    expect(base.x - top.x).toBeCloseTo(0.05, 9);
    expect(base.y).toBeCloseTo(2.75, 9);
    // o corte é perpendicular à água (inclinação 45°): vetor (0,05; −0,05), e o comprimento é T·cos θ = 7,07 cm
    expect((base.x - top.x) + (base.y - top.y)).toBeCloseTo(0, 9);
    expect(Math.hypot(base.x - top.x, base.y - top.y)).toBeCloseTo(0.1 * Math.SQRT1_2, 9);
    // o topo continua no beiral e a cota máxima da seção não muda
    expect(top.y).toBeCloseTo(2.8, 9);
  });

  it('esquadro não mexe nas extremidades que não são de beiral (aresta alta)', () => {
    const ring = cutRing(sectionOfRoofs([shed(100, 0.1, 'square')], LINE));
    // extremidade alta em t = 7: base em z = 2,80 + 6 − 0,10 = 8,70, sem recuo
    const hiBase = ring[1]!;
    expect(hiBase.x).toBeCloseTo(7, 9);
    expect(hiBase.y).toBeCloseTo(8.7, 9);
  });

  it('esquadro com inclinação menor: o recuo acompanha s = G·T/(1+G²)', () => {
    const ring = cutRing(sectionOfRoofs([shed(30, 0.095, 'square')], LINE));
    const s = squareCutRun(30, 0.095);
    expect(ring[0]!.x - 1).toBeCloseTo(s, 9);
    expect(ring[0]!.y).toBeCloseTo(2.8 + 0.3 * s - 0.095, 9);
  });
});
