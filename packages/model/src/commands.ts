import { applyTransform, type Transform, type Vec2 } from '@hestia/geom';
import { wallLength } from './queries.ts';
import {
  isOpening,
  isFloor,
  isSlab,
  isRoof,
  isStair,
  isWall,
  isRoom,
  type Element,
  type Floor,
  type FloorType,
  type Slab,
  type Roof,
  type RoofType,
  type SlabType,
  type Id,
  type Room,
  type Stair,
  type StairType,
  type JoinConfig,
  type Level,
  type Material,
  type Opening,
  type OpeningType,
  type Project,
  type SectionView,
  type Wall,
  type WallType,
} from './types.ts';
import { splitWall } from './splitWall.ts';
import { setOpeningHost } from './openingHost.ts';
import { applyElementLevel, hasLevel, type SetElementLevel } from './elementLevel.ts';
import { transformStair } from './stairTransform.ts';
import { transformFloor, transformSlab } from './transformPlanar.ts';
import { stairTypeIssue } from './stair.ts';
import { openingTypeIssue, toggleFavoriteIn } from './opening.ts';
import { viewRangeIssues, type ViewRange } from './viewRange.ts';
import type { DeepPartial, ProjectGraphics, View3DSettings, ViewGraphics } from './graphics.ts';
import {
  applyLevelGraphics,
  applyProjectGraphics,
  applySectionGraphics,
  applyView3D,
  resetLevelGraphics,
  resetSectionGraphics,
  resetView3D,
} from './graphicsCommands.ts';

import { applyAnnotationCommand, type AnnotationCommand } from './annotations.ts';
import { applySheetCommand, type SheetCommand } from './sheetCommands.ts';

/** Comando = dados serializáveis. A única forma de escrever no modelo (docs/01 §5). */
export type Command =
  | { type: 'addWall'; wall: Omit<Wall, 'order'> }
  | { type: 'addOpening'; opening: Opening }
  | { type: 'addFloor'; floor: Omit<Floor, 'order'> }
  | { type: 'addSlab'; slab: Omit<Slab, 'order'> }
  | { type: 'addRoof'; roof: Omit<Roof, 'order'> }
  | { type: 'addRoom'; room: Omit<Room, 'order'> }
  | { type: 'updateRoom'; id: Id; patch: Partial<Omit<Room, 'id' | 'kind' | 'order'>> }
  | { type: 'removeRoom'; id: Id }
  | { type: 'upsertRoofType'; roofType: RoofType }
  | { type: 'deleteRoofType'; id: Id }
  | { type: 'addStair'; stair: Omit<Stair, 'order'> }
  | { type: 'upsertStairType'; stairType: StairType }
  | { type: 'deleteStairType'; id: Id }
  | { type: 'upsertSlabType'; slabType: SlabType }
  | { type: 'deleteSlabType'; id: Id }
  | { type: 'upsertFloorType'; floorType: FloorType }
  | { type: 'deleteFloorType'; id: Id }
  | { type: 'updateElements'; ids: Id[]; patch: Partial<Wall> | Partial<Opening> | Partial<Floor> | Partial<Slab> | Partial<Roof> | Partial<Stair> | Partial<Room> }
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
  | AnnotationCommand
  | SheetCommand
  | { type: 'deleteLevel'; id: Id }
  | { type: 'setLevelViewRange'; levelId: Id; patch: Partial<ViewRange> }
  | { type: 'setProjectGraphics'; patch: DeepPartial<ProjectGraphics> }
  | { type: 'setLevelGraphics'; levelId: Id; patch: DeepPartial<ViewGraphics> }
  | { type: 'resetLevelGraphics'; levelId: Id }
  | { type: 'setView3D'; patch: DeepPartial<View3DSettings> }
  | { type: 'resetView3D' }
  | { type: 'setSectionGraphics'; patch: DeepPartial<ViewGraphics> }
  | { type: 'resetSectionGraphics' }
  | { type: 'setProjectName'; name: string }
  | { type: 'setDefaults'; patch: Partial<Project['defaults']> }
  | { type: 'setSettings'; patch: Partial<Project['settings']> }
  | { type: 'toggleOpeningFavorite'; id: Id }
  | { type: 'addView'; view: SectionView }
  | { type: 'updateView'; id: Id; patch: Partial<Omit<SectionView, 'id'>> }
  | { type: 'deleteView'; id: Id }
  | { type: 'batch'; commands: Command[] }
  | { type: 'setOpeningHost'; id: Id; hostId: Id; offset: number }
  | ({ type: 'setElementLevel' } & SetElementLevel);

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

/** Move/gira/espelha um telhado: contorno, furos, direção e águas livres (origem e direção de subida). */
function transformRoof(r: Roof, t: Transform): Roof {
  const pts = (ring: Vec2[]): Vec2[] => {
    const out = ring.map((q) => applyTransform(t, q));
    return t.kind === 'mirror' ? out.reverse() : out;
  };
  const dirOf = (o: Vec2, d: Vec2): Vec2 => {
    const e = applyTransform(t, { x: o.x + d.x, y: o.y + d.y });
    const a = applyTransform(t, o);
    const l = Math.hypot(e.x - a.x, e.y - a.y) || 1;
    return { x: (e.x - a.x) / l, y: (e.y - a.y) / l };
  };
  return {
    ...r,
    boundary: pts(r.boundary),
    holes: r.holes.map(pts),
    dir: dirOf(r.boundary[0] ?? { x: 0, y: 0 }, r.dir),
    planes: r.planes.map((pl) => ({ ...pl, polygon: pts(pl.polygon), origin: applyTransform(t, pl.origin), up: dirOf(pl.origin, pl.up) })),
  };
}

/** Move/gira/espelha cada elemento do tipo pedido (mesmo padrão para piso, laje, telhado, escada e ambiente). */
function transformEach<E extends Element>(p: Project, c: Extract<Command, { type: 'transform' }>, pred: (e: Element | undefined) => e is E, map: (e: E, t: Transform) => E): void {
  const idMap = c.copy?.idMap;
  for (const e of c.ids.map((id) => p.elements[id]).filter(pred)) {
    const next = map(e, c.transform);
    if (idMap) {
      const nid = idMap[e.id];
      if (nid) p.elements[nid] = { ...next, id: nid, order: p.nextOrder++ } as E;
    } else {
      p.elements[e.id] = next;
    }
  }
}

function applyTransformCmd(p: Project, c: Extract<Command, { type: 'transform' }>): void {
  const idMap = c.copy?.idMap;
  transformEach(p, c, isRoof, transformRoof);
  transformEach(p, c, isStair, transformStair);
  transformEach(p, c, isSlab, transformSlab);
  transformEach(p, c, isFloor, transformFloor);
  transformEach(p, c, isRoom, (r, t) => ({ ...r, point: applyTransform(t, r.point) }));
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
    case 'addFloor': {
      if (c.floor.boundary.length < 3) throw new Error('O contorno do piso precisa de ao menos 3 pontos');
      if (!p.floorTypes[c.floor.typeId]) throw new Error('Tipo de piso inexistente');
      p.elements[c.floor.id] = { ...c.floor, order: p.nextOrder++ };
      break;
    }
    case 'upsertFloorType':
      p.floorTypes[c.floorType.id] = c.floorType;
      break;
    case 'deleteFloorType': {
      if (Object.values(p.elements).some((e) => isFloor(e) && e.typeId === c.id)) throw new Error('Tipo em uso');
      if (Object.keys(p.floorTypes).length <= 1) throw new Error('O projeto precisa de ao menos um tipo de piso');
      delete p.floorTypes[c.id];
      break;
    }
    case 'addSlab': {
      if (c.slab.boundary.length < 3) throw new Error('O contorno da laje precisa de ao menos 3 pontos');
      if (!p.slabTypes[c.slab.typeId]) throw new Error('Tipo de laje inexistente');
      p.elements[c.slab.id] = { ...c.slab, order: p.nextOrder++ };
      break;
    }
    case 'upsertSlabType':
      p.slabTypes[c.slabType.id] = c.slabType;
      break;
    case 'deleteSlabType': {
      if (Object.values(p.elements).some((e) => isSlab(e) && e.typeId === c.id)) throw new Error('Tipo em uso');
      if (Object.keys(p.slabTypes).length <= 1) throw new Error('O projeto precisa de ao menos um tipo de laje');
      delete p.slabTypes[c.id];
      break;
    }
    case 'addRoof': {
      if (c.roof.boundary.length < 3) throw new Error('O contorno do telhado precisa de ao menos 3 pontos');
      if (!p.roofTypes[c.roof.typeId]) throw new Error('Tipo de telhado inexistente');
      p.elements[c.roof.id] = { ...c.roof, order: p.nextOrder++ };
      break;
    }
    case 'addRoom': {
      if (!p.levels.some((l) => l.id === c.room.levelId)) throw new Error('Nível inexistente');
      p.elements[c.room.id] = { ...c.room, order: p.nextOrder++ };
      break;
    }
    case 'updateRoom': {
      const r = p.elements[c.id];
      if (!isRoom(r)) throw new Error('Ambiente inexistente');
      p.elements[c.id] = { ...r, ...c.patch };
      break;
    }
    case 'removeRoom':
      delete p.elements[c.id];
      break;
    case 'upsertRoofType':
      p.roofTypes[c.roofType.id] = c.roofType;
      break;
    case 'deleteRoofType': {
      if (Object.values(p.elements).some((e) => isRoof(e) && e.typeId === c.id)) throw new Error('Tipo em uso');
      if (Object.keys(p.roofTypes).length <= 1) throw new Error('O projeto precisa de ao menos um tipo de telhado');
      delete p.roofTypes[c.id];
      break;
    }
    case 'addStair': {
      if (!p.stairTypes[c.stair.typeId]) throw new Error('Tipo de escada inexistente');
      p.elements[c.stair.id] = { ...c.stair, order: p.nextOrder++ };
      break;
    }
    case 'upsertStairType': {
      const issue = stairTypeIssue(c.stairType);
      if (issue) throw new Error(issue);
      p.stairTypes[c.stairType.id] = c.stairType;
      break;
    }
    case 'deleteStairType': {
      if (Object.values(p.elements).some((e) => isStair(e) && e.typeId === c.id)) throw new Error('Tipo em uso');
      if (Object.keys(p.stairTypes).length <= 1) throw new Error('O projeto precisa de ao menos um tipo de escada');
      delete p.stairTypes[c.id];
      break;
    }
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
    case 'upsertOpeningType': {
      const issue = openingTypeIssue(c.openingType);
      if (issue) throw new Error(issue);
      p.openingTypes[c.openingType.id] = c.openingType;
      break;
    }
    case 'upsertLevel': {
      const i = p.levels.findIndex((l) => l.id === c.level.id);
      if (i >= 0) p.levels[i] = c.level;
      else p.levels.push(c.level);
      p.levels.sort((x, y) => x.elevation - y.elevation);
      break;
    }
    case 'deleteLevel': {
      if (p.levels.length <= 1) throw new Error('O projeto precisa de ao menos um nível');
      // Escada também conta pelo nível de topo explícito; o topo automático segue o nível acima e não prende o nível.
      if (Object.values(p.elements).some((e) => (hasLevel(e) && e.levelId === c.id) || (isStair(e) && e.topLevelId === c.id))) throw new Error('Nível em uso');
      p.levels = p.levels.filter((l) => l.id !== c.id);
      break;
    }
    case 'addDimension':
    case 'updateDimension':
    case 'removeDimension':
    case 'addText':
    case 'updateText':
    case 'removeText':
      applyAnnotationCommand(p, c);
      break;
    case 'addSheet':
    case 'updateSheet':
    case 'removeSheet':
    case 'addViewport':
    case 'updateViewport':
    case 'removeViewport':
      applySheetCommand(p, c);
      break;
    case 'setLevelViewRange': {
      const l = p.levels.find((x) => x.id === c.levelId);
      if (!l) throw new Error('Nível inexistente');
      // Sem normalização silenciosa: um valor que quebra a ordem topo ≥ corte ≥ base ≥ profundidade é recusado.
      const next: ViewRange = { ...l.viewRange, ...c.patch };
      const issues = viewRangeIssues(next);
      if (issues.length > 0) throw new Error(issues.join(' '));
      l.viewRange = next;
      break;
    }
    case 'setProjectGraphics':
      applyProjectGraphics(p, c.patch);
      break;
    case 'setLevelGraphics':
      applyLevelGraphics(p, c.levelId, c.patch);
      break;
    case 'resetLevelGraphics':
      resetLevelGraphics(p, c.levelId);
      break;
    case 'setView3D':
      applyView3D(p, c.patch);
      break;
    case 'resetView3D':
      resetView3D(p);
      break;
    case 'setSectionGraphics':
      applySectionGraphics(p, c.patch);
      break;
    case 'resetSectionGraphics':
      resetSectionGraphics(p);
      break;
    case 'setProjectName':
      p.name = c.name;
      break;
    case 'setDefaults':
      p.defaults = { ...p.defaults, ...c.patch };
      break;
    case 'setSettings':
      p.settings = { ...p.settings, ...c.patch };
      break;
    case 'toggleOpeningFavorite': toggleFavoriteIn(p, c.id); break;
    case 'addView':
      if (p.views.some((v) => v.id === c.view.id)) throw new Error('Vista já existe');
      p.views.push(c.view);
      break;
    case 'updateView': {
      const v = p.views.find((x) => x.id === c.id);
      if (!v) throw new Error('Vista inexistente');
      Object.assign(v, c.patch);
      break;
    }
    case 'deleteView':
      p.views = p.views.filter((v) => v.id !== c.id);
      break;
    case 'batch':
      for (const sub of c.commands) applyCommand(p, sub);
      break;
    case 'setOpeningHost':
      setOpeningHost(p, c);
      break;
    case 'setElementLevel':
      applyElementLevel(p, c);
      break;
  }
}
