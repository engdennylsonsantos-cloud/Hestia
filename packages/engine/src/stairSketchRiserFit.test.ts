import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { riserGaps, snapToRunBoundary, validateRunSketch, type StairCurve, type StairRunSketch } from './stairSketch.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance reto (sentido +x), limites em y = ±0,6 (1,20 m de largura) de x = -0,5 a x = 5. */
function run(risers: StairCurve[]): StairRunSketch {
  return { boundaryLeft: [ln(-0.5, 0.6, 5, 0.6)], boundaryRight: [ln(-0.5, -0.6, 5, -0.6)], risers, path: [] };
}

describe('riserGaps: folga de um espelho a cada limite', () => {
  it('espelho que termina 0,30 m antes do limite direito tem essa folga à direita e zero à esquerda', () => {
    const r = run([ln(1, 0.6, 1, -0.3), ln(2, 0.6, 2, -0.6)]);
    const g = riserGaps(r, 0);
    expect(g.left).toBeCloseTo(0, 9);
    expect(g.right).toBeCloseTo(0.3, 9);
  });
});

describe('snapToRunBoundary: captura do clique no limite', () => {
  it('projeta um clique a 0,20 m do limite esquerdo sobre ele', () => {
    const p = snapToRunBoundary(run([]), v(1, 0.8), 0.5);
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(1, 9);
    expect(p!.y).toBeCloseTo(0.6, 9);
  });

  it('não captura um clique longe dos limites (além da tolerância)', () => {
    expect(snapToRunBoundary(run([]), v(1, 0), 0.5)).toBeNull();
  });
});

describe('croqui com cliques imprecisos: a captura torna o espelho válido', () => {
  it('espelhos clicados a 0,1 a 0,2 m dos limites, captados, passam na validação', () => {
    const tol = 0.5;
    const pick = (q: Vec2, r: StairRunSketch): Vec2 => snapToRunBoundary(r, q, tol) ?? q;
    const base = run([]);
    const risers: StairCurve[] = [1, 2, 3].map((x) => {
      const a = pick(v(x, 0.8), base);
      const b = pick(v(x, -0.5), base);
      return { a, b, sag: 0 };
    });
    expect(validateRunSketch(run(risers))).toEqual([]);
  });

  it('sem captura, o mesmo clique impreciso dá "não liga o limite" no espelho', () => {
    const issues = validateRunSketch(run([ln(1, 0.8, 1, -0.5)]));
    expect(issues.map((i) => i.code)).toContain('stair-riser-not-spanning');
  });
});

describe('validateRunSketch: par de espelhos na mesma posição', () => {
  it('aponta o outro espelho do par (otherIndex)', () => {
    const r = run([ln(1, 0.6, 1, -0.6), ln(2, 0.6, 2, -0.6), ln(1, 0.6, 1, -0.6)]);
    const iss = validateRunSketch(r).find((i) => i.code === 'stair-riser-same-location');
    expect(iss?.riserIndex).toBe(0);
    expect(iss?.otherIndex).toBe(2);
  });
});
