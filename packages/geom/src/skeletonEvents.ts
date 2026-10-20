import { dot, sub } from './vec.ts';
import { posAt, type Line, type Vtx } from './skeletonCore.ts';

export type Event =
  | { kind: 'edge'; t: number; r: number; i: number }
  | { kind: 'split'; t: number; r: number; i: number; r2: number; j: number; at: HitAt };

/** Onde o vértice reflexo toca a aresta: no meio, ou num extremo (evento vértice-vértice). */
export type HitAt = 'mid' | 'start' | 'end';

/** Vértice reflexo (do lado do material): a aresta de saída curva para fora do material. */
const isReflex = (v: Vtx): boolean => dot(v.inL.n, v.outL.dir) < -1e-9;

/** Instante em que a aresta P→Q encolhe a zero (None se não encolhe a partir de T). */
function edgeTime(P: Vtx, Q: Vtx, T: number): number | null {
  const d = P.outL.dir;
  const A = dot(d, sub(Q.p0, P.p0));
  const B = dot(d, sub(Q.v, P.v));
  if (B > -1e-12) return null;
  if (A + B * T < -1e-7) return null;
  return Math.max(-A / B, T);
}

/**
 * Instante em que o vértice reflexo V toca a aresta K (piece P→Q), com o ponto de contato
 * dentro do intervalo da aresta naquele instante. Null se não há contato futuro.
 */
function splitTime(V: Vtx, K: Line, P: Vtx, Q: Vtx, T: number): { t: number; at: HitAt } | null {
  const den = dot(K.n, V.v) - K.s;
  if (Math.abs(den) < 1e-12) return null;
  const t0 = (K.c - dot(K.n, V.p0)) / den;
  if (t0 < T - 1e-9) return null;
  const t = Math.max(t0, T);
  if (dot(K.n, posAt(V, T)) - (K.c + K.s * T) < -1e-9) return null;
  const X = posAt(V, t);
  const A = posAt(P, t);
  const B = posAt(Q, t);
  const u = dot(K.dir, sub(X, A));
  const len = dot(K.dir, sub(B, A));
  if (u < -1e-9 || u > len + 1e-9) return null;
  const at: HitAt = u <= 1e-7 ? 'start' : len - u <= 1e-7 ? 'end' : 'mid';
  return { t, at };
}

/** Próximo evento (o mais cedo; em empate vence o de aresta). Null se não há mais eventos. */
export function nextEvent(rings: Vtx[][], T: number): Event | null {
  let best: Event | null = null;
  const take = (e: Event): void => {
    if (best === null || e.t < best.t - 1e-12) best = e;
  };
  for (let r = 0; r < rings.length; r++) {
    const R = rings[r]!;
    const m = R.length;
    for (let i = 0; i < m; i++) {
      const t = edgeTime(R[i]!, R[(i + 1) % m]!, T);
      if (t !== null) take({ kind: 'edge', t, r, i });
    }
  }
  for (let r = 0; r < rings.length; r++) {
    const R = rings[r]!;
    for (let i = 0; i < R.length; i++) {
      const V = R[i]!;
      if (!isReflex(V)) continue;
      for (let r2 = 0; r2 < rings.length; r2++) {
        const R2 = rings[r2]!;
        const m2 = R2.length;
        for (let j = 0; j < m2; j++) {
          const h = splitTime(V, R2[j]!.outL, R2[j]!, R2[(j + 1) % m2]!, T);
          if (h !== null) take({ kind: 'split', t: h.t, r, i, r2, j, at: h.at });
        }
      }
    }
  }
  return best;
}
