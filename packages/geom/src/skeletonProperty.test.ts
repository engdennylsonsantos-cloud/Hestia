import { describe, expect, it } from 'vitest';
import { weightedSkeleton, type SkeletonFace, type SkeletonResult } from './skeleton.ts';
import { pointInRing, ringArea } from './polygon.ts';
import { v2, type Vec2 } from './vec.ts';

/** PRNG determinístico (mulberry32) para semente fixa. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Polígono ortogonal em forma de histograma: alturas adjacentes sempre diferentes (sem colineares). */
function histogram(r: () => number): Vec2[] {
  const n = 3 + Math.floor(r() * 4);
  const xs = [0];
  const hs: number[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(xs[i]! + 1 + Math.floor(r() * 3));
    let h = 1 + Math.floor(r() * 5);
    while (i > 0 && h === hs[i - 1]) h = 1 + Math.floor(r() * 5);
    hs.push(h);
  }
  const pts: Vec2[] = [v2(xs[0]!, 0), v2(xs[n]!, 0)];
  for (let i = n - 1; i >= 0; i--) {
    pts.push(v2(xs[i + 1]!, hs[i]!));
    pts.push(v2(xs[i]!, hs[i]!));
  }
  return pts;
}

/** Polígono convexo: pontos em círculo ordenados por ângulo. */
function convex(r: () => number): Vec2[] {
  const n = 5 + Math.floor(r() * 5);
  const angs = Array.from({ length: n }, () => r() * Math.PI * 2).sort((a, b) => a - b);
  const R = 5 + r() * 5;
  return angs.map((a) => v2(R * Math.cos(a), R * Math.sin(a)));
}

interface Case {
  name: string;
  outer: Vec2[];
  weights: number[];
  allPositive: boolean;
}

function makeCases(): Case[] {
  const r = rng(20260420);
  const cases: Case[] = [];
  for (let i = 0; i < 30; i++) {
    const outer = i % 2 === 0 ? histogram(r) : convex(r);
    const weights = outer.map(() => 0.1 + r() * 0.5);
    let allPositive = true;
    // às vezes 0 em uma aresta isolada (as demais continuam com inclinação)
    if (r() < 0.3) {
      weights[Math.floor(r() * weights.length)] = 0;
      allPositive = false;
    }
    cases.push({ name: `caso ${i} (${i % 2 === 0 ? 'ortogonal' : 'convexo'})`, outer, weights, allPositive });
  }
  return cases;
}

const distLine = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  return Math.abs((dx * (p.y - a.y) - dy * (p.x - a.x)) / l);
};

/** Confere um resultado e devolve a lista de problemas (vazia = passou). */
function checkResult(c: Case, r: SkeletonResult): string[] {
  const bad: string[] = [];
  const need = (cond: boolean, msg: string): void => {
    if (!cond) bad.push(msg);
  };
  if (!r.ok) return [`ok:false (${r.reason})`];
  const area = Math.abs(ringArea(c.outer));
  const faces = r.faces;
  // (a) área: soma das águas = área (sem pesos 0), ou ≤ área (com aresta de peso 0)
  const sum = faces.reduce((s, f) => s + Math.abs(ringArea(f.polygon)), 0);
  if (c.allPositive) need(Math.abs(sum - area) / area < 1e-6, `área ${sum.toFixed(6)} ≠ ${area.toFixed(6)}`);
  else need(sum <= area * (1 + 1e-6), `soma das águas ${sum.toFixed(6)} > área ${area.toFixed(6)}`);
  // sobreposição / cobertura por amostras
  const b = c.outer.reduce(
    (acc, p) => ({ x0: Math.min(acc.x0, p.x), x1: Math.max(acc.x1, p.x), y0: Math.min(acc.y0, p.y), y1: Math.max(acc.y1, p.y) }),
    { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity },
  );
  const rs = rng(7);
  let overlap = 0;
  let hole = 0;
  for (let s = 0; s < 400; s++) {
    const p = v2(b.x0 + rs() * (b.x1 - b.x0), b.y0 + rs() * (b.y1 - b.y0));
    const hits = faces.filter((f) => pointInRing(p, f.polygon)).length;
    if (hits > 1) overlap++;
    if (c.allPositive && pointInRing(p, c.outer) && hits !== 1) hole++;
  }
  need(overlap === 0, `${overlap} amostras em mais de uma água`);
  need(hole === 0, `${hole} amostras sem água (ou com duas)`);
  // (b) z = w × distância à reta da aresta de origem; (d) z ≥ 0
  let zErr = 0;
  let zNeg = 0;
  for (const f of faces) {
    const k = f.edge;
    const a = c.outer[k]!;
    const bb = c.outer[(k + 1) % c.outer.length]!;
    const w = c.weights[k]!;
    f.polygon.forEach((p, i) => {
      const z = f.z[i]!;
      if (z < -1e-9) zNeg++;
      if (Math.abs(z - w * distLine(p, a, bb)) >= 1e-6) zErr++;
    });
  }
  need(zNeg === 0, `${zNeg} alturas negativas`);
  need(zErr === 0, `${zErr} vértices com z ≠ w·distância`);
  // (c) continuidade: cada arco aparece com a mesma altura nas duas águas que separa
  const has = (f: SkeletonFace, p: Vec2, z: number): boolean =>
    f.polygon.some((q, i) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6 && Math.abs(f.z[i]! - z) < 1e-6);
  let contErr = 0;
  for (const arc of r.arcs) {
    const [f0, f1] = arc.faces;
    if (!(has(faces[f0]!, arc.a, arc.za) && has(faces[f0]!, arc.b, arc.zb))) contErr++;
    if (!(has(faces[f1]!, arc.a, arc.za) && has(faces[f1]!, arc.b, arc.zb))) contErr++;
  }
  need(contErr === 0, `${contErr} extremidades de arco sem continuidade de altura`);
  return bad;
}

describe('propriedades do esqueleto (30 polígonos aleatórios, semente fixa)', () => {
  it('área, z = w·distância, continuidade, sem sobreposição e tempo < 3 s', () => {
    const cases = makeCases();
    const t0 = performance.now();
    const results = cases.map((c) => ({ c, r: weightedSkeleton({ outer: c.outer, holes: [], weights: [c.weights] }) }));
    const elapsed = performance.now() - t0;
    const failing = results
      .map(({ c, r }) => ({ name: c.name, problems: checkResult(c, r) }))
      .filter((x) => x.problems.length > 0);
    if (failing.length) console.log(`CASOS QUE NÃO PASSARAM (${failing.length}/${cases.length}):\n` + failing.map((x) => `${x.name}: ${x.problems.join('; ')}`).join('\n'));
    expect(failing.map((x) => x.name)).toEqual([]);
    expect(elapsed).toBeLessThan(3000);
  });
});
