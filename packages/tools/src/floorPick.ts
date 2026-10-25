import { boxOf, dist, intersectSegments, pointInMulti, ringArea, type Vec2 } from '@hestia/geom';
import { floorsOnLevel, isFloor, type Floor, type Id, type Project } from '@hestia/model';
import { formasDoNivel } from './pickShapes.ts';

/** Pisos entre os selecionados. */
export const selectedFloors = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isFloor(p.elements[id]));

/** Ponto de alça de um piso: vértice (índice do contorno) ou meio de uma aresta (aresta i vai de i a i+1). */
export interface FloorGrip {
  floorId: Id;
  kind: 'vertex' | 'edge';
  index: number;
  at: Vec2;
}

/**
 * Piso sob o cursor: dentro da geometria resolvida (contorno menos furos e aberturas de escada) ou sobre a borda do
 * contorno cru. O mais recente vence.
 */
export function pickFloorAt(p: Project, levelId: Id, at: Vec2, mpp: number): Id | null {
  const tol = 4 * mpp;
  const floors = floorsOnLevel(p, levelId);
  const shape = formasDoNivel(p, levelId, 'piso');
  for (let i = floors.length - 1; i >= 0; i--) {
    const f = floors[i]!;
    if (onBoundary(f, at, tol)) return f.id;
    const poly = shape.get(f.id);
    if (poly && pointInMulti(at, poly)) return f.id;
  }
  return null;
}

function onBoundary(f: Floor, at: Vec2, tol: number): boolean {
  const rings = [f.boundary, ...f.holes];
  return rings.some((r) => r.some((a, i) => distToSegment(at, a, r[(i + 1) % r.length]!) <= tol));
}

function distToSegment(q: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
  return dist(q, { x: a.x + dx * t, y: a.y + dy * t });
}

/** Pisos cujo contorno cabe na janela (esq→dir) ou que a cruzam (dir→esq), como nas paredes. */
export function floorIdsInBox(p: Project, levelId: Id, a: Vec2, b: Vec2): Id[] {
  const box = boxOf([a, b]);
  const crossing = b.x < a.x;
  const inside = (q: Vec2): boolean => q.x >= box.minX && q.x <= box.maxX && q.y >= box.minY && q.y <= box.maxY;
  const corners: Vec2[] = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
  const ids: Id[] = [];
  for (const f of floorsOnLevel(p, levelId)) {
    const ring = f.boundary;
    if (ring.every(inside)) {
      ids.push(f.id);
      continue;
    }
    if (crossing && ring.some((q, i) => inside(q) || corners.some((c, k) => intersectSegments(q, ring[(i + 1) % ring.length]!, c, corners[(k + 1) % 4]!) !== null))) ids.push(f.id);
  }
  return ids;
}

/** Alça sob o cursor entre os pisos selecionados: vértices têm prioridade sobre o meio das arestas. */
export function floorGripAt(p: Project, ids: Id[], at: Vec2, mpp: number): FloorGrip | null {
  const tol = 9 * mpp;
  const floors = selectedFloors(p, ids).map((id) => p.elements[id]).filter(isFloor);
  for (const f of floors) {
    const r = f.boundary;
    const i = r.findIndex((q) => dist(q, at) <= tol);
    if (i >= 0) return { floorId: f.id, kind: 'vertex', index: i, at: r[i]! };
  }
  for (const f of floors) {
    const r = f.boundary;
    for (let i = 0; i < r.length; i++) {
      const m = { x: (r[i]!.x + r[(i + 1) % r.length]!.x) / 2, y: (r[i]!.y + r[(i + 1) % r.length]!.y) / 2 };
      if (dist(m, at) <= tol) return { floorId: f.id, kind: 'edge', index: i, at: m };
    }
  }
  return null;
}

/** Contorno com o vértice `i` trocado por `pt`. */
export const ringMoveVertex = (ring: Vec2[], i: number, pt: Vec2): Vec2[] => ring.map((q, k) => (k === i ? pt : q));

/** Contorno com um vértice novo logo depois do índice `i` (a aresta i→i+1 é dividida em `pt`). */
export const ringInsertAfter = (ring: Vec2[], i: number, pt: Vec2): Vec2[] => [...ring.slice(0, i + 1), pt, ...ring.slice(i + 1)];

/** Contorno sem o vértice `i`; null se sobrariam menos de 3 vértices. */
export function ringRemoveVertex(ring: Vec2[], i: number): Vec2[] | null {
  if (ring.length <= 3) return null;
  return ring.filter((_, k) => k !== i);
}

/** Área do contorno (sem furos), em m². */
export const ringAreaAbs = (ring: Vec2[]): number => Math.abs(ringArea(ring));

/** Vértices de contorno e de furo dos pisos do nível: candidatos de captura para alinhar pisos entre si (sem lajes). */
export function floorVertices(p: Project, levelId: Id): Vec2[] {
  return floorsOnLevel(p, levelId).flatMap((f) => [...f.boundary, ...f.holes.flat()]);
}

/** Perímetro do contorno, em m. */
export function ringPerimeter(ring: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) s += dist(ring[i]!, ring[(i + 1) % ring.length]!);
  return s;
}
