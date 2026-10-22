import { isFloor, isOpening, isRoof, isRoom, isSlab, isStair, isWall, newId, type Command, type Floor, type Id, type Opening, type Project, type Room, type Roof, type Slab, type Stair, type Wall } from '@hestia/model';
import { stairTypeId } from './stairCommands.ts';

/** Buffer de copiar/colar: paredes e as aberturas hospedadas nelas, e os pisos, lajes e telhados, como estavam ao copiar. */
export interface ClipBuffer {
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  slabs: Slab[];
  roofs: Roof[];
  /** Escadas (ausente em buffers antigos = nenhuma). */
  stairs?: Stair[];
  /** Ambientes (ausente em buffers antigos = nenhum). Colados nas mesmas coordenadas do ponto interior. */
  rooms?: Room[];
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
  const slabs = ids.map((id) => p.elements[id]).filter(isSlab).map((s) => structuredClone(s));
  const roofs = ids.map((id) => p.elements[id]).filter(isRoof).map((r) => structuredClone(r));
  const stairs = ids.map((id) => p.elements[id]).filter(isStair).map((s) => structuredClone(s));
  const rooms = ids.map((id) => p.elements[id]).filter(isRoom).map((r) => structuredClone(r));
  if (hostIds.size === 0 && floors.length === 0 && slabs.length === 0 && roofs.length === 0 && stairs.length === 0 && rooms.length === 0) return null;
  const walls = [...hostIds].map((id) => structuredClone(p.elements[id] as Wall));
  const openings = Object.values(p.elements)
    .filter(isOpening)
    .filter((o) => hostIds.has(o.hostId))
    .map((o) => structuredClone(o));
  return { walls, openings, floors, slabs, roofs, stairs, rooms };
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
): { command: Command; wallIds: Id[]; openingIds: Id[]; floorIds: Id[]; slabIds: Id[]; roofIds: Id[]; stairIds: Id[]; roomIds: Id[] } | null {
  const stairs = clip.stairs ?? [];
  const rooms = clip.rooms ?? [];
  if (!p.levels.some((l) => l.id === levelId) || (clip.walls.length === 0 && clip.floors.length === 0 && clip.slabs.length === 0 && clip.roofs.length === 0 && stairs.length === 0 && rooms.length === 0)) return null;
  const commands: Command[] = [];
  const roomIds: Id[] = [];
  for (const r of rooms) {
    const id = mint('rm');
    roomIds.push(id);
    const { order: _order, ...rest } = r;
    commands.push({ type: 'addRoom', room: { ...rest, id, levelId } });
  }
  const floorIds: Id[] = [];
  const slabIds: Id[] = [];
  const roofIds: Id[] = [];
  const stairIds: Id[] = [];
  for (const s of stairs) {
    const id = mint('st');
    stairIds.push(id);
    const { order: _order, ...rest } = s;
    const typeId = p.stairTypes[s.typeId] ? s.typeId : stairTypeId(p);
    const components = rest.components.map((c) => ({ ...c, id: mint(c.kind === 'run' ? 'r' : 'p') }));
    commands.push({ type: 'addStair', stair: { ...rest, id, levelId, typeId: typeId ?? s.typeId, components } });
  }
  for (const r of clip.roofs) {
    const id = mint('t');
    roofIds.push(id);
    const { order: _order, ...rest } = r;
    const typeId = p.roofTypes[r.typeId] ? r.typeId : (Object.keys(p.roofTypes)[0] ?? r.typeId);
    commands.push({ type: 'addRoof', roof: { ...rest, id, levelId, typeId } });
  }
  for (const s of clip.slabs) {
    const id = mint('l');
    slabIds.push(id);
    const { order: _order, ...rest } = s;
    const typeId = p.slabTypes[s.typeId] ? s.typeId : (Object.keys(p.slabTypes)[0] ?? s.typeId);
    commands.push({ type: 'addSlab', slab: { ...rest, id, levelId, typeId } });
  }
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
  return { command: { type: 'batch', commands }, wallIds, openingIds, floorIds, slabIds, roofIds, stairIds, roomIds };
}
