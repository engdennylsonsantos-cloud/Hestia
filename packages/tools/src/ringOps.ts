import { add, cross, dot, len, mul, norm, perp, sub, type Vec2 } from '@hestia/geom';
import type { RingOps } from './ringEdge.ts';

/** Interseção da reta `p + d·t` com a reta `q + e·u`. Null se paralelas (|cross| relativo < 1e-9). */
function intersectRay(p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 | null {
  const den = cross(d, e);
  if (Math.abs(den) <= 1e-9 * len(d) * len(e)) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}

/** Índice válido de aresta/vértice (inteiro em [0, n)). */
function validIndex(i: number, n: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < n;
}

export const ringOps: RingOps = {
  moveEdge(ring, i, d) {
    const n = ring.length;
    const out = ring.slice();
    if (!validIndex(i, n)) return out;
    const j = (i + 1) % n;
    out[i] = add(ring[i]!, d);
    out[j] = add(ring[j]!, d);
    return out;
  },

  insertVertex(ring, i, at) {
    const n = ring.length;
    if (!validIndex(i, n)) return ring.slice();
    return [...ring.slice(0, i + 1), { x: at.x, y: at.y }, ...ring.slice(i + 1)];
  },

  moveEdgeEnd(ring, i, end, to) {
    const n = ring.length;
    const out = ring.slice();
    if (!validIndex(i, n)) return out;
    const k = end === 'a' ? i : (i + 1) % n;
    out[k] = { x: to.x, y: to.y };
    return out;
  },

  intersectEdgeLine(ring, i, p, q) {
    const n = ring.length;
    if (!validIndex(i, n)) return null;
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    return intersectRay(a, sub(b, a), p, sub(q, p));
  },

  offsetEdge(ring, i, dist) {
    const n = ring.length;
    const out = ring.slice();
    if (!validIndex(i, n) || dist === 0) return out;

    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    const dir = sub(b, a);
    const shift = mul(perp(norm(dir)), dist);
    const a2 = add(a, shift);
    const b2 = add(b, shift);

    // Início: interseção com a aresta anterior (i-1, de ring[i-1] até a).
    const prev = ring[(i - 1 + n) % n]!;
    const na = intersectRay(a2, dir, prev, sub(a, prev)) ?? a2;

    // Fim: interseção com a aresta seguinte (i+1, de b até ring[i+2]).
    const next = ring[(i + 2) % n]!;
    const nb = intersectRay(b2, dir, b, sub(next, b)) ?? b2;

    out[i] = na;
    out[(i + 1) % n] = nb;
    return out;
  },

  alignEdgeToLine(ring, i, p, q) {
    const n = ring.length;
    const out = ring.slice();
    if (!validIndex(i, n)) return out;
    const pq = sub(q, p);
    const l2 = dot(pq, pq);
    if (l2 < 1e-18) return out;
    const project = (v: Vec2): Vec2 => add(p, mul(pq, dot(sub(v, p), pq) / l2));
    const j = (i + 1) % n;
    out[i] = project(ring[i]!);
    out[j] = project(ring[j]!);
    return out;
  },
};
