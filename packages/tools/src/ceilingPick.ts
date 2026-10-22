import { pointInMulti, type Vec2 } from '@hestia/geom';
import { resolveCeilings } from '@hestia/engine';
import { viewRangeOf, type Id, type Project } from '@hestia/model';

/**
 * Forro sob o cursor, só na planta de forro (direção 'up'): dentro da geometria do forro (contorno menos furos) ou sobre a
 * borda do contorno. O mais recente vence. Na planta baixa forro não é desenhado, então não é clicável (decisão 0021).
 */
export function pickCeilingAt(p: Project, levelId: Id, at: Vec2, mpp: number): Id | null {
  if (viewRangeOf(p, levelId).direction !== 'up') return null;
  const tol = 4 * mpp;
  const list = resolveCeilings(p, levelId);
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i]!;
    if (pointInMulti(at, c.polygon)) return c.ceilingId;
    const e = p.elements[c.ceilingId];
    if (e?.kind === 'ceiling' && e.boundary.some((a, k) => distToSeg(at, a, e.boundary[(k + 1) % e.boundary.length]!) <= tol)) return c.ceilingId;
  }
  return null;
}

function distToSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
