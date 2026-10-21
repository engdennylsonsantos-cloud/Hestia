import { asMulti, boxOf, boxesOverlap, difference, minAreaRect, multiPoints, offsetMulti, union, type MultiPolygon, type Polygon } from '@hestia/geom';
import { slabRiseAt, stairs, stairTopLevel, type Id, type Project, type SlabSlope, type Stair } from '@hestia/model';
import { resolveStairs, type ResolvedStair } from './stairs.ts';

/** Tolerância de cota e de área (m, m²) nas comparações do furo. */
const EPS = 1e-9;

/**
 * Região em planta que uma laje ou piso com face inferior na cota `undersideZ` precisa vazar para a escada passar, no modo
 * "pé-direito livre" (decisão 0011 §6): união dos degraus e patamares cujo topo `z` satisfaz `undersideZ − z ≤ headroom`.
 * Mede-se a partir da cota do topo do degrau: o piso é plano, então o nariz e o resto do degrau têm a mesma cota. Um degrau
 * com folga ≤ `headroom` sai da laje; o que sobra tem folga maior. `headroom` padrão = o mínimo do tipo. Derivada: nunca
 * é gravada no elemento.
 */
export function stairHoleRegion(stair: ResolvedStair, undersideZ: number, headroom: number = stair.type.minHeadroom): MultiPolygon {
  const limit = undersideZ - headroom - EPS;
  const parts = stair.steps.filter((s) => s.z >= limit).map((s): MultiPolygon => [[s.polygon]]);
  return parts.length ? union(...parts) : [];
}

/**
 * Cota da face inferior de uma laje ou piso para o furo (decisão 0011, §6): `bottomZ` (topo do elemento menos a espessura
 * total) sem inclinação; com inclinação, a menor cota da face inferior no contorno, já que ela sobe com a face superior
 * (`slabRiseAt`). Um polígono é atingido nos vértices, então basta o mínimo deles. Usar a menor cota é conservador: a
 * folga de cabeça fica garantida em qualquer ponto do elemento, ao custo de cortar um pouco mais de degrau.
 */
export function coverUnderside(bottomZ: number, slope: SlabSlope | null, polygon: Polygon): number {
  if (!slope) return bottomZ;
  let min = Infinity;
  for (const ring of polygon) for (const q of ring) min = Math.min(min, bottomZ + slabRiseAt(slope, q));
  return Number.isFinite(min) ? min : bottomZ;
}

/** Escada com abertura (modo diferente de 'none') cujo nível de topo é o do elemento, já resolvida. */
export interface StairOpening {
  stair: Stair;
  resolved: ResolvedStair;
}

/**
 * Escadas que furam as lajes e os pisos do nível: modo diferente de 'none' e nível de topo (explícito ou o imediatamente
 * acima) igual a `levelId`. Sem essas escadas, vazio (e não resolve escada nenhuma).
 */
export function stairOpeningsOnLevel(p: Project, levelId: Id): StairOpening[] {
  const candidates = stairs(p).filter((s) => s.openingMode !== 'none' && stairTopLevel(p, s)?.id === levelId);
  if (candidates.length === 0) return [];
  const resolved = new Map(resolveStairs(p).map((r) => [r.id, r] as const));
  return candidates.flatMap((stair): StairOpening[] => {
    const r = resolved.get(stair.id);
    return r ? [{ stair, resolved: r }] : [];
  });
}

/**
 * Região do furo de uma escada numa laje ou piso com face inferior em `undersideZ` (decisão 0011 §6): o modo escolhido
 * (`openingMode`), depois a folga lateral (`openingMargin`, offset positivo) e, se `openingRect`, o retângulo de menor área
 * que envolve tudo. Vazia com o modo 'none' ou sem degraus que peçam furo. O modo 'full' não depende da cota.
 */
export function stairOpeningRegion(s: Stair, r: ResolvedStair, undersideZ: number): MultiPolygon {
  if (s.openingMode === 'none') return [];
  let region: MultiPolygon =
    s.openingMode === 'full' ? r.footprint : stairHoleRegion(r, undersideZ, s.openingHeadroom ?? r.type.minHeadroom);
  if (region.length === 0) return [];
  if (s.openingMargin > 0) region = offsetMulti(region, s.openingMargin);
  if (s.openingRect) region = asMulti(minAreaRect(multiPoints(region)));
  return region;
}

/**
 * Furo que uma laje ou piso com face inferior em `undersideZ` recebe das escadas do nível: união das regiões de cada
 * escada (`stairOpeningRegion`). Vazio sem escadas. Só vale onde o elemento cobre a escada (quem recorta é `cutStairOpenings`).
 */
export function stairHolesFor(openings: StairOpening[], undersideZ: number): MultiPolygon {
  const parts = openings.map((o) => stairOpeningRegion(o.stair, o.resolved, undersideZ)).filter((region) => region.length > 0);
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
