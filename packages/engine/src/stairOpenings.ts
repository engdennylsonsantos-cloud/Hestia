import { add, asMulti, boxOf, boxesOverlap, difference, dist, minAreaRect, mul, multiArea, multiPoints, offsetMulti, ringArea, sub, union, type MultiPolygon, type Polygon, type Vec2 } from '@hestia/geom';
import { slabRiseAt, stairs, stairTopLevel, type Id, type Project, type SlabSlope, type Stair } from '@hestia/model';
import { stairArrivalFrame, type StairArrivalFrame } from './stairBody.ts';
import { resolveStairOne, type ResolvedStair } from './stairs.ts';

/** Tolerância de cota e de área (m e metros quadrados) nas comparações do furo. */
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
  // Só as candidatas do nível de topo são resolvidas (cada uma uma vez por projeto, pelo memo de `resolveStairOne`).
  return candidates.flatMap((stair): StairOpening[] => {
    const r = resolveStairOne(p, stair);
    return r ? [{ stair, resolved: r }] : [];
  });
}

/** Lados do polígono do disco do caracol no furo 'full' (decisão 0014 §11). */
const SPIRAL_DISK_SIDES = 48;

/**
 * Disco do caracol (decisão 0014 §11): polígono de 48 lados de raio `rOuter`, centrado em `center`. Inclui o miolo do poste,
 * porque a projeção inteira do caracol é o disco do limite externo.
 */
export function spiralDiskRegion(center: Vec2, rOuter: number): MultiPolygon {
  const ring = Array.from({ length: SPIRAL_DISK_SIDES }, (_, i) => {
    const a = (2 * Math.PI * i) / SPIRAL_DISK_SIDES;
    return { x: center.x + rOuter * Math.cos(a), y: center.y + rOuter * Math.sin(a) };
  });
  return [[ring]];
}

/** Vão máximo (m) entre lances que a laje não deixa de filete: o furo o fecha (o vão do U mede 0,10 m por padrão). */
const MAX_WELL_GAP = 0.3;
/** Área (m²) mínima que o fechamento precisa acrescentar para valer; abaixo é só o arredondamento do recorte. */
const WELL_MIN_AREA = 1e-4;

/**
 * Fecha os vãos estreitos entre lances (U): o furo cresce e encolhe `MAX_WELL_GAP ÷ 2`, o que preenche o que for mais fino
 * que o vão e mantém o resto. Sem vão a fechar, devolve a própria região (o recorte arredonda e não deve mexer à toa).
 */
export function closeWells(region: MultiPolygon): MultiPolygon {
  const c = MAX_WELL_GAP / 2 + 1e-3;
  const closed = offsetMulti(offsetMulti(region, c), -c);
  return multiArea(closed) - multiArea(region) > WELL_MIN_AREA ? closed : region;
}

/**
 * Tira do furo a faixa da folga que passa do último espelho: dali em diante é o piso de cima, e o vão deixaria à mostra a
 * chegada da escada, um degrau abaixo do piso. Só corta o que a folga (`depth`) acrescentou; o contorno dos degraus não passa dali.
 */
export function trimBeyondTop(region: MultiPolygon, frame: StairArrivalFrame, depth: number): MultiPolygon {
  const side = mul(sub(frame.b, frame.a), depth / dist(frame.a, frame.b));
  const ahead = mul(frame.u, depth);
  const a = sub(frame.a, side);
  const b = add(frame.b, side);
  const ring = [a, b, add(b, ahead), add(a, ahead)];
  return difference(region, [[ringArea(ring) < 0 ? ring.reverse() : ring]]);
}

/**
 * Região do furo de uma escada numa laje ou piso com face inferior em `undersideZ` (decisão 0011 §6): o modo escolhido
 * (`openingMode`), depois a folga (`openingMargin`, offset positivo, sem passar do último espelho) e, se `openingRect`, o retângulo de menor área
 * que envolve tudo. Vazia com o modo 'none' ou sem degraus que peçam furo. O modo 'full' não depende da cota: é a projeção
 * da escada, e no caracol (decisão 0014 §11) é o disco de raio externo.
 */
export function stairOpeningRegion(s: Stair, r: ResolvedStair, undersideZ: number): MultiPolygon {
  if (s.openingMode === 'none') return [];
  const full: MultiPolygon = r.spiral ? spiralDiskRegion(r.spiral.center, r.spiral.rOuter) : r.footprint;
  let region: MultiPolygon = s.openingMode === 'full' ? full : stairHoleRegion(r, undersideZ, s.openingHeadroom ?? r.type.minHeadroom);
  if (region.length === 0) return [];
  if (!r.spiral) region = closeWells(region);
  if (s.openingMargin > 0) {
    region = offsetMulti(region, s.openingMargin);
    const top = r.spiral ? null : stairArrivalFrame(r);
    if (top) region = trimBeyondTop(region, top, s.openingMargin + 0.01);
  }
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
