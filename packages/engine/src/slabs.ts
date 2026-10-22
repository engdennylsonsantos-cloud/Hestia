import type { MultiPolygon } from '@hestia/geom';
import { isMembraneLayer, layerPriority, levelElevation, slabsOnLevel, type Id, type Project, type SlabSlope } from '@hestia/model';
import { resolveBoundary, type OutlineProblem } from './outlineBound.ts';
import { layerCoreFlags } from './junctionPlanar.ts';
import { layerOutlines, memoCut } from './layerOutline.ts';
import { coverUnderside, cutStairOpenings, stairHolesFor, stairOpeningsOnLevel } from './stairOpenings.ts';

/** Cota da face superior da inclinação: definida no modelo (a validação também a usa). */
export { slabRiseAt } from '@hestia/model';

export interface ResolvedSlabLayer {
  layerIndex: number;
  materialId: Id;
  /** Cotas absolutas na origem da inclinação (sem inclinação: valem em toda a laje). */
  z0: number;
  z1: number;
  /** Prioridade efetiva e núcleo, para a junção por camada (decisão 0023 §1, P7). */
  priority: number;
  core: boolean;
  /** Membrana (decisão 0023 §5): sem volume e sem sólido; a linha fica na face `z1`. Espessura zero tem z0 = z1. */
  membrane: boolean;
  /** Contorno da camada, em planta, menos furos (decisão 0023 §2, P8): o da laje, salvo término que vai ao núcleo ou desloca. */
  polygon: MultiPolygon;
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
    const bounds = type.layers.map((l) => {
      const r = { z0: z - l.thickness, z1: z };
      z = r.z0;
      return r;
    });
    const bottomZ = z;
    const core = layerCoreFlags(type.layers);
    const base: MultiPolygon = [[boundary, ...holes]];
    const underside = coverUnderside(bottomZ, s.slope, [boundary, ...holes]);
    const cut = memoCut((m) => cutStairOpenings(m, stairHolesFor(openings, underside)));
    const polygon = cut(base);
    if (polygon.length === 0) continue;
    const outlines = layerOutlines(p, s.levelId, s, type.layers, core, base);
    const layers: ResolvedSlabLayer[] = type.layers.map((l, i) => ({
      layerIndex: i,
      materialId: l.materialId,
      z0: bounds[i]!.z0,
      z1: bounds[i]!.z1,
      membrane: isMembraneLayer(l),
      priority: layerPriority(l),
      core: core[i]!,
      polygon: cut(outlines[i]!),
    }));
    out.push({ slabId: s.id, typeId: s.typeId, levelId: s.levelId, polygon, topZ, bottomZ, slope: s.slope, layers, problem });
  }
  return out;
}

/** Lajes de todos os níveis do projeto (a parede anexada cruza níveis, como com os pisos). */
export const resolveAllSlabs = (p: Project): ResolvedSlab[] => p.levels.flatMap((l) => resolveSlabs(p, l.id));
