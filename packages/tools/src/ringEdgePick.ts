import { dist, type Vec2 } from '@hestia/geom';
import { ceilingOutline } from '@hestia/engine';
import { isCeiling, isFloor, isRoof, isSlab, type Id, type Project } from '@hestia/model';
import type { EdgePick, EdgeRef } from './ringEdge.ts';

/** Diferença (m) abaixo da qual duas distâncias contam como iguais: vence o elemento mais recente. */
const TIE_EPS = 1e-9;

/**
 * Aresta de anel (contorno externo ou furo) de piso, laje, telhado ou forro do nível, sob o cursor. Escolhe a aresta
 * mais próxima do cursor dentro de `4 * mpp`; em empate quase exato vence o elemento mais recente (último em
 * `p.elements`). Paredes ficam por conta de `pickAt`. Telhado usa o anel do beiral (`boundary`).
 */
export function pickRingEdgeAt(p: Project, levelId: Id, at: Vec2, mpp: number): EdgePick | null {
  const tol = 4 * mpp;
  let best: { d: number; pick: EdgePick } | null = null;
  for (const e of Object.values(p.elements)) {
    if (!(isFloor(e) || isSlab(e) || isRoof(e) || isCeiling(e))) continue;
    if (e.levelId !== levelId) continue;
    // Forro que acompanha o ambiente é desenhado pelo contorno do ambiente (ceilingOutline), não pelo boundary cru.
    const shape = isCeiling(e) ? ceilingOutline(p, e) : e;
    const rings: Array<{ ring: Vec2[]; hole: number | null }> = [{ ring: shape.boundary, hole: null }, ...shape.holes.map((h, i) => ({ ring: h, hole: i }))];
    for (const { ring, hole } of rings) {
      const n = ring.length;
      if (n < 2) continue;
      for (let i = 0; i < n; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % n]!;
        const near = nearestOnSegment(at, a, b);
        const d = dist(at, near);
        if (d > tol) continue;
        const ref: EdgeRef = { elementId: e.id, hole, index: i };
        if (!best || d < best.d - TIE_EPS || Math.abs(d - best.d) <= TIE_EPS) {
          best = { d, pick: { ref, a: { ...a }, b: { ...b }, at: near } };
        }
      }
    }
  }
  return best ? best.pick : null;
}

/** Ponto do segmento a→b mais próximo de q. */
function nearestOnSegment(q: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
  return { x: a.x + dx * t, y: a.y + dy * t };
}
