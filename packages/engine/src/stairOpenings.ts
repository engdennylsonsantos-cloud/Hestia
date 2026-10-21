import { boxOf, boxesOverlap, difference, intersection, multiArea, union, type MultiPolygon, type Polygon } from '@hestia/geom';
import {
  floorPolygon,
  floorsOnLevel,
  floorTypeThickness,
  slabPolygon,
  slabsOnLevel,
  slabTypeThickness,
  stairs,
  stairTopLevel,
  type Id,
  type Project,
} from '@hestia/model';
import { resolveStairs, type ResolvedStair } from './stairs.ts';

/** Espessura usada quando nenhuma laje ou piso cobre a escada no nível de topo (decisão 0011, item 11). */
export const STAIR_OPENING_DEFAULT_THICKNESS = 0.15;

/** Tolerância de cota e de área (m, m²) nas comparações do furo. */
const EPS = 1e-9;

/**
 * Região em planta que a laje do nível de topo precisa vazar para a escada passar: união dos degraus e patamares cuja
 * cota de topo está em `stair.topZ − slabThickness − minHeadroom` ou acima. Abaixo dessa cota, a escada ainda passa
 * com a folga de cabeça do tipo e a laje fica inteira. Derivada: nunca é gravada no elemento.
 */
export function stairHoleRegion(stair: ResolvedStair, slabThickness: number): MultiPolygon {
  const limit = stair.topZ - slabThickness - stair.type.minHeadroom - EPS;
  const parts = stair.steps.filter((s) => s.z >= limit).map((s): MultiPolygon => [[s.polygon]]);
  return parts.length ? union(...parts) : [];
}

/** Espessura total da laje ou do piso do nível que cobre a planta da escada (a maior, se forem várias); padrão se nenhuma. */
function thicknessUnder(p: Project, levelId: Id, footprint: MultiPolygon): number {
  const covers = (polygon: Polygon): boolean => multiArea(intersection([polygon], footprint)) > EPS;
  const thicknesses: number[] = [];
  for (const s of slabsOnLevel(p, levelId)) {
    const t = p.slabTypes[s.typeId];
    if (t && covers(slabPolygon(s))) thicknesses.push(slabTypeThickness(t));
  }
  for (const f of floorsOnLevel(p, levelId)) {
    const t = p.floorTypes[f.typeId];
    if (t && covers(floorPolygon(f))) thicknesses.push(floorTypeThickness(t));
  }
  return thicknesses.length ? Math.max(...thicknesses) : STAIR_OPENING_DEFAULT_THICKNESS;
}

/**
 * Furos que as lajes e os pisos do nível recebem por causa das escadas: união das regiões das escadas com "Abrir laje"
 * ligada cujo nível de topo (explícito ou o imediatamente acima) é `levelId`. Sem essas escadas, devolve vazio.
 */
export function stairHolesForLevel(p: Project, levelId: Id): MultiPolygon {
  const candidates = stairs(p).filter((s) => s.openSlab && stairTopLevel(p, s)?.id === levelId);
  if (candidates.length === 0) return [];
  const resolved = new Map(resolveStairs(p).map((r) => [r.id, r] as const));
  const parts: MultiPolygon[] = [];
  for (const s of candidates) {
    const r = resolved.get(s.id);
    if (!r) continue;
    const region = stairHoleRegion(r, thicknessUnder(p, levelId, r.footprint));
    if (region.length) parts.push(region);
  }
  return parts.length ? union(...parts) : [];
}

/**
 * Recorta os furos de escada de um contorno resolvido. Sem furos, ou com a caixa dos furos longe da caixa do contorno,
 * devolve o próprio contorno (não recalcula a geometria das lajes sem escada).
 */
export function cutStairOpenings(polygon: MultiPolygon, openings: MultiPolygon): MultiPolygon {
  if (openings.length === 0 || !boxesOverlap(boxOf(polygon.flat(2)), boxOf(openings.flat(2)))) return polygon;
  return difference(polygon, openings);
}
