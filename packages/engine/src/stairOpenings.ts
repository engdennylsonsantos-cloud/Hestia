import { asMulti, boxOf, boxesOverlap, difference, intersection, minAreaRect, multiArea, multiPoints, offsetMulti, union, type MultiPolygon, type Polygon } from '@hestia/geom';
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
  type Stair,
} from '@hestia/model';
import { resolveStairs, type ResolvedStair } from './stairs.ts';

/** Espessura usada quando nenhuma laje ou piso cobre a escada no nível de topo (decisão 0011, item 11). */
export const STAIR_OPENING_DEFAULT_THICKNESS = 0.15;

/** Tolerância de cota e de área (m, m²) nas comparações do furo. */
const EPS = 1e-9;

/**
 * Região em planta que a laje do nível de topo precisa vazar para a escada passar, no modo "pé-direito livre" (decisão
 * 0011 §6): união dos degraus e patamares cuja cota de topo `z` satisfaz `z + headroom ≥ cota da face inferior` (topo da
 * escada − espessura da laje). Mede-se a partir da cota do topo do degrau: o piso é plano, então o nariz (a quina da
 * frente) e o resto do degrau têm a mesma cota. Um degrau com folga ≤ `headroom` sai da laje; o degrau que sobra tem
 * folga maior que `headroom`. `headroom` padrão = o mínimo do tipo. Derivada: nunca é gravada no elemento.
 */
export function stairHoleRegion(stair: ResolvedStair, slabThickness: number, headroom: number = stair.type.minHeadroom): MultiPolygon {
  const limit = stair.topZ - slabThickness - headroom - EPS;
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
 * Região do furo de uma escada na laje do nível de topo (decisão 0011 §6): o modo escolhido (`openingMode`), depois a
 * folga lateral (`openingMargin`, offset positivo) e, se `openingRect`, o retângulo de menor área que envolve tudo.
 * Vazia com o modo 'none' ou sem degraus que peçam furo.
 */
export function stairOpeningRegion(p: Project, s: Stair, r: ResolvedStair, levelId: Id): MultiPolygon {
  if (s.openingMode === 'none') return [];
  let region: MultiPolygon =
    s.openingMode === 'full'
      ? r.footprint
      : stairHoleRegion(r, thicknessUnder(p, levelId, r.footprint), s.openingHeadroom ?? r.type.minHeadroom);
  if (region.length === 0) return [];
  if (s.openingMargin > 0) region = offsetMulti(region, s.openingMargin);
  if (s.openingRect) region = asMulti(minAreaRect(multiPoints(region)));
  return region;
}

/**
 * Furos que as lajes e os pisos do nível recebem por causa das escadas: união das regiões de cada escada com abertura
 * (modo diferente de 'none') cujo nível de topo (explícito ou o imediatamente acima) é `levelId`. Sem essas escadas, vazio.
 */
export function stairHolesForLevel(p: Project, levelId: Id): MultiPolygon {
  const candidates = stairs(p).filter((s) => s.openingMode !== 'none' && stairTopLevel(p, s)?.id === levelId);
  if (candidates.length === 0) return [];
  const resolved = new Map(resolveStairs(p).map((r) => [r.id, r] as const));
  const parts: MultiPolygon[] = [];
  for (const s of candidates) {
    const r = resolved.get(s.id);
    if (!r) continue;
    const region = stairOpeningRegion(p, s, r, levelId);
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
