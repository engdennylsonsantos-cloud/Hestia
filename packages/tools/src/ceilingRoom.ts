import { pointInMulti, type Vec2 } from '@hestia/geom';
import { ceilingDraftsFromRooms, resolveRooms, type CeilingDraft } from '@hestia/engine';
import { newId, type Id, type Project } from '@hestia/model';

/**
 * Rascunho de forro do ambiente sob o ponto (modo "Forro no ambiente", decisão 0021): o ambiente do nível cujo circuito
 * contém o ponto, com o contorno, os furos e o pé-direito dele. Null quando o ponto não cai num ambiente válido.
 */
export function roomCeilingAt(p: Project, levelId: Id, at: Vec2, typeId: Id): CeilingDraft | null {
  const room = resolveRooms(p, levelId).find((r) => r.polygon !== null && r.problem === null && r.duplicateOf === undefined && pointInMulti(at, [r.polygon]));
  if (!room) return null;
  return ceilingDraftsFromRooms(p, levelId, typeId, () => newId('f')).find((d) => d.roomId === room.roomId) ?? null;
}
