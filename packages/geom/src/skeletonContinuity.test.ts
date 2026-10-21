import { describe, expect, it } from 'vitest';
import { weightedSkeleton, type SkeletonFace, type SkeletonResult } from './skeleton.ts';
import { pointInRing } from './polygon.ts';
import { cross, dot, sub, v2, type Vec2 } from './vec.ts';

/*
 * Continuidade da superfície do telhado em contornos côncavos com empena (aresta de inclinação nula).
 *
 * A superfície entregue ao engine é, por água, o plano z = inclinação × distância à reta da aresta de origem
 * (`planeZ` de roofs.ts). Logo a superfície é contínua quando, em qualquer ponto de fronteira entre duas águas, as
 * duas águas dão a mesma cota. Dois oráculos independentes checam isso:
 *  - amostragem: pares de pontos a ≤ 5 cm dentro do contorno, com |Δz| ≤ maxSlope × distância × 1,01 + 1e-6;
 *  - vértices: em todo vértice de água, todas as águas que o contêm ou o tocam na fronteira (T-junções incluídas)
 *    têm de dar a mesma cota.
 * Um resultado com ok:true que falhe em qualquer oráculo é uma falha silenciosa. ok:false com motivo é aceitável.
 */

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

const EDGE_TOL = 1e-7;

/** Interseção de segmentos, incluindo toque (mesma lógica do teste de auto-interseção do esqueleto). */
function segmentsTouch(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = cross(sub(b, a), sub(c, a));
  const o2 = cross(sub(b, a), sub(d, a));
  const o3 = cross(sub(d, c), sub(a, c));
  const o4 = cross(sub(d, c), sub(b, c));
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  const onSeg = (p: Vec2, q: Vec2, r: Vec2): boolean =>
    Math.abs(cross(sub(q, p), sub(r, p))) <= 1e-9 && dot(sub(r, p), sub(r, q)) <= 1e-9;
  return onSeg(a, b, c) || onSeg(a, b, d) || onSeg(c, d, a) || onSeg(c, d, b);
}

/** Anel simples: nenhum par de arestas não adjacentes se toca. */
function isSimpleRing(R: Vec2[]): boolean {
  const m = R.length;
  for (let i = 0; i < m; i++) {
    for (let j = i + 2; j < m; j++) {
      if (i === 0 && j === m - 1) continue;
      if (segmentsTouch(R[i]!, R[(i + 1) % m]!, R[j]!, R[(j + 1) % m]!)) return false;
    }
  }
  return true;
}

/** Contorno côncavo, simples, de 5 ou 6 vértices inteiros em [0, 8], sem vértices colineares; inclinações {20,30,60,90,nulo}. */
function genConcave(r: () => number): { ring: Vec2[]; slopes: Array<number | null> } | null {
  const SLOPES = [20, 30, 60, 90, null] as const;
  for (let tries = 0; tries < 200; tries++) {
    const n = 5 + Math.floor(r() * 2);
    const ring: Vec2[] = [];
    while (ring.length < n) {
      const p = v2(Math.floor(r() * 9), Math.floor(r() * 9));
      if (!ring.some((q) => q.x === p.x && q.y === p.y)) ring.push(p);
    }
    if (!isSimpleRing(ring)) continue;
    const a2 = ring.reduce((s, p, i) => s + cross(p, ring[(i + 1) % n]!), 0);
    if (Math.abs(a2) < 1e-9) continue;
    const ccw = a2 > 0 ? ring : [...ring].reverse();
    let reflex = false;
    let colinear = false;
    for (let i = 0; i < n; i++) {
      const turn = cross(sub(ccw[i]!, ccw[(i - 1 + n) % n]!), sub(ccw[(i + 1) % n]!, ccw[i]!));
      if (turn < 0) reflex = true;
      if (turn === 0) colinear = true;
    }
    if (!reflex || colinear) continue;
    const slopes = ring.map(() => SLOPES[Math.floor(r() * SLOPES.length)]!);
    if (slopes.every((s) => s === null)) continue;
    return { ring, slopes };
  }
  return null;
}

const weightOf = (s: number | null): number => (s === null ? 0 : s / 100);

/** Cota da água da aresta `edge` (anel externo) em p: peso × distância à reta da aresta; p fica no lado do material. */
function planeZ(outer: Vec2[], w: number[], edge: number, p: Vec2): number {
  const n = outer.length;
  const a = outer[edge]!;
  const b = outer[(edge + 1) % n]!;
  const d = sub(b, a);
  const l = Math.hypot(d.x, d.y);
  return w[edge]! * Math.abs(((p.x - a.x) * -d.y + (p.y - a.y) * d.x) / l);
}

/** Água que contém p no interior (única), ou null se nenhuma ou se p cai em mais de uma. */
function faceAt(faces: SkeletonFace[], p: Vec2): SkeletonFace | null {
  let found: SkeletonFace | null = null;
  let k = 0;
  for (const f of faces) {
    if (pointInRing(p, f.polygon)) {
      k++;
      found = f;
    }
  }
  return k === 1 ? found : null;
}

/** Oráculo por amostragem: pares a ≤ 5 cm (grade deslocada para não cair sobre as retas do contorno). */
function pairJump(outer: Vec2[], w: number[], faces: SkeletonFace[]): boolean {
  const L = Math.max(...w);
  const zAt = (p: Vec2): number | null => {
    const f = faceAt(faces, p);
    return f ? planeZ(outer, w, f.edge, p) : null;
  };
  const offs = [v2(0.05, 0), v2(0, 0.05), v2(0.035, 0.035), v2(-0.035, 0.035)];
  for (let i = 0; i <= 80; i++) {
    for (let j = 0; j <= 80; j++) {
      const p = v2(i * 0.1 + 0.0371, j * 0.1 + 0.0229);
      if (!pointInRing(p, outer)) continue;
      const zp = zAt(p);
      if (zp === null) continue;
      for (const d of offs) {
        const q = v2(p.x + d.x, p.y + d.y);
        if (!pointInRing(q, outer)) continue;
        const zq = zAt(q);
        if (zq === null) continue;
        if (Math.abs(zp - zq) > L * Math.hypot(d.x, d.y) * 1.01 + 1e-6) return true;
      }
    }
  }
  return false;
}

/** Oráculo por vértices: em cada vértice de água, toda água que o contém ou o toca tem de dar a mesma cota. */
function vertexJump(outer: Vec2[], w: number[], faces: SkeletonFace[]): boolean {
  const onBoundary = (p: Vec2, R: Vec2[]): boolean => {
    for (let i = 0; i < R.length; i++) {
      const a = R[i]!;
      const b = R[(i + 1) % R.length]!;
      const d = sub(b, a);
      const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d)));
      if (Math.hypot(p.x - (a.x + d.x * t), p.y - (a.y + d.y * t)) < EDGE_TOL) return true;
    }
    return false;
  };
  for (const f of faces) {
    for (const v of f.polygon) {
      let ref: number | null = null;
      for (const g of faces) {
        if (!(pointInRing(v, g.polygon) || onBoundary(v, g.polygon))) continue;
        const z = planeZ(outer, w, g.edge, v);
        if (ref === null) ref = z;
        else if (Math.abs(z - ref) > 1e-6) return true;
      }
    }
  }
  return false;
}

/**
 * ok: contínuo e sem degrau. stepped: descontínuo e com degrau reportado (aviso, não falha).
 * silent: descontínuo sem degrau reportado (falha silenciosa). false-step: degrau reportado mas superfície contínua.
 * ok-false: o solver recusou por outro motivo.
 */
type Verdict = 'ok' | 'stepped' | 'silent' | 'false-step' | 'ok-false';

function judge(outer: Vec2[], w: number[], r: SkeletonResult): Verdict {
  if (!r.ok) return 'ok-false';
  const stepped = (r.steps?.length ?? 0) > 0;
  const jump = pairJump(outer, w, r.faces) || vertexJump(outer, w, r.faces);
  if (!jump) return stepped ? 'false-step' : 'ok';
  return stepped ? 'stepped' : 'silent';
}

const CASES = (() => {
  const r = rng(20260420);
  const out: Array<{ ring: Vec2[]; slopes: Array<number | null> }> = [];
  while (out.length < 300) {
    const c = genConcave(r);
    if (!c) break;
    out.push(c);
  }
  return out;
})();

describe('continuidade da superfície do telhado (contornos côncavos)', () => {
  it('gerador: casos côncavos simples de 5–6 vértices, com empena e sem empena', () => {
    expect(CASES.length).toBe(300);
    expect(CASES.every((c) => c.ring.length >= 5 && c.ring.length <= 6)).toBe(true);
    expect(CASES.some((c) => c.slopes.some((s) => s === null))).toBe(true);
    expect(CASES.some((c) => c.slopes.every((s) => s !== null))).toBe(true);
  });

  it('todo contorno descontínuo sai com ok:true e tem pelo menos um vértice em steps (falhas silenciosas = 0)', () => {
    const tally: Record<Verdict, number> = { ok: 0, stepped: 0, silent: 0, 'false-step': 0, 'ok-false': 0 };
    const silentSamples: string[] = [];
    for (const c of CASES) {
      const w = c.slopes.map(weightOf);
      const res = weightedSkeleton({ outer: c.ring, holes: [], weights: [w] });
      const v = judge(c.ring, w, res);
      tally[v] += 1;
      if (v === 'silent' && silentSamples.length < 3) {
        silentSamples.push(JSON.stringify({ ring: c.ring, slopes: c.slopes }));
      }
    }
    const total = CASES.length;
    const pct = (n: number): string => ((100 * n) / total).toFixed(1);
    console.log(
      `[continuidade] n=${total} contínuos=${tally.ok} com degrau (descontínuos avisados)=${tally.stepped} (${pct(tally.stepped)}%) ` +
        `ok:false=${tally['ok-false']} falhas silenciosas=${tally.silent} (${pct(tally.silent)}%) degrau sem descontinuidade=${tally['false-step']}`,
    );
    expect(silentSamples).toEqual([]);
    expect(tally['false-step']).toBe(0);
  });

  it('contornos côncavos sem nenhuma empena continuam contínuos (regressão)', () => {
    const noNull = CASES.filter((c) => c.slopes.every((s) => s !== null));
    expect(noNull.length).toBeGreaterThan(0);
    for (const c of noNull) {
      const w = c.slopes.map(weightOf);
      const res = weightedSkeleton({ outer: c.ring, holes: [], weights: [w] });
      expect(judge(c.ring, w, res)).toBe('ok');
    }
  });

  it('caso fixo da auditoria: ok:true, a geometria não muda e o vértice (1;6) aparece em steps com degrau de 0,6 m', () => {
    const ring = [v2(2, 5), v2(0, 5), v2(0, 7), v2(3, 7), v2(1, 6)];
    const slopes = [60, 60, null, 60, null];
    const w = slopes.map(weightOf);
    const res = weightedSkeleton({ outer: ring, holes: [], weights: [w] });
    expect(res.ok).toBe(true);
    expect(res.faces.length).toBeGreaterThan(0);
    const step = (res.steps ?? []).find((s) => Math.hypot(s.x - 1, s.y - 6) < 1e-6);
    expect(step).toBeDefined();
    expect(step!.dz).toBeCloseTo(0.6, 6);
  });

  it('caso fixo da auditoria: pontos (1,025; 5,975) e (1,025; 6,025) a 5 cm têm Δz acima do limite, e o degrau é reportado', () => {
    const ring = [v2(2, 5), v2(0, 5), v2(0, 7), v2(3, 7), v2(1, 6)];
    const slopes = [60, 60, null, 60, null];
    const w = slopes.map(weightOf);
    const res = weightedSkeleton({ outer: ring, holes: [], weights: [w] });
    expect(res.ok).toBe(true);
    const a = faceAt(res.faces, v2(1.025, 5.975));
    const b = faceAt(res.faces, v2(1.025, 6.025));
    expect(a && b).toBeTruthy();
    const dz = Math.abs(planeZ(ring, w, a!.edge, v2(1.025, 5.975)) - planeZ(ring, w, b!.edge, v2(1.025, 6.025)));
    expect(dz).toBeGreaterThan(0.6 * 0.05 * 1.01 + 1e-6);
    expect((res.steps ?? []).length).toBeGreaterThan(0);
  });
});
