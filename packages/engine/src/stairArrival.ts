import { add, difference, mul, multiArea, ringArea, type Polygon, type Ring } from '@hestia/geom';
import { floorPolygon, floorsOnLevel, floorTypeThickness, levelElevation, slabPolygon, slabsOnLevel, slabTypeThickness, type Id, type Project } from '@hestia/model';
import { stairArrivalFrame, type StairArrivalFrame } from './stairBody.ts';
import { coverUnderside } from './stairOpenings.ts';
import type { ResolvedStair } from './stairs.ts';

/** Profundidade (m) da faixa à frente do último espelho, no sentido da subida, que a laje precisa cobrir. */
const COVER_DEPTH = 0.02;
/** Área (metros quadrados) não coberta que ainda conta como coberta (tolerância dos booleanos). */
const COVER_TOL = 1e-6;

/** Anel no sentido anti-horário (área positiva), como os contornos das lajes. */
const orient = (r: Ring): Ring => (ringArea(r) < 0 ? [...r].reverse() : r);

/** Verdadeiro se o polígono da laje ou do piso cobre a faixa (a área da faixa fora dele é desprezível). */
const coversStrip = (polygon: Polygon, strip: Ring): boolean => multiArea(difference([[strip]], [polygon])) <= COVER_TOL;

/**
 * Face inferior da laje ou do piso do nível de topo que cobre a faixa de 2 cm à frente do último espelho (m), ou null se
 * nenhum cobre. Serve para o topo da chegada (3D/corte) e para decidir se a chegada é um degrau da própria escada
 * (planta e prévia) quando NÃO há laje/piso fechando o nível.
 */
export function arrivalUnderside(p: Project, frame: StairArrivalFrame, topLevelId: Id | null): number | null {
  if (!topLevelId) return null;
  const d = mul(frame.u, COVER_DEPTH);
  const strip = orient([frame.a, frame.b, add(frame.b, d), add(frame.a, d)]);
  const undersides: number[] = [];

  for (const sl of slabsOnLevel(p, topLevelId)) {
    const type = p.slabTypes[sl.typeId];
    if (!type || sl.boundary.length < 3) continue;
    const polygon = slabPolygon(sl);
    if (!coversStrip(polygon, strip)) continue;
    const bottomZ = levelElevation(p, sl.levelId) + sl.heightOffset - slabTypeThickness(type);
    undersides.push(coverUnderside(bottomZ, sl.slope, polygon));
  }
  for (const f of floorsOnLevel(p, topLevelId)) {
    const type = p.floorTypes[f.typeId];
    if (!type || f.boundary.length < 3) continue;
    const polygon = floorPolygon(f);
    if (coversStrip(polygon, strip)) undersides.push(levelElevation(p, f.levelId) + f.heightOffset - floorTypeThickness(type));
  }
  return undersides.length ? Math.min(...undersides) : null;
}

/**
 * Cota absoluta do topo da chegada monolítica (decisão 0012 §2): a face inferior da laje ou do piso do nível de topo que
 * cobre o último espelho. Se mais de um cobre, a MENOR (conservadora, a mesma do furo, decisão 0011 §6). Laje inclinada:
 * a menor cota da face inferior no contorno (`coverUnderside`). Sem laje nem piso sobre o último espelho, ou sem chegada,
 * devolve null: a chegada usa `topZ − STAIR_ARRIVAL_SLAB_DEFAULT`.
 */
export function stairArrivalTopZ(p: Project, s: ResolvedStair): number | null {
  const frame = stairArrivalFrame(s);
  if (!frame) return null;
  return arrivalUnderside(p, frame, s.topLevelId);
}

/**
 * Topo da chegada e se o nível de cima a cobre. Sem laje nem piso que cubra o último espelho, a chegada fecha no próprio
 * nível (`topZ`): ela é o último piso da escada, e a planta/prévia têm de mostrá-la. Com laje/piso, o topo é a face
 * inferior dessa laje e o degrau de chegada é o piso do nível — a escada não desenha um degrau a mais.
 */
export function stairArrivalTop(p: Project, s: ResolvedStair): { top: number; covered: boolean } {
  const cover = stairArrivalTopZ(p, s);
  return cover === null ? { top: s.topZ, covered: false } : { top: cover, covered: true };
}

