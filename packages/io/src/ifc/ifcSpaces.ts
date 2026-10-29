// NOTA (lane C): este módulo lê o contorno e os quantitativos do MOTOR. O `docs/01 §1` proíbe `io → engine`; a chamada
// foi pedida assim para os números não virem da malha. Se a fronteira tiver de ser mantida, mover o cálculo para
// `apps/web` e passar o contorno/quantitativos já resolvidos.
import { roomsOnLevel, type Id } from '@hestia/model';
import { resolveRooms } from '@hestia/engine';
import { gid, optStr, storeyOf, type IfcCtx } from './ifcCtx.ts';
import { bodyShape, extrudeSolid, localPlacement } from './ifcSolids.ts';
import { en, list, num, OMIT, ref, stepString } from './ifcStep.ts';
import type { IfcPoint, IfcPolygon } from './ifcTypes.ts';

/** Nome do conjunto de quantitativos do ambiente (`IfcElementQuantity`), o mesmo template do IFC4. */
export const SPACE_QTO = 'Qto_SpaceBaseQuantities';

/** Anel em planta do motor (`@hestia/geom` Vec2) como anel IFC; anéis com menos de 3 pontos saem. */
function ringOf(ring: ReadonlyArray<{ x: number; y: number }>): IfcPoint[] {
  const out: IfcPoint[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-9 && Math.abs(last.y - p.y) < 1e-9) continue;
    out.push({ x: p.x, y: p.y });
  }
  const first = out[0];
  const end = out[out.length - 1];
  if (out.length > 1 && first && end && Math.abs(first.x - end.x) < 1e-9 && Math.abs(first.y - end.y) < 1e-9) out.pop();
  return out.length >= 3 ? out : [];
}

/** Contorno resolvido do ambiente ([externo, ...furos]) como polígono IFC; vazio quando não sobra área. */
export function spacePolygon(polygon: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>): IfcPolygon {
  const [outer, ...holes] = polygon;
  const o = outer ? ringOf(outer) : [];
  if (o.length === 0) return [];
  return [o, ...holes.map(ringOf).filter((h) => h.length >= 3)];
}

/** Área de um anel fechado (m²), sem sinal: só para a área bruta do contorno externo. */
function ringArea(ring: readonly IfcPoint[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Quantitativos do ambiente (`Qto_SpaceBaseQuantities`) ligados ao IFCSPACE por `IFCRELDEFINESBYPROPERTIES`. */
function addSpaceQuantities(c: IfcCtx, roomId: Id, spaceId: number, values: { netArea: number; grossArea: number; height: number; perimeter: number }): void {
  const quantities: number[] = [];
  const quantity = (type: string, name: string, value: number): void => {
    if (!Number.isFinite(value)) return;
    quantities.push(c.w.add(type, [stepString(name), OMIT, OMIT, num(value), OMIT]));
  };
  quantity('IFCQUANTITYAREA', 'NetFloorArea', values.netArea);
  quantity('IFCQUANTITYAREA', 'GrossFloorArea', values.grossArea);
  quantity('IFCQUANTITYLENGTH', 'Height', values.height);
  quantity('IFCQUANTITYLENGTH', 'Perimeter', values.perimeter);
  if (quantities.length === 0) return;
  const set = c.w.add('IFCELEMENTQUANTITY', [gid(`qto:space:${roomId}`), OMIT, stepString(SPACE_QTO), OMIT, OMIT, list(quantities.map(ref))]);
  c.w.add('IFCRELDEFINESBYPROPERTIES', [gid(`qto:space:${roomId}:rel`), OMIT, OMIT, OMIT, list([ref(spaceId)]), ref(set)]);
}

/**
 * Ambientes: um IFCSPACE por `Room`, no pavimento do nível dela, com o contorno RESOLVIDO pelo motor (circuito de paredes
 * que contém o ponto; pilares internos viram furos). O corpo é a extrusão do contorno entre a base do ambiente
 * (`heightOffset`) e o pé-direito. Ambiente sem contorno (ponto fora de circuito fechado) não sai. Os quantitativos vêm
 * do motor e ficam em `Qto_SpaceBaseQuantities` (`NetFloorArea`, `GrossFloorArea`, `Height`, `Perimeter`).
 */
export function addSpaces(c: IfcCtx): void {
  for (const level of c.p.levels) {
    const st = storeyOf(c, level.id);
    if (!st) continue;
    const resolved = new Map(resolveRooms(c.p, level.id).map((r) => [r.roomId, r]));
    for (const room of roomsOnLevel(c.p, level.id)) {
      const r = resolved.get(room.id);
      const polygon = r?.polygon ? spacePolygon(r.polygon) : [];
      if (!r || polygon.length === 0) continue;
      const height = r.ceilingHeight;
      // Altura não positiva não gera corpo; sem corpo o ambiente não entra (a validação aponta o pé-direito).
      if (!(Number.isFinite(height) && height > 0)) continue;
      const baseZ = room.heightOffset ?? 0;
      const solid = extrudeSolid(c.w, polygon, baseZ, height);
      const shape = bodyShape(c.w, c.ctx, 'SweptSolid', [solid]);
      const place = localPlacement(c.w, st.place, [0, 0, 0]);
      const longName = room.number ? (room.name ? `${room.number} - ${room.name}` : room.number) : room.name;
      const id = c.w.add('IFCSPACE', [
        gid(`space:${room.id}`),
        OMIT,
        stepString(room.name),
        OMIT,
        OMIT,
        ref(place),
        ref(shape),
        optStr(longName),
        en('ELEMENT'),
        en('INTERNAL'),
        num(baseZ),
      ]);
      st.contained.push(id);
      addSpaceQuantities(c, room.id, id, {
        netArea: r.area,
        grossArea: ringArea(polygon[0]!),
        height,
        perimeter: r.perimeter,
      });
    }
  }
}
