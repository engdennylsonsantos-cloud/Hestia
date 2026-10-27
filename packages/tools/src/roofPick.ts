import { arcFromSagitta, arcPointAt, boxOf, closestOnSegment, dist, intersectSegments, pointInRing, type Vec2 } from '@hestia/geom';
import { roofOutline } from './perimeterRoofArcs.ts';
import { isRoof, roofEdgeSag, roofsOnLevel, type Id, type Project, type Roof } from '@hestia/model';

/** Telhados entre os selecionados. */
export const selectedRoofs = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isRoof(p.elements[id]));

/**
 * Alça de um telhado: vértice (índice do contorno do beiral), meio de uma aresta reta (aresta i vai de i a i+1; insere
 * vértice) ou meio de um arco ('sag': arrastar muda a flecha `edgeSag`, `at` é o meio do arco).
 */
export interface RoofGrip {
  roofId: Id;
  kind: 'vertex' | 'edge' | 'sag';
  index: number;
  at: Vec2;
}

const distToEdge = (q: Vec2, a: Vec2, b: Vec2): number => dist(q, closestOnSegment(q, a, b));

function onBoundary(r: Roof, at: Vec2, tol: number): boolean {
  const rings = [roofOutline(r), ...r.holes];
  return rings.some((ring) => ring.some((a, i) => distToEdge(at, a, ring[(i + 1) % ring.length]!) <= tol));
}

/**
 * Telhado sob o cursor: dentro do beiral (menos furos) ou sobre a borda. O mais recente vence. Chamada só depois de
 * aberturas, paredes, pisos e lajes: o telhado é o último da prioridade de seleção.
 */
export function pickRoofAt(p: Project, levelId: Id, at: Vec2, mpp: number): Id | null {
  const tol = 4 * mpp;
  const roofs = roofsOnLevel(p, levelId);
  for (let i = roofs.length - 1; i >= 0; i--) {
    const r = roofs[i]!;
    if (onBoundary(r, at, tol)) return r.id;
    if (pointInRing(at, roofOutline(r)) && !r.holes.some((h) => pointInRing(at, h))) return r.id;
  }
  return null;
}

/** Telhados cujo beiral cabe na janela (esq→dir) ou que a cruzam (dir→esq), como nas lajes. */
export function roofIdsInBox(p: Project, levelId: Id, a: Vec2, b: Vec2): Id[] {
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
  return roofsOnLevel(p, levelId)
    .filter((r) => (roofOutline(r).every(inside) ? true : crossing && hits(roofOutline(r))))
    .map((r) => r.id);
}

/** Alça sob o cursor entre os telhados selecionados: vértices têm prioridade sobre o meio das arestas. */
export function roofGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): RoofGrip | null {
  const tol = 9 * mpp;
  const roofs = selectedRoofs(p, ids).map((id) => p.elements[id]).filter(isRoof);
  for (const r of roofs) {
    const i = r.boundary.findIndex((q) => dist(q, at) <= tol);
    if (i >= 0) return { roofId: r.id, kind: 'vertex', index: i, at: r.boundary[i]! };
  }
  for (const r of roofs) {
    const ring = r.boundary;
    for (let i = 0; i < ring.length; i++) {
      const m = edgeGripPoint(r, i);
      if (dist(m, at) <= tol) return { roofId: r.id, kind: roofEdgeSag(r, i) !== 0 ? 'sag' : 'edge', index: i, at: m };
    }
  }
  return null;
}

/** Ponto da alça do meio da aresta `i`: o meio da corda, ou o meio do arco quando a aresta tem flecha. */
export function edgeGripPoint(r: Roof, i: number): Vec2 {
  const a = r.boundary[i]!;
  const b = r.boundary[(i + 1) % r.boundary.length]!;
  const arc = arcFromSagitta(a, b, roofEdgeSag(r, i));
  return arc ? arcPointAt(arc, arc.length / 2) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
