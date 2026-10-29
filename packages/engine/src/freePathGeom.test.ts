import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { DEFAULT_RAMP_TYPES } from '@hestia/model';
import { compactRing, FREE_COLLINEAR_ANGLE, FREE_MAX_TURN_ANGLE, turnLandingRing, turnLandingSketch, turnTMin } from './freePathGeom.ts';
import { planRampFree } from './rampFree.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const close = (a: Vec2, b: Vec2): void => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe('freePathGeom', () => {
  it('constantes', () => {
    expect(FREE_COLLINEAR_ANGLE).toBeCloseTo((3 * Math.PI) / 180, 12);
    expect(FREE_MAX_TURN_ANGLE).toBeCloseTo((150 * Math.PI) / 180, 12);
  });

  it('turnTMin = (w/2)·tan(θ/2)', () => {
    expect(turnTMin(Math.PI / 2, 1)).toBeCloseTo(0.5, 12);
    expect(turnTMin(0, 1)).toBe(0);
  });

  it('anel do exemplo 2 (tIn 0,76, tOut 0,5)', () => {
    const r = turnLandingRing(v(3, 0), v(1, 0), v(0, 1), 1, 0.76, 0.5);
    expect(r).toHaveLength(6);
    [v(2.24, 0.5), v(2.5, 0.5), v(2.5, 0.5), v(3.5, 0.5), v(3.5, -0.5), v(2.24, -0.5)].forEach((p, i) => close(r[i]!, p));
    const c = compactRing(r);
    expect(c).toHaveLength(5);
    [v(2.24, 0.5), v(2.5, 0.5), v(3.5, 0.5), v(3.5, -0.5), v(2.24, -0.5)].forEach((p, i) => close(c[i]!, p));
  });

  it('tOut padrão = tIn; giro à direita espelha o sinal', () => {
    const a = turnLandingRing(v(3, 0), v(1, 0), v(0, 1), 1, 0.5);
    const b = turnLandingRing(v(3, 0), v(1, 0), v(0, -1), 1, 0.5);
    a.forEach((p, i) => close(v(p.x, -p.y), { x: b[i]!.x, y: b[i]!.y }));
  });

  it('compactRing remove repetidos e o fechamento', () => {
    const c = compactRing([v(0, 0), v(0, 0), v(1, 0), v(1, 1), v(0, 0)]);
    expect(c).toHaveLength(3);
  });

  it('turnLandingSketch tem as arestas do anel cru, retas', () => {
    const s = turnLandingSketch(v(3, 0), v(1, 0), v(0, 1), 1, 0.5);
    if (s.kind !== 'landing') throw new Error('esperava patamar');
    expect(s.landing.boundary).toHaveLength(6);
    expect(s.landing.boundary.every((c) => c.sag === 0)).toBe(true);
  });

  it('o patamar de giro da rampa livre é o turnLandingSketch com t = tPref', () => {
    const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;
    const plan = planRampFree([v(0, 0), v(12, 0), v(12, 10)], 1.0, type, { width: 1.5, mode: 'slope', slope: 1 / 12 });
    if ('error' in plan) throw new Error(plan.error);
    const turn = plan.parts.find((p, i) => p.kind === 'landing' && i > 0 && p.landing.boundary.length === 6);
    expect(turn).toBeDefined();
    if (!turn || turn.kind !== 'landing') return;
    const t = turn.landing.boundary[0]!.a;
    const t0 = 12 - t.x;
    const ref = turnLandingSketch(v(12, 0), v(1, 0), v(0, 1), 1.5, t0);
    if (ref.kind !== 'landing') throw new Error('esperava patamar');
    turn.landing.boundary.forEach((c, i) => {
      close(c.a, ref.landing.boundary[i]!.a);
      close(c.b, ref.landing.boundary[i]!.b);
    });
  });
});
