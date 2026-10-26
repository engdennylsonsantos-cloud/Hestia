import { boxOf, closestOnSegment, dist, intersectSegments, pointInRing, type Vec2 } from '@hestia/geom';
import { isRoof, roofsOnLevel, type Id, type Project, type Roof } from '@hestia/model';
import type { PreviewItem, RoofEdgeSel } from './types.ts';

/** Telhados entre os selecionados. */
export const selectedRoofs = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isRoof(p.elements[id]));

/** Alça de um telhado: vértice (índice do contorno do beiral) ou meio de uma aresta (aresta i vai de i a i+1). */
export interface RoofGrip {
  roofId: Id;
  kind: 'vertex' | 'edge';
  index: number;
  at: Vec2;
}

const distToEdge = (q: Vec2, a: Vec2, b: Vec2): number => dist(q, closestOnSegment(q, a, b));

function onBoundary(r: Roof, at: Vec2, tol: number): boolean {
  const rings = [r.boundary, ...r.holes];
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
    if (pointInRing(at, r.boundary) && !r.holes.some((h) => pointInRing(at, h))) return r.id;
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
    .filter((r) => (r.boundary.every(inside) ? true : crossing && hits(r.boundary)))
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
      const m = { x: (ring[i]!.x + ring[(i + 1) % ring.length]!.x) / 2, y: (ring[i]!.y + ring[(i + 1) % ring.length]!.y) / 2 };
      if (dist(m, at) <= tol) return { roofId: r.id, kind: 'edge', index: i, at: m };
    }
  }
  return null;
}

/** Índice da aresta do contorno de `r` mais perto de `at`, dentro de `tol` (em empate, a última); -1 se nenhuma. */
function edgeIndexAt(r: Roof, at: Vec2, tol: number): number {
  const n = r.boundary.length;
  let index = -1;
  let best = tol;
  for (let i = 0; i < n; i++) {
    const d = distToEdge(at, r.boundary[i]!, r.boundary[(i + 1) % n]!);
    if (d <= best) {
      best = d;
      index = i;
    }
  }
  return index;
}

/** Aresta do contorno do beiral sob o cursor (tolerância de 8 px), quando só um telhado está selecionado. A mais próxima vence. */
export function roofEdgeAt(p: Project, ids: Id[], at: Vec2, mpp: number): RoofEdgeSel | null {
  const roofs = selectedRoofs(p, ids).map((id) => p.elements[id]).filter(isRoof);
  if (roofs.length !== 1) return null;
  const r = roofs[0]!;
  const index = edgeIndexAt(r, at, 8 * mpp);
  return index >= 0 ? { roofId: r.id, index } : null;
}

/**
 * Aresta do contorno de um telhado do nível que NÃO está entre `ids` (mesma tolerância de 8 px). O mais recente vence
 * entre telhados. Só vale quando não há a aresta de um telhado selecionado: `roofEdgeAt` tem a preferência.
 */
export function roofEdgeOnLevel(p: Project, levelId: Id, ids: Id[], at: Vec2, mpp: number): RoofEdgeSel | null {
  const sel = new Set(ids);
  const roofs = roofsOnLevel(p, levelId).filter((r) => !sel.has(r.id));
  for (let k = roofs.length - 1; k >= 0; k--) {
    const r = roofs[k]!;
    const index = edgeIndexAt(r, at, 8 * mpp);
    if (index >= 0) return { roofId: r.id, index };
  }
  return null;
}

/** Prévia da aresta escolhida na planta (destaque), enquanto o telhado segue selecionado. */
export function roofEdgePreview(p: Project, ids: Id[], sel: RoofEdgeSel | null): PreviewItem[] {
  const r = sel ? p.elements[sel.roofId] : undefined;
  if (!sel || !isRoof(r) || !r.boundary[sel.index] || !ids.includes(sel.roofId)) return [];
  return [{ kind: 'line', a: r.boundary[sel.index]!, b: r.boundary[(sel.index + 1) % r.boundary.length]! }, { kind: 'highlight', ids: [sel.roofId] }];
}

/** Pré-destaque da aresta sob o cursor (com ou sem o telhado selecionado): a planta o desenha em traço grosso. */
export function roofEdgeHoverPreview(p: Project, hover: RoofEdgeSel | null): PreviewItem[] {
  const r = hover ? p.elements[hover.roofId] : undefined;
  if (!hover || !isRoof(r) || !r.boundary[hover.index]) return [];
  return [{ kind: 'roofEdgeHover', a: r.boundary[hover.index]!, b: r.boundary[(hover.index + 1) % r.boundary.length]! }];
}
