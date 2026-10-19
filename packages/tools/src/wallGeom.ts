import { arcFromSagitta, arcLocal, arcPointAt, closestOnSegment, dist, mid, projectParam, type Vec2 } from '@hestia/geom';
import type { Wall } from '@hestia/model';

/** Ponto do eixo mais próximo de p, com a posição t ao longo do eixo (comprimento de arco nas curvas). */
export function closestOnWall(w: Wall, p: Vec2): { point: Vec2; t: number; dist: number } {
  const arc = arcFromSagitta(w.a, w.b, w.sag);
  if (arc) {
    const t = Math.max(0, Math.min(arc.length, arcLocal(arc, p).t));
    const point = arcPointAt(arc, t);
    return { point, t, dist: dist(point, p) };
  }
  const point = closestOnSegment(p, w.a, w.b);
  return { point, t: projectParam(p, w.a, w.b) * dist(w.a, w.b), dist: dist(point, p) };
}

/** Ponto médio do eixo (no meio do arco, nas curvas). */
export function wallMid(w: Wall): Vec2 {
  const arc = arcFromSagitta(w.a, w.b, w.sag);
  return arc ? arcPointAt(arc, arc.length / 2) : mid(w.a, w.b);
}
