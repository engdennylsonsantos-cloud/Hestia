import { describe, expect, it } from 'vitest';
import { arcFromSagitta, arcSample, dist, type Vec2 } from '@hestia/geom';
import { fitRing, type ArcFlags } from './perimeterArcFit.ts';

/** Pontos de um arco de centro c e raio r, de `a0` a `a1` (radianos), com `n` lados. */
const circlePts = (c: Vec2, r: number, a0: number, a1: number, n: number): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: c.x + r * Math.cos(a0 + ((a1 - a0) * i) / n), y: c.y + r * Math.sin(a0 + ((a1 - a0) * i) / n) }));

/** Arco amostrado como o esboço faz (corda com flecha de 2 mm). */
const sampled = (c: Vec2, r: number, a0: number, a1: number): Vec2[] => {
  const step = 2 * Math.acos(1 - 0.002 / r);
  return circlePts(c, r, a0, a1, Math.ceil((a1 - a0) / step));
};

/** Distância do ponto ao traço da linha (reta ou arco). */
function distToLine(p: Vec2, s: { a: Vec2; b: Vec2; sag?: number }): number {
  const arc = s.sag ? arcFromSagitta(s.a, s.b, s.sag) : null;
  const pts = arc ? arcSample(arc, 0, arc.length, 0, 0.0005) : [s.a, s.b];
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (dist(a, b) ** 2 || 1)));
    best = Math.min(best, dist(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
  }
  return best;
}

describe('fitRing: recuperação de arcos do anel', () => {
  it('quadrado continua com quatro retas', () => {
    const sq: Vec2[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    const out = fitRing(sq);
    expect(out).toHaveLength(4);
    expect(out.every((s) => s.sag === undefined)).toBe(true);
  });

  it('semicírculo amostrado + diâmetro: um arco de 180° e uma reta, com os vértices do anel sobre o arco', () => {
    const arc = sampled({ x: 0, y: 0 }, 2, 0, Math.PI);
    const out = fitRing(arc);
    expect(out).toHaveLength(2);
    const [ar, line] = out as [(typeof out)[number], (typeof out)[number]];
    expect(ar.sag).toBeDefined();
    expect(Math.abs(ar.sag!)).toBeCloseTo(2, 6);
    expect(line.sag).toBeUndefined();
    for (const p of arc) expect(distToLine(p, ar)).toBeLessThan(0.003);
  });

  it('arco que cruza o vértice 0 (o anel começa no meio do arco) sai inteiro, não cortado', () => {
    const arc = sampled({ x: 0, y: 0 }, 2, 0, Math.PI);
    const k = Math.floor(arc.length / 2);
    const rotated = [...arc.slice(k), ...arc.slice(0, k)];
    const out = fitRing(rotated);
    expect(out).toHaveLength(2);
    expect(out.filter((s) => s.sag !== undefined)).toHaveLength(1);
    expect(Math.abs(out.find((s) => s.sag !== undefined)!.sag!)).toBeCloseTo(2, 2);
  });

  it('círculo inteiro amostrado vira dois arcos, cada um de no máximo 180°', () => {
    const ring = sampled({ x: 1, y: 1 }, 3, 0, 2 * Math.PI).slice(0, -1);
    const out = fitRing(ring);
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.sag !== undefined)).toBe(true);
    for (const s of out) {
      const chord = dist(s.a, s.b);
      expect(chord).toBeLessThanOrEqual(2 * 3 + 1e-9);
    }
  });

  it('polígono inscrito num círculo não vira arco: os lados têm flecha grande demais', () => {
    const hex = Array.from({ length: 6 }, (_, i) => ({ x: 5 * Math.cos((i * Math.PI) / 3), y: 5 * Math.sin((i * Math.PI) / 3) }));
    const out = fitRing(hex);
    expect(out).toHaveLength(6);
    expect(out.every((s) => s.sag === undefined)).toBe(true);
  });

  it('ruído de até 1 mm numa reta não vira arco de raio enorme', () => {
    const line: Vec2[] = [0, 1, 2, 3, 4, 5].map((x) => ({ x, y: x % 2 === 0 ? 0 : 0.001 }));
    const out = fitRing([...line, { x: 5, y: 3 }, { x: 0, y: 3 }]);
    expect(out.every((s) => s.sag === undefined)).toBe(true);
  });

  it('só arcos de três ou mais lados: três vértices sobre um círculo não bastam', () => {
    const out = fitRing(circlePts({ x: 0, y: 0 }, 2, 0, 0.8, 2).concat([{ x: -1, y: -1 }]));
    expect(out.every((s) => s.sag === undefined)).toBe(true);
  });

  it('flags iguais na sequência são preservadas no arco; flags diferentes não se fundem', () => {
    const arc = sampled({ x: 0, y: 0 }, 2, 0, Math.PI);
    const same: ArcFlags[] = arc.slice(0, -1).map(() => ({ definesSlope: true, slopePct: 20, overhang: 0.3 }));
    same.push({ slopePct: 10 });
    const merged = fitRing(arc, same);
    expect(merged[0]!.sag).toBeDefined();
    expect(merged[0]!.flags).toEqual({ definesSlope: true, slopePct: 20, overhang: 0.3 });
    expect(merged[1]!.flags).toEqual({ slopePct: 10 });

    const mixed: ArcFlags[] = arc.slice(0, -1).map((_, i) => ({ slopePct: i % 2 ? 20 : 25 }));
    const split = fitRing(arc, mixed);
    expect(split.some((s) => s.sag !== undefined)).toBe(false);
    expect(split).toHaveLength(arc.length);
  });

  it('anel com menos de dois vértices não tem lados', () => {
    expect(fitRing([])).toEqual([]);
    expect(fitRing([{ x: 0, y: 0 }])).toEqual([]);
  });
});
