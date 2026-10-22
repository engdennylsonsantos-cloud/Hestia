import { isFloor, isRoof, isSlab, isStair, type Roof } from '@hestia/model';
import { gid, storeyOf, type IfcCtx, type IfcStorey } from './ifcCtx.ts';
import { localPlacement, prismsShape } from './ifcSolids.ts';
import { en, int, list, num, OMIT, ref, stepString } from './ifcStep.ts';
import type { IfcGeometry, IfcPrism } from './ifcTypes.ts';

/** Tipo de laje: fundação ou radier vira BASESLAB; o resto, FLOOR (IfcSlabTypeEnum). */
export const slabKindOf = (typeName: string): 'BASESLAB' | 'FLOOR' => (/fund|radier|baldr/i.test(typeName) ? 'BASESLAB' : 'FLOOR');

/** Forma do telhado (IfcRoofTypeEnum): água única, duas águas, quatro águas; as demais formas saem como livre. */
export function roofKindOf(shape: Roof['shape']): string {
  switch (shape) {
    case 'shed':
      return 'SHED_ROOF';
    case 'gable':
      return 'GABLE_ROOF';
    case 'hip':
      return 'HIP_ROOF';
    default:
      return 'FREEFORM';
  }
}

/** IFCSLAB com os prismas no pavimento `st` (cotas absolutas dos prismas; a geometria sai em cota local). */
function slabEntity(c: IfcCtx, st: IfcStorey, key: string, name: string, prisms: IfcPrism[], kind: string): number {
  const shape = prismsShape(c.w, c.ctx, prisms, st.elev);
  const place = localPlacement(c.w, st.place, [0, 0, 0]);
  return c.w.add('IFCSLAB', [gid(key), OMIT, stepString(name), OMIT, OMIT, ref(place), ref(shape), OMIT, en(kind)]);
}

/** Pisos e lajes: IFCSLAB por extrusão do contorno (com furos) entre as cotas do topo e do fundo. */
export function addPlates(c: IfcCtx, geo: IfcGeometry): void {
  for (const f of geo.floors) {
    const el = c.p.elements[f.floorId];
    const st = isFloor(el) ? storeyOf(c, el.levelId) : undefined;
    if (!isFloor(el) || !st) continue;
    const name = c.p.floorTypes[el.typeId]?.name ?? 'Piso';
    st.contained.push(slabEntity(c, st, `floor:${f.floorId}`, name, [f.prism], 'FLOOR'));
  }
  for (const s of geo.slabs) {
    const el = c.p.elements[s.slabId];
    const st = isSlab(el) ? storeyOf(c, el.levelId) : undefined;
    if (!isSlab(el) || !st) continue;
    const name = c.p.slabTypes[el.typeId]?.name ?? 'Laje';
    st.contained.push(slabEntity(c, st, `slab:${s.slabId}`, name, [s.prism], slabKindOf(name)));
  }
}

/**
 * Telhados: IFCROOF (contido no pavimento) com uma IFCSLAB ROOF por água, agregada ao telhado. Cada água é um prisma de
 * faces planas: topo inclinado na cota da água e fundo paralelo, a espessura vertical das camadas do tipo.
 */
export function addRoofs(c: IfcCtx, geo: IfcGeometry): void {
  for (const r of geo.roofs) {
    const el = c.p.elements[r.roofId];
    const st = isRoof(el) ? storeyOf(c, el.levelId) : undefined;
    if (!isRoof(el) || !st) continue;
    const name = stepString(c.p.roofTypes[el.typeId]?.name ?? 'Telhado');
    const place = localPlacement(c.w, st.place, [0, 0, 0]);
    const roof = c.w.add('IFCROOF', [gid(`roof:${r.roofId}`), OMIT, name, OMIT, OMIT, ref(place), OMIT, OMIT, en(roofKindOf(el.shape))]);
    st.contained.push(roof);
    const waters = r.planes.map((pr, i) => slabEntity(c, st, `roofslab:${r.roofId}:${i}`, `Água ${i + 1}`, [pr], 'ROOF'));
    if (waters.length > 0) c.w.add('IFCRELAGGREGATES', [gid(`roofagg:${r.roofId}`), OMIT, OMIT, OMIT, ref(roof), list(waters.map(ref))]);
  }
}

/**
 * Escadas: IFCSTAIR contido no pavimento de baixo, agregando um IFCSTAIRFLIGHT por lance (degraus, chegada e poste do lance,
 * em faces planas) e um IFCSLAB LANDING por patamar, contido no pavimento. Espelho e contagens vão nos atributos do lance.
 */
export function addStairs(c: IfcCtx, geo: IfcGeometry): void {
  for (const s of geo.stairs) {
    const el = c.p.elements[s.stairId];
    const st = isStair(el) ? storeyOf(c, el.levelId) : undefined;
    if (!isStair(el) || !st) continue;
    const name = c.p.stairTypes[el.typeId]?.name ?? 'Escada';
    const place = localPlacement(c.w, st.place, [0, 0, 0]);
    const kind = s.spiral ? 'SPIRAL_STAIR' : s.flights.length <= 1 ? 'STRAIGHT_RUN_STAIR' : 'NOTDEFINED';
    const stair = c.w.add('IFCSTAIR', [gid(`stair:${s.stairId}`), OMIT, stepString(name), OMIT, OMIT, ref(place), OMIT, OMIT, en(kind)]);
    st.contained.push(stair);
    const flights = s.flights.map((f) => {
      const fPlace = localPlacement(c.w, st.place, [0, 0, 0]);
      const shape = prismsShape(c.w, c.ctx, f.pieces, st.elev);
      return c.w.add('IFCSTAIRFLIGHT', [
        gid(`flight:${s.stairId}:${f.componentIndex}`),
        OMIT,
        stepString(`${name} - lance ${f.componentIndex}`),
        OMIT,
        OMIT,
        ref(fPlace),
        ref(shape),
        OMIT,
        int(f.risers),
        int(f.treads),
        s.riserHeight > 0 ? num(s.riserHeight) : OMIT,
        OMIT,
        en(s.spiral ? 'SPIRAL' : 'STRAIGHT'),
      ]);
    });
    if (flights.length > 0) c.w.add('IFCRELAGGREGATES', [gid(`stairagg:${s.stairId}`), OMIT, OMIT, OMIT, ref(stair), list(flights.map(ref))]);
    s.landings.forEach((pr, i) => {
      st.contained.push(slabEntity(c, st, `landing:${s.stairId}:${i}`, `${name} - patamar ${i + 1}`, [pr], 'LANDING'));
    });
  }
}
