import { arcSample, asMulti, boxOf, closeGapsSafe, difference, pointInPolygon, union, type MultiPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { levelFrames, pointAt, type WallFrame } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';

/**
 * Silhueta de uma parede SEM os vãos: a porta não abre o espaço (o piso segue a face da parede inteira).
 * Reta: quatro cantos. Em arco: amostragem das faces sHi e sLo.
 */
export function wallSilhouette(f: WallFrame): Ring {
  if (f.arc) return [...arcSample(f.arc, 0, f.length, f.sHi), ...arcSample(f.arc, f.length, 0, f.sLo)];
  return [pointAt(f, 0, f.sHi), pointAt(f, f.length, f.sHi), pointAt(f, f.length, f.sLo), pointAt(f, 0, f.sLo)];
}

/** Margem (m) além das paredes do nível: a caixa que envolve o nível fica longe o bastante para ser "o externo". */
const MARGIN = 1;

/**
 * Espaços livres fechados pelas paredes do nível (face interna das paredes, como o "Pick Walls" do Revit).
 * Cada espaço é um polígono: anel externo = borda do espaço; furos = ilhas de parede soltas dentro dele.
 * O espaço que toca a caixa envolvente é o exterior infinito e não entra.
 */
export function enclosedRooms(p: Project, levelId: Id): Polygon[] {
  const frames = levelFrames(p, levelId);
  if (frames.length === 0) return [];
  const walls = closeGapsSafe(union(...frames.map((f) => asMulti(wallSilhouette(f)))));
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
