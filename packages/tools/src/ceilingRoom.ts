import { pointInMulti, type Vec2 } from '@hestia/geom';
import { ceilingDraftsFromRooms, resolveRooms, type CeilingDraft } from '@hestia/engine';
import { ceilingsOnLevel, newId, type Command, type Id, type Project } from '@hestia/model';

/**
 * Rascunho de forro do ambiente sob o ponto (modo "Forro no ambiente", decisão 0021): o ambiente do nível cujo circuito
 * contém o ponto, com o contorno, os furos e o pé-direito dele. Null quando o ponto não cai num ambiente válido.
 */
export function roomCeilingAt(p: Project, levelId: Id, at: Vec2, typeId: Id): CeilingDraft | null {
  const room = resolveRooms(p, levelId).find((r) => r.polygon !== null && r.problem === null && r.duplicateOf === undefined && pointInMulti(at, [r.polygon]));
  if (!room) return null;
  return ceilingDraftsFromRooms(p, levelId, typeId, () => newId('f')).find((d) => d.roomId === room.roomId) ?? null;
}

/**
 * "Forro em todos os ambientes do nível" (E6, decisão 0021): um lote `addCeilings` com um forro por ambiente de circuito
 * fechado. Ambiente que já tem forro no nível fica de fora. O tipo é o preferido das opções, se existir; senão, o primeiro
 * do projeto. Null quando não há o que criar.
 */
export function ceilingsForAllRooms(p: Project, levelId: Id, preferredTypeId: Id | undefined, offset?: number): Extract<Command, { type: 'addCeilings' }> | null {
  const typeId = preferredTypeId && p.ceilingTypes[preferredTypeId] ? preferredTypeId : Object.keys(p.ceilingTypes)[0];
  if (!typeId) return null;
  const withCeiling = new Set(ceilingsOnLevel(p, levelId).map((c) => c.roomId).filter((id): id is Id => !!id));
  // `offset` (cota do topo das opções) substitui o pé-direito de cada ambiente, como no modo "No ambiente".
  const ceilings = ceilingDraftsFromRooms(p, levelId, typeId, () => newId('f'))
    .filter((d) => !d.roomId || !withCeiling.has(d.roomId))
    .map((d) => (offset === undefined ? d : { ...d, heightOffset: offset }));
  return ceilings.length ? { type: 'addCeilings', ceilings } : null;
}
