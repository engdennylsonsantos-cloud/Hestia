import type { MultiPolygon, Vec2 } from '@hestia/geom';
import { levelElevation, slabPolygon, slabsOnLevel, type Id, type Project, type SlabSlope } from '@hestia/model';

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

/** Acréscimo de cota da face superior no ponto `p` por causa da inclinação (0 sem inclinação). */
export function slabRiseAt(slope: SlabSlope | null, p: Vec2): number {
  if (!slope) return 0;
  return ((slope.percent / 100) * ((p.x - slope.origin.x) * slope.dir.x + (p.y - slope.origin.y) * slope.dir.y));
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
