import { equal, pointInMulti, type Polygon, type Ring, type SketchSeg, type Vec2 } from '@hestia/geom';
import { resolveRooms } from '@hestia/engine';
import { newId, type Id, type Project } from '@hestia/model';
import { fitRing } from './perimeterArcFit.ts';
import { makeSeg, visibleIn, type SketchCtx } from './sketchPickFaceGeom.ts';

/** Ambiente sob um ponto: o contorno dele como linhas do esboço (arcos recuperados) e o id do ambiente. */
export interface RoomPick {
  segs: SketchSeg[];
  roomId: Id;
  name: string;
  /** Ponto do ambiente (rótulo da prévia). */
  point: Vec2;
}

/**
 * Contorno do ambiente, com o anel externo na posição 0 e os furos em seguida (ilhas de parede). Null quando o ambiente
 * não existe no nível, está aberto (vão) ou sem circuito. Mesma regra do forro "No ambiente" (`roomCeilingAt`).
 */
export function roomPolygon(p: Project, levelId: Id, roomId: Id): Polygon | null {
  const room = resolveRooms(p, levelId).find((r) => r.roomId === roomId);
  return room && room.polygon && room.problem === null ? room.polygon : null;
}

/** Anel sem o ponto de fechamento repetido. */
const openRing = (ring: Ring): Ring => (ring.length > 1 && equal(ring[0]!, ring[ring.length - 1]!) ? ring.slice(0, -1) : ring);

/**
 * Ambiente do nível cujo circuito contém o ponto, como linhas do esboço. Ignora ambiente oculto na planta, aberto ou
 * duplicado. Os arcos do contorno (amostrados no circuito) voltam a ser arcos, como em `fitRing`.
 */
export function roomAt(ctx: SketchCtx, at: Vec2): RoomPick | null {
  const p = ctx.project();
  const levelId = ctx.levelId();
  const vis = visibleIn(ctx);
  const room = resolveRooms(p, levelId).find(
    (r) => r.polygon !== null && r.problem === null && r.duplicateOf === undefined && vis(r.roomId) && pointInMulti(at, [r.polygon]),
  );
  if (!room?.polygon) return null;
  const segs = room.polygon.flatMap((ring) => fitRing(openRing(ring)).map((f) => makeSeg(newId('sk'), f.a, f.b, f.sag ?? 0)));
  return { segs, roomId: room.roomId, name: room.name, point: room.point };
}
