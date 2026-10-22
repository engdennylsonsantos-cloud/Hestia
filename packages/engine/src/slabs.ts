import type { MultiPolygon } from '@hestia/geom';
import { levelElevation, slabsOnLevel, type Id, type Project, type SlabSlope } from '@hestia/model';
import { resolveBoundary, type OutlineProblem } from './outlineBound.ts';
import { coverUnderside, cutStairOpenings, stairHolesFor, stairOpeningsOnLevel } from './stairOpenings.ts';

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
  /** Motivo do circuito vinculado não fechar (decisão 0023 §8.2c); null quando fechou ou a laje é estática. */
  problem: OutlineProblem | null;
}

/**
 * Geometria das lajes de um nível (não recortadas pelas paredes, como os pisos). Os furos de escada do nível de topo são
 * calculados por laje, pela cota da face inferior dela (`stairHolesFor`, decisão 0011 §6), e subtraídos só do próprio
 * contorno; uma laje inteiramente coberta por eles não entra. Laje vinculada (`outlineSource.linked`) tem o contorno
 * derivado (`resolveBoundary`): circuito aberto mantém o último contorno e devolve `problem`.
 */
export function resolveSlabs(p: Project, levelId: Id): ResolvedSlab[] {
  const openings = stairOpeningsOnLevel(p, levelId);
  const out: ResolvedSlab[] = [];
  for (const s of slabsOnLevel(p, levelId)) {
    const type = p.slabTypes[s.typeId];
    if (!type) continue;
    let boundary = s.boundary;
    let holes = s.holes;
    let problem: OutlineProblem | null = null;
    if (s.outlineSource?.linked) {
      const outline = resolveBoundary(p, s.levelId, s);
      if (outline.polygon) {
        boundary = outline.polygon[0]!;
        holes = [...s.holes, ...outline.polygon.slice(1)];
      }
      problem = outline.problem;
    }
    if (boundary.length < 3) continue;
    const topZ = levelElevation(p, s.levelId) + s.heightOffset;
    let z = topZ;
    const layers: ResolvedSlabLayer[] = [];
    type.layers.forEach((l, i) => {
      if (l.thickness < 1e-6) return;
      layers.push({ layerIndex: i, materialId: l.materialId, z0: z - l.thickness, z1: z });
      z -= l.thickness;
    });
    const bottomZ = z;
    const underside = coverUnderside(bottomZ, s.slope, [boundary, ...holes]);
    const polygon = cutStairOpenings([[boundary, ...holes]], stairHolesFor(openings, underside));
    if (polygon.length === 0) continue;
    out.push({ slabId: s.id, typeId: s.typeId, levelId: s.levelId, polygon, topZ, bottomZ, slope: s.slope, layers, problem });
  }
  return out;
}

/** Lajes de todos os níveis do projeto (a parede anexada cruza níveis, como com os pisos). */
export const resolveAllSlabs = (p: Project): ResolvedSlab[] => p.levels.flatMap((l) => resolveSlabs(p, l.id));
