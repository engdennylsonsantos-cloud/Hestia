import { EPS, add, cross, dot, mul, sub, type Vec2 } from './vec.ts';

/** Interseção de duas retas infinitas (ponto + direção). Null se paralelas. */
export function intersectLines(p: Vec2, d: Vec2, q: Vec2, e: Vec2): { point: Vec2; t: number; u: number } | null {
  const den = cross(d, e);
  if (Math.abs(den) < EPS) return null;
  const qp = sub(q, p);
  const t = cross(qp, e) / den;
  const u = cross(qp, d) / den;
  return { point: add(p, mul(d, t)), t, u };
}

/** Interseção de dois segmentos fechados. Null se não se tocam ou são paralelos. */
export function intersectSegments(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = intersectLines(a, sub(b, a), c, sub(d, c));
  if (!r) return null;
  const tol = 1e-9;
  if (r.t < -tol || r.t > 1 + tol || r.u < -tol || r.u > 1 + tol) return null;
  return r.point;
}

/** Parâmetro t∈[0,1] da projeção de p sobre o segmento a→b. */
export function projectParam(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < EPS) return 0;
  return Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
}

export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const t = projectParam(p, a, b);
  return add(a, mul(sub(b, a), t));
}

/** Distância assinada de p à reta a→b (positiva à esquerda de a→b). */
export function signedDistToLine(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l = Math.hypot(ab.x, ab.y);
  return l < EPS ? 0 : cross(ab, sub(p, a)) / l;
}
