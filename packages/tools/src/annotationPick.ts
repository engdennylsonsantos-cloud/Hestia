import { dist, dot, len, sub, type Vec2 } from '@hestia/geom';
import { dimensionGeometry, dimensionPoints, levelDimensions, levelTexts, wallsOnLevel, type DimensionRef, type Id, type Project } from '@hestia/model';

/** Tolerância (m) para dizer que um ponto é a extremidade de uma parede. */
const END_TOL = 1e-4;

/**
 * Referência a uma extremidade de parede do nível quando o ponto cai nela (a cota passa a acompanhar a parede).
 * Ponto no meio da face ou no vazio: sem referência, a cota fica livre.
 */
export function endRefAt(p: Project, levelId: Id, point: Vec2): DimensionRef | undefined {
  for (const w of wallsOnLevel(p, levelId)) {
    if (dist(w.a, point) <= END_TOL) return { wallId: w.id, end: 'a' };
    if (dist(w.b, point) <= END_TOL) return { wallId: w.id, end: 'b' };
  }
  return undefined;
}

/** Normal esquerda da direção a→b (unitária), ou null se a ou b coincidem. */
export function leftNormal(a: Vec2, b: Vec2): Vec2 | null {
  const d = sub(b, a);
  const l = len(d);
  if (l < 1e-9) return null;
  return { x: -d.y / l, y: d.x / l };
}

/** Distância com sinal do ponto `q` à reta a–b, medida no lado da normal esquerda de a→b. */
export const signedOffset = (a: Vec2, b: Vec2, q: Vec2): number => {
  const n = leftNormal(a, b);
  return n ? dot(sub(q, a), n) : 0;
};

/** Distância de `q` ao segmento p–r. */
function distToSegment(q: Vec2, p: Vec2, r: Vec2): number {
  const d = sub(r, p);
  const l2 = dot(d, d);
  const t = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(q, p), d) / l2)) : 0;
  return dist(q, { x: p.x + d.x * t, y: p.y + d.y * t });
}

/** Cota ou texto de anotação sob o cursor (tolerância de 6 px; o texto vale pelo centro, ~10 px). */
export function annotationAt(p: Project, levelId: Id, at: Vec2, mpp: number): { id: Id; kind: 'dimension' | 'text' } | null {
  for (const t of levelTexts(p, levelId)) if (dist(at, t.at) <= 10 * mpp) return { id: t.id, kind: 'text' };
  for (const d of levelDimensions(p, levelId)) {
    const pts = dimensionPoints(p, d);
    const g = dimensionGeometry(pts.a, pts.b, d.offset, mpp * 4);
    for (const [s, e] of [g.line, ...g.extensions]) if (distToSegment(at, s, e) <= 6 * mpp) return { id: d.id, kind: 'dimension' };
  }
  return null;
}
