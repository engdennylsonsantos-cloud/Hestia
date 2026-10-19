import type { MultiPolygon } from '@hestia/geom';
import { levelElevation, slabPolygon, slabsOnLevel, type Id, type Project, type SlabSlope } from '@hestia/model';

/** Cota da face superior da inclinação: definida no modelo (a validação também a usa). */
export { slabRiseAt } from '@hestia/model';

export interface ResolvedSlabLayer {
  layerIndex: number;
  materialId: Id;
  /** Cotas absolutas na origem da inclinação (sem inclinação: valem em toda a laje). */
  z0: number;
  z1: number;
}

export interface ResolvedSlab {
  slabId: Id;
  typeId: Id;
  levelId: Id;
  polygon: MultiPolygon;
  /** Cota absoluta do topo na origem da inclinação (nível + deslocamento). */
  topZ: number;
  bottomZ: number;
  slope: SlabSlope | null;
  layers: ResolvedSlabLayer[];
}

/** Geometria das lajes de um nível (não recortadas pelas paredes, como os pisos). */
export function resolveSlabs(p: Project, levelId: Id): ResolvedSlab[] {
  const out: ResolvedSlab[] = [];
  for (const s of slabsOnLevel(p, levelId)) {
    const type = p.slabTypes[s.typeId];
    if (!type || s.boundary.length < 3) continue;
    const topZ = levelElevation(p, s.levelId) + s.heightOffset;
    let z = topZ;
    const layers: ResolvedSlabLayer[] = [];
    type.layers.forEach((l, i) => {
      if (l.thickness < 1e-6) return;
      layers.push({ layerIndex: i, materialId: l.materialId, z0: z - l.thickness, z1: z });
      z -= l.thickness;
    });
    out.push({ slabId: s.id, typeId: s.typeId, levelId: s.levelId, polygon: [slabPolygon(s)], topZ, bottomZ: z, slope: s.slope, layers });
  }
  return out;
}

/** Lajes de todos os níveis do projeto (a parede anexada cruza níveis, como com os pisos). */
export const resolveAllSlabs = (p: Project): ResolvedSlab[] => p.levels.flatMap((l) => resolveSlabs(p, l.id));
