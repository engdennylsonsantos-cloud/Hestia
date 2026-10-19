import { isFloor, isOpening, isWall, newId, type Command, type Floor, type Id, type Opening, type Project, type Wall } from '@hestia/model';

/** Buffer de copiar/colar: paredes e as aberturas hospedadas nelas, e os pisos, como estavam ao copiar. */
export interface ClipBuffer {
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
}

/** Gerador de identificadores; injetável para teste. */
export type MintId = (prefix: string) => Id;

/**
 * Copia as paredes e os pisos selecionados e as aberturas que estão nas paredes. Aberturas selecionadas sem a
 * parede não entram: sem anfitriã não há como colá-las. Devolve null se não há parede nem piso a copiar.
 */
export function clipboardFrom(p: Project, ids: Id[]): ClipBuffer | null {
  const hostIds = new Set(ids.filter((id) => isWall(p.elements[id])));
  const floors = ids.map((id) => p.elements[id]).filter(isFloor).map((f) => structuredClone(f));
  if (hostIds.size === 0 && floors.length === 0) return null;
  const walls = [...hostIds].map((id) => structuredClone(p.elements[id] as Wall));
  const openings = Object.values(p.elements)
    .filter(isOpening)
    .filter((o) => hostIds.has(o.hostId))
    .map((o) => structuredClone(o));
  return { walls, openings, floors };
}

/**
 * Comando de lote que cola o buffer no nível `levelId` nas MESMAS coordenadas, com ids novos e ordem nova.
 * Aberturas com tipo inexistente neste projeto são descartadas (evita tipo ausente na renderização).
 * Tipo de parede inexistente cai no padrão do projeto. Devolve null se nada seria colado.
 */
export function pasteAlignedCommand(
  p: Project,
  clip: ClipBuffer,
  levelId: Id,
  mint: MintId = (prefix) => newId(prefix),
): { command: Command; wallIds: Id[]; openingIds: Id[]; floorIds: Id[] } | null {
  if (!p.levels.some((l) => l.id === levelId) || (clip.walls.length === 0 && clip.floors.length === 0)) return null;
  const commands: Command[] = [];
  const floorIds: Id[] = [];
  for (const f of clip.floors) {
    const id = mint('f');
    floorIds.push(id);
    const { order: _order, ...rest } = f;
    const typeId = p.floorTypes[f.typeId] ? f.typeId : (Object.keys(p.floorTypes)[0] ?? f.typeId);
    commands.push({ type: 'addFloor', floor: { ...rest, id, levelId, typeId } });
  }
  const hostMap = new Map<Id, Id>();
  const wallIds: Id[] = [];
  for (const w of clip.walls) {
    const id = mint('w');
    hostMap.set(w.id, id);
    wallIds.push(id);
    const typeId = p.wallTypes[w.typeId] ? w.typeId : p.defaults.wallTypeId;
    commands.push({ type: 'addWall', wall: { ...w, id, levelId, typeId } });
  }
  const openingIds: Id[] = [];
  for (const o of clip.openings) {
    const hostId = hostMap.get(o.hostId);
    if (!hostId || !p.openingTypes[o.typeId]) continue;
    const id = mint(o.kind === 'door' ? 'd' : 'j');
    openingIds.push(id);
    commands.push({ type: 'addOpening', opening: { ...o, id, hostId } });
  }
  return { command: { type: 'batch', commands }, wallIds, openingIds, floorIds };
}
