import { boxOf, closestOnSegment, dist, intersectSegments, pointInMulti, type Vec2 } from '@hestia/geom';
import { resolveSlabs } from '@hestia/engine';
import { isSlab, slabsOnLevel, type Id, type Project, type Slab } from '@hestia/model';

/** Lajes entre os selecionados. */
export const selectedSlabs = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isSlab(p.elements[id]));

/** Alça de uma laje: vértice (índice do contorno) ou meio de uma aresta (aresta i vai de i a i+1). */
export interface SlabGrip {
  slabId: Id;
  kind: 'vertex' | 'edge';
  index: number;
  at: Vec2;
}

const distToEdge = (q: Vec2, a: Vec2, b: Vec2): number => dist(q, closestOnSegment(q, a, b));

function onBoundary(s: Slab, at: Vec2, tol: number): boolean {
  const rings = [s.boundary, ...s.holes];
  return rings.some((r) => r.some((a, i) => distToEdge(at, a, r[(i + 1) % r.length]!) <= tol));
}

/**
 * Laje sob o cursor: dentro da geometria resolvida (contorno menos furos e aberturas de escada) ou sobre a borda do
 * contorno cru. A mais recente vence.
 */
export function pickSlabAt(p: Project, levelId: Id, at: Vec2, mpp: number): Id | null {
  const tol = 4 * mpp;
  const slabs = slabsOnLevel(p, levelId);
  const shape = new Map(resolveSlabs(p, levelId).map((r) => [r.slabId, r.polygon] as const));
  for (let i = slabs.length - 1; i >= 0; i--) {
    const s = slabs[i]!;
    if (onBoundary(s, at, tol)) return s.id;
    const poly = shape.get(s.id);
    if (poly && pointInMulti(at, poly)) return s.id;
  }
  return null;
}

/** Lajes cujo contorno cabe na janela (esq→dir) ou que a cruzam (dir→esq), como nos pisos. */
export function slabIdsInBox(p: Project, levelId: Id, a: Vec2, b: Vec2): Id[] {
  const box = boxOf([a, b]);
  const crossing = b.x < a.x;
  const inside = (q: Vec2): boolean => q.x >= box.minX && q.x <= box.maxX && q.y >= box.minY && q.y <= box.maxY;
  const corners: Vec2[] = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
  const hits = (ring: Vec2[]): boolean =>
    ring.some((q, i) => inside(q) || corners.some((c, k) => intersectSegments(q, ring[(i + 1) % ring.length]!, c, corners[(k + 1) % 4]!) !== null));
  return slabsOnLevel(p, levelId)
    .filter((s) => (s.boundary.every(inside) ? true : crossing && hits(s.boundary)))
    .map((s) => s.id);
}

/** Alça sob o cursor entre as lajes selecionadas: vértices têm prioridade sobre o meio das arestas. */
export function slabGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): SlabGrip | null {
  const tol = 9 * mpp;
  const slabs = selectedSlabs(p, ids).map((id) => p.elements[id]).filter(isSlab);
  for (const s of slabs) {
    const i = s.boundary.findIndex((q) => dist(q, at) <= tol);
    if (i >= 0) return { slabId: s.id, kind: 'vertex', index: i, at: s.boundary[i]! };
  }
  for (const s of slabs) {
    const r = s.boundary;
    for (let i = 0; i < r.length; i++) {
      const m = { x: (r[i]!.x + r[(i + 1) % r.length]!.x) / 2, y: (r[i]!.y + r[(i + 1) % r.length]!.y) / 2 };
      if (dist(m, at) <= tol) return { slabId: s.id, kind: 'edge', index: i, at: m };
    }
  }
  return null;
}
