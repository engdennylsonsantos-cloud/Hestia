import { applyTransform, type Transform, type Vec2 } from '@hestia/geom';
import { wallLength } from './queries.ts';
import {
  isOpening,
  isWall,
  type Element,
  type Id,
  type JoinConfig,
  type Level,
  type Material,
  type Opening,
  type OpeningType,
  type Project,
  type Wall,
  type WallType,
} from './types.ts';
import { splitWall } from './splitWall.ts';

/** Comando = dados serializáveis. A única forma de escrever no modelo (docs/01 §5). */
export type Command =
  | { type: 'addWall'; wall: Omit<Wall, 'order'> }
  | { type: 'addOpening'; opening: Opening }
  | { type: 'updateElements'; ids: Id[]; patch: Partial<Wall> | Partial<Opening> }
  | { type: 'setWallEnds'; id: Id; a?: Vec2; b?: Vec2 }
  | { type: 'setJoin'; ends: Array<{ wallId: Id; end: 'a' | 'b' }>; config: JoinConfig }
  | { type: 'transform'; ids: Id[]; transform: Transform; copy?: { idMap: Record<Id, Id> } }
  | { type: 'splitWall'; id: Id; newId: Id; t: number; gap?: number; idMap?: Record<Id, Id> }
  | { type: 'deleteElements'; ids: Id[] }
  | { type: 'upsertWallType'; wallType: WallType }
  | { type: 'deleteWallType'; id: Id }
  | { type: 'upsertMaterial'; material: Material }
  | { type: 'upsertOpeningType'; openingType: OpeningType }
  | { type: 'upsertLevel'; level: Level }
  | { type: 'deleteLevel'; id: Id }
  | { type: 'setProjectName'; name: string }
  | { type: 'setDefaults'; patch: Partial<Project['defaults']> }
  | { type: 'setSettings'; patch: Partial<Project['settings']> }
  | { type: 'batch'; commands: Command[] };

function transformWall(w: Wall, t: Transform): Wall {
  const a = applyTransform(t, w.a);
  const b = applyTransform(t, w.b);
  // Espelhar inverte o lado externo: sem trocar `flipped` a pilha de camadas sairia do lado errado.
  // Espelhar também inverte o lado para o qual o arco abaulava.
  return { ...w, a, b, flipped: t.kind === 'mirror' ? !w.flipped : w.flipped, sag: t.kind === 'mirror' ? -w.sag : w.sag };
}

/** Garante que a abertura continue dentro da parede depois de qualquer edição. */
export function clampOffset(p: Project, o: Opening, wall: Wall): number {
  const t = p.openingTypes[o.typeId];
  const half = (t?.width ?? 0.8) / 2;
  const l = wallLength(wall);
  return Math.max(Math.min(half, l / 2), Math.min(o.offset, l - Math.min(half, l / 2)));
}

function removeIds(p: Project, ids: Id[]): void {
  const doomed = new Set(ids);
  for (const e of Object.values(p.elements)) if (isOpening(e) && doomed.has(e.hostId)) doomed.add(e.id);
  for (const id of doomed) delete p.elements[id];
}

function applyTransformCmd(p: Project, c: Extract<Command, { type: 'transform' }>): void {
  const idMap = c.copy?.idMap;
  const walls = c.ids.map((id) => p.elements[id]).filter(isWall);
  for (const w of walls) {
    const next = transformWall(w, c.transform);
    if (idMap) {
      const nid = idMap[w.id];
      if (!nid) continue;
      p.elements[nid] = { ...next, id: nid, order: p.nextOrder++ };
    } else {
      p.elements[w.id] = next;
    }
  }
  if (!idMap) return;
  // Cópia: leva as aberturas hospedadas junto, no mesmo deslocamento.
  for (const w of walls) {
    const nw = idMap[w.id];
    if (!nw) continue;
    for (const o of Object.values(p.elements).filter(isOpening)) {
      if (o.hostId !== w.id) continue;
      const nid = idMap[o.id];
      if (!nid) continue;
      const flip = c.transform.kind === 'mirror';
      p.elements[nid] = { ...o, id: nid, hostId: nw, flipHand: flip ? !o.flipHand : o.flipHand };
    }
  }
}

export function applyCommand(p: Project, c: Command): void {
  switch (c.type) {
    case 'addWall':
      p.elements[c.wall.id] = { ...c.wall, order: p.nextOrder++ };
      break;
    case 'addOpening': {
      const host = p.elements[c.opening.hostId];
      if (!isWall(host)) throw new Error('Abertura precisa de uma parede anfitriã');
      p.elements[c.opening.id] = { ...c.opening, offset: clampOffset(p, c.opening, host) };
      break;
    }
    case 'updateElements':
      for (const id of c.ids) {
        const e = p.elements[id];
        if (e) p.elements[id] = { ...e, ...c.patch } as Element;
      }
      for (const id of c.ids) {
        const e = p.elements[id];
        if (isOpening(e)) {
          const host = p.elements[e.hostId];
          if (isWall(host)) e.offset = clampOffset(p, e, host);
        }
      }
      break;
    case 'setWallEnds': {
      const w = p.elements[c.id];
      if (!isWall(w)) break;
      if (c.a) w.a = c.a;
      if (c.b) w.b = c.b;
      for (const o of Object.values(p.elements).filter(isOpening)) {
        if (o.hostId === w.id) o.offset = clampOffset(p, o, w);
      }
      break;
    }
    case 'setJoin':
      for (const e of c.ends) {
        const w = p.elements[e.wallId];
        if (!isWall(w)) continue;
        if (e.end === 'a') w.joinStart = { ...c.config };
        else w.joinEnd = { ...c.config };
      }
      break;
    case 'transform':
      applyTransformCmd(p, c);
      break;
    case 'splitWall':
      splitWall(p, c);
      break;
    case 'deleteElements':
      removeIds(p, c.ids);
      break;
    case 'upsertWallType':
      p.wallTypes[c.wallType.id] = c.wallType;
      break;
    case 'deleteWallType': {
      if (Object.values(p.elements).some((e) => isWall(e) && e.typeId === c.id)) throw new Error('Tipo em uso');
      if (p.defaults.wallTypeId === c.id) throw new Error('Tipo padrão não pode ser excluído');
      delete p.wallTypes[c.id];
      break;
    }
    case 'upsertMaterial':
      p.materials[c.material.id] = c.material;
      break;
    case 'upsertOpeningType':
      p.openingTypes[c.openingType.id] = c.openingType;
      break;
    case 'upsertLevel': {
      const i = p.levels.findIndex((l) => l.id === c.level.id);
      if (i >= 0) p.levels[i] = c.level;
      else p.levels.push(c.level);
      p.levels.sort((x, y) => x.elevation - y.elevation);
      break;
    }
    case 'deleteLevel': {
      if (p.levels.length <= 1) throw new Error('O projeto precisa de ao menos um nível');
      if (Object.values(p.elements).some((e) => isWall(e) && e.levelId === c.id)) throw new Error('Nível em uso');
      p.levels = p.levels.filter((l) => l.id !== c.id);
      break;
    }
    case 'setProjectName':
      p.name = c.name;
      break;
    case 'setDefaults':
      p.defaults = { ...p.defaults, ...c.patch };
      break;
    case 'setSettings':
      p.settings = { ...p.settings, ...c.patch };
      break;
    case 'batch':
      for (const sub of c.commands) applyCommand(p, sub);
      break;
  }
}
