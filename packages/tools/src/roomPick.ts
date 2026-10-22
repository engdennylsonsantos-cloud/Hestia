import { pointInPolygon, type Vec2 } from '@hestia/geom';
import { resolveRooms } from '@hestia/engine';
import { isRoom, roomsOnLevel, type Id, type Project } from '@hestia/model';

/** Ambiente sob o cursor: o mais recente cujo circuito contém o ponto. Ambiente sem circuito não é selecionável por clique. */
export function pickRoomAt(p: Project, levelId: Id, at: Vec2): Id | null {
  let hit: Id | null = null;
  for (const r of resolveRooms(p, levelId)) if (r.polygon && pointInPolygon(at, r.polygon)) hit = r.roomId;
  return hit;
}

/**
 * Ambientes do nível cuja área cai na janela (esq→dir: contidos; dir→esq: que a cruzam, pela caixa). Ambientes sem
 * circuito não entram. Mesmo critério de janela das paredes e dos pisos.
 */
export function roomIdsInBox(p: Project, levelId: Id, a: Vec2, b: Vec2): Id[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const crossing = b.x < a.x;
  const ids: Id[] = [];
  for (const r of resolveRooms(p, levelId)) {
    if (!r.polygon) continue;
    const pts = r.polygon.flat();
    const bx0 = Math.min(...pts.map((q) => q.x));
    const bx1 = Math.max(...pts.map((q) => q.x));
    const by0 = Math.min(...pts.map((q) => q.y));
    const by1 = Math.max(...pts.map((q) => q.y));
    const inside = bx0 >= minX && bx1 <= maxX && by0 >= minY && by1 <= maxY;
    const overlap = bx0 <= maxX && bx1 >= minX && by0 <= maxY && by1 >= minY;
    if (crossing ? overlap : inside) ids.push(r.roomId);
  }
  return ids;
}

/** Ambientes entre os selecionados. */
export const selectedRooms = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isRoom(p.elements[id]));

/** Ambientes do nível com o mesmo nome dos selecionados (Revit: "Selecionar mesmo nome" para ambientes). */
export function sameNameRoomIds(p: Project, levelId: Id, selection: Id[]): Id[] {
  const names = new Set(selectedRooms(p, selection).map((id) => p.elements[id]).filter(isRoom).map((r) => r.name));
  if (names.size === 0) return [];
  return roomsOnLevel(p, levelId)
    .filter((r) => names.has(r.name))
    .map((r) => r.id);
}
