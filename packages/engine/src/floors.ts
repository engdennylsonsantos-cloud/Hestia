import type { MultiPolygon } from '@hestia/geom';
import { floorsOnLevel, isMembraneLayer, layerPriority, levelElevation, type Id, type Project } from '@hestia/model';
import { layerCoreFlags } from './junctionPlanar.ts';
import { resolveBoundary, type OutlineProblem } from './outlineBound.ts';
import { cutStairOpenings, stairHolesFor, stairOpeningsOnLevel } from './stairOpenings.ts';

/** Camada resolvida do piso: o mesmo polígono em planta, entre as cotas absolutas z0 e z1. */
export interface ResolvedFloorLayer {
  layerIndex: number;
  materialId: Id;
  z0: number;
  z1: number;
  /** Prioridade efetiva e núcleo, para a junção por camada (decisão 0023 §1, P7). */
  priority: number;
  core: boolean;
  /** Membrana (decisão 0023 §5): sem volume e sem sólido; a linha fica na face `z1`. Espessura zero tem z0 = z1. */
  membrane: boolean;
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
  /** Do topo para baixo (índice 0 = camada de cima). Inclui as membranas (`membrane: true`). */
  layers: ResolvedFloorLayer[];
  /** Motivo do circuito vinculado não fechar (decisão 0023 §8.2c); null quando fechou ou o piso é estático. */
  problem: OutlineProblem | null;
}

/** Pisos de todos os níveis do projeto (quem cruza níveis, como a parede anexada, usa esta lista). */
export const resolveAllFloors = (p: Project): ResolvedFloor[] => p.levels.flatMap((l) => resolveFloors(p, l.id));

/**
 * Geometria dos pisos de um nível. O piso não é recortado pelas paredes (como no Revit, a parede fica sobre o piso
 * e a planta desenha o piso atrás dela). O furo de escada é calculado pela cota da face inferior de cada piso (decisão
 * 0011, §6). Piso vinculado às paredes (`outlineSource.linked`) tem o contorno derivado do circuito (`resolveBoundary`):
 * quando o circuito abre, mantém o último contorno válido e devolve `problem`. Tipos ausentes ou contornos com menos de
 * 3 pontos são ignorados: a validação do modelo é quem avisa.
 */
export function resolveFloors(p: Project, levelId: Id): ResolvedFloor[] {
  const openings = stairOpeningsOnLevel(p, levelId);
  const out: ResolvedFloor[] = [];
  for (const f of floorsOnLevel(p, levelId)) {
    const type = p.floorTypes[f.typeId];
    if (!type) continue;
    let boundary = f.boundary;
    let holes = f.holes;
    let problem: OutlineProblem | null = null;
    if (f.outlineSource?.linked) {
      const outline = resolveBoundary(p, f.levelId, f);
      if (outline.polygon) {
        boundary = outline.polygon[0]!;
        holes = [...f.holes, ...outline.polygon.slice(1)];
      }
      problem = outline.problem;
    }
    if (boundary.length < 3) continue;
    const topZ = levelElevation(p, f.levelId) + f.heightOffset;
    let z = topZ;
    const layers: ResolvedFloorLayer[] = [];
    const core = layerCoreFlags(type.layers);
    type.layers.forEach((l, i) => {
      layers.push({ layerIndex: i, materialId: l.materialId, z0: z - l.thickness, z1: z, membrane: isMembraneLayer(l), priority: layerPriority(l), core: core[i]! });
      z -= l.thickness;
    });
    const bottomZ = z;
    const polygon = cutStairOpenings([[boundary, ...holes]], stairHolesFor(openings, bottomZ));
    if (polygon.length === 0) continue;
    out.push({ floorId: f.id, typeId: f.typeId, levelId: f.levelId, polygon, topZ, bottomZ, layers, problem });
  }
  return out;
}
