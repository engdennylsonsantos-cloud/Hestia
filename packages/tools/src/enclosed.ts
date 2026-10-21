import { arcSample, asMulti, boxOf, closeGapsSafe, closestOnSegment, dist, difference, pointInPolygon, pointInRing, ringArea, union, type MultiPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { levelFrames, pointAt, sAtDepth, wallFaces, type WallFrame } from '@hestia/engine';
import { coreSpan, type Id, type Project } from '@hestia/model';

/** Faixa de uma parede entre as posições s1 e s2 (perpendiculares ao eixo): quatro cantos, ou amostragem em arco. */
function bandRing(f: WallFrame, s1: number, s2: number): Ring {
  const hi = Math.max(s1, s2);
  const lo = Math.min(s1, s2);
  if (f.arc) return [...arcSample(f.arc, 0, f.length, hi), ...arcSample(f.arc, f.length, 0, lo)];
  return [pointAt(f, 0, hi), pointAt(f, f.length, hi), pointAt(f, f.length, lo), pointAt(f, 0, lo)];
}

/**
 * Silhueta de uma parede SEM os vãos: a porta não abre o espaço (o piso segue a face da parede inteira).
 * Reta: quatro cantos. Em arco: amostragem das faces sHi e sLo.
 */
export function wallSilhouette(f: WallFrame): Ring {
  return bandRing(f, f.sHi, f.sLo);
}

/** Silhueta só do núcleo: o espaço livre cresce pelo reboco até a face do núcleo (extensão "até o núcleo"). */
function coreSilhouette(f: WallFrame): Ring {
  const cs = coreSpan(f.type);
  return bandRing(f, sAtDepth(f, cs.from), sAtDepth(f, cs.to));
}

/** Margem (m) além das paredes do nível: a caixa que envolve o nível fica longe o bastante para ser "o externo". */
const MARGIN = 1;

/** Alcance (m) do clique até a edificação no perímetro: mais longe que isso não há "casa" ali. */
const PERIMETER_REACH = 1.5;

/** `finish`: o espaço para na face de acabamento (padrão). `core`: avança por baixo do reboco até a face do núcleo. */
export type RoomExtend = 'finish' | 'core';

/**
 * Espaços livres fechados pelas paredes do nível (face interna das paredes, como o "Pick Walls" do Revit).
 * Cada espaço é um polígono: anel externo = borda do espaço; furos = ilhas de parede soltas dentro dele.
 * O espaço que toca a caixa envolvente é o exterior infinito e não entra.
 */
export function enclosedRooms(p: Project, levelId: Id, extend: RoomExtend = 'finish'): Polygon[] {
  const frames = levelFrames(p, levelId);
  if (frames.length === 0) return [];
  const piece = extend === 'core' ? coreSilhouette : wallSilhouette;
  const walls = closeGapsSafe(union(...frames.map((f) => asMulti(piece(f)))));
  const box = boxOf(walls.flatMap((poly) => poly.flat()));
  const b = { minX: box.minX - MARGIN, minY: box.minY - MARGIN, maxX: box.maxX + MARGIN, maxY: box.maxY + MARGIN };
  const frame: Ring = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
  const free: MultiPolygon = difference(asMulti(frame), walls);
  const onFrame = (v: Vec2): boolean => {
    const eps = 1e-6;
    return Math.abs(v.x - b.minX) < eps || Math.abs(v.x - b.maxX) < eps || Math.abs(v.y - b.minY) < eps || Math.abs(v.y - b.maxY) < eps;
  };
  return free.filter((poly) => poly.length > 0 && !poly[0]!.some(onFrame));
}

/** Espaço fechado que contém o ponto (dentro do anel externo e fora dos furos), ou null se o ponto está livre no exterior. */
export function roomAt(rooms: Polygon[], at: Vec2): Polygon | null {
  return rooms.find((r) => pointInPolygon(at, r)) ?? null;
}

/** Espaço fechado por paredes que contém o ponto, ou null se não há área fechada ali. */
export function enclosedRegionAt(p: Project, levelId: Id, at: Vec2): Polygon | null {
  return roomAt(enclosedRooms(p, levelId), at);
}

/**
 * Contorno de cada parede para a edificação: o `outline` de `wallFaces` (esquadria, encosto, T, degraus das pontas e
 * arcos). Só cai na faixa reta se `wallFaces` não tiver a parede.
 */
function outlinePieces(p: Project, levelId: Id, frames: WallFrame[]): Ring[] {
  const outlines = new Map(wallFaces(p, levelId).map((w) => [w.wallId, w.outline] as const));
  return frames.map((f) => outlines.get(f.wall.id) ?? bandRing(f, f.sHi, f.sLo));
}

/** Projeto é imutável (Immer): a identidade serve de chave, como no cache de faces da captura. */
const outlinesCache = new WeakMap<Project, Map<Id, Ring[]>>();

/** Contorno externo de cada conjunto de paredes ligado do nível (união sem furos internos). Vãos não recortam. */
function buildingOutlines(p: Project, levelId: Id): Ring[] {
  let byLevel = outlinesCache.get(p);
  if (!byLevel) {
    byLevel = new Map();
    outlinesCache.set(p, byLevel);
  }
  const hit = byLevel.get(levelId);
  if (hit) return hit;
  const frames = levelFrames(p, levelId);
  const value: Ring[] = frames.length === 0 ? [] : closeGapsSafe(union(...outlinePieces(p, levelId, frames).map((r) => asMulti(r)))).map((poly) => poly[0]!);
  byLevel.set(levelId, value);
  return value;
}

/** Distância do ponto ao contorno (suas arestas). */
function distToRing(q: Vec2, r: Ring): number {
  let d = Infinity;
  for (let i = 0; i < r.length; i++) d = Math.min(d, dist(q, closestOnSegment(q, r[i]!, r[(i + 1) % r.length]!)));
  return d;
}

/**
 * Contorno pela FACE EXTERNA da edificação (anel externo da união das paredes do nível, sem furos).
 * Com `near`: a edificação que contém o ponto; senão a mais próxima dele (até PERIMETER_REACH). Sem `near`: a maior.
 * Devolve só o anel externo, ou null se não há paredes ali.
 */
export function outerPerimeter(p: Project, levelId: Id, near?: Vec2): Ring | null {
  const rings = buildingOutlines(p, levelId);
  if (rings.length === 0) return null;
  if (!near) return rings.reduce((best, r) => (Math.abs(ringArea(r)) > Math.abs(ringArea(best)) ? r : best));
  const holding = rings.find((r) => pointInRing(near, r));
  if (holding) return holding;
  let best: { ring: Ring; d: number } | null = null;
  for (const r of rings) {
    const d = distToRing(near, r);
    if (!best || d < best.d) best = { ring: r, d };
  }
  return best && best.d <= PERIMETER_REACH ? best.ring : null;
}
