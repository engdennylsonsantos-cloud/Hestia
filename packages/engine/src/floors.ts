import type { MultiPolygon } from '@hestia/geom';
import { floorPolygon, floorsOnLevel, levelElevation, type Id, type Project } from '@hestia/model';
import { cutStairOpenings, stairHolesFor, stairOpeningsOnLevel } from './stairOpenings.ts';

/** Camada resolvida do piso: o mesmo polígono em planta, entre as cotas absolutas z0 e z1. */
export interface ResolvedFloorLayer {
  layerIndex: number;
  materialId: Id;
  z0: number;
  z1: number;
}

export interface ResolvedFloor {
  floorId: Id;
  typeId: Id;
  levelId: Id;
  /** Contorno menos furos, em planta. */
  polygon: MultiPolygon;
  /** Cota absoluta do topo do piso (nível + deslocamento). */
  topZ: number;
  /** Cota absoluta da face inferior (topo menos a espessura total). */
  bottomZ: number;
  /** Do topo para baixo (índice 0 = camada de cima). */
  layers: ResolvedFloorLayer[];
}

/** Pisos de todos os níveis do projeto (quem cruza níveis, como a parede anexada, usa esta lista). */
export const resolveAllFloors = (p: Project): ResolvedFloor[] => p.levels.flatMap((l) => resolveFloors(p, l.id));

/**
 * Geometria dos pisos de um nível. O piso não é recortado pelas paredes (como no Revit, a parede fica sobre o piso
 * e a planta desenha o piso atrás dela). O furo de escada é calculado pela cota da face inferior de cada piso (decisão
 * 0011, §6). Tipos ausentes ou contornos com menos de 3 pontos são ignorados: a validação do modelo é quem avisa.
 */
export function resolveFloors(p: Project, levelId: Id): ResolvedFloor[] {
  const openings = stairOpeningsOnLevel(p, levelId);
  const out: ResolvedFloor[] = [];
  for (const f of floorsOnLevel(p, levelId)) {
    const type = p.floorTypes[f.typeId];
    if (!type || f.boundary.length < 3) continue;
    const topZ = levelElevation(p, f.levelId) + f.heightOffset;
    let z = topZ;
    const layers: ResolvedFloorLayer[] = [];
    type.layers.forEach((l, i) => {
      if (l.thickness < 1e-6) {
        return;
      }
      layers.push({ layerIndex: i, materialId: l.materialId, z0: z - l.thickness, z1: z });
      z -= l.thickness;
    });
    const bottomZ = z;
    const polygon = cutStairOpenings([floorPolygon(f)], stairHolesFor(openings, bottomZ));
    if (polygon.length === 0) continue;
    out.push({ floorId: f.id, typeId: f.typeId, levelId: f.levelId, polygon, topZ, bottomZ, layers });
  }
  return out;
}
