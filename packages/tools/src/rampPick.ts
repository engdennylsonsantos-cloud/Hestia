import { boxOf, closestOnSegment, dist, intersectSegments, pointInRing, type Box, type Ring, type Vec2 } from '@hestia/geom';
import { isRamp, rampsOnLevel, type Id, type Project, type Ramp } from '@hestia/model';
import { stairEndpoints, stairPolylines, stairRings } from './stairPick.ts';

/** Rampas entre os selecionados. */
export const selectedRamps = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isRamp(p.elements[id]));

/** Polilinhas amostradas de uma rampa (as mesmas da escada: limites, bordas, caminhada e patamares). */
export const rampPolylines = (r: Ramp): Vec2[][] => stairPolylines(r);

/** Contorno de cada lance e de cada patamar da rampa. */
export const rampRings = (r: Ramp): Ring[] => stairRings(r);

/** Distância de `at` à polilinha `pl` (menor entre os segmentos). */
function distToPolyline(at: Vec2, pl: Vec2[]): number {
  if (pl.length === 1) return dist(at, pl[0]!);
  let best = Infinity;
  for (let i = 1; i < pl.length; i++) best = Math.min(best, dist(at, closestOnSegment(at, pl[i - 1]!, pl[i]!)));
  return best;
}

const inBox = (q: Vec2, box: Box): boolean => q.x >= box.minX && q.x <= box.maxX && q.y >= box.minY && q.y <= box.maxY;

/** Polilinha com um vértice dentro da janela, ou com um segmento que cruza uma aresta dela. */
function polylineTouchesBox(pl: Vec2[], box: Box): boolean {
  const corners: Vec2[] = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
  if (pl.some((q) => inBox(q, box))) return true;
  for (let i = 1; i < pl.length; i++) {
    for (let k = 0; k < 4; k++) {
      if (intersectSegments(pl[i - 1]!, pl[i]!, corners[k]!, corners[(k + 1) % 4]!) !== null) return true;
    }
  }
  return false;
}

/** Rampa sob o cursor: dentro do contorno de um lance ou patamar, ou sobre uma linha. A mais recente vence. */
export function pickRampAt(p: Project, levelId: Id, at: Vec2, mpp: number): Id | null {
  const tol = 4 * mpp;
  const list = rampsOnLevel(p, levelId);
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i]!;
    if (rampPolylines(r).some((pl) => distToPolyline(at, pl) <= tol)) return r.id;
    if (rampRings(r).some((ring) => pointInRing(at, ring))) return r.id;
  }
  return null;
}

/** Rampas cujo desenho cabe na janela (esq→dir) ou que a cruzam (dir→esq), como nas escadas. */
export function rampIdsInBox(p: Project, levelId: Id, a: Vec2, b: Vec2): Id[] {
  const box = boxOf([a, b]);
  const crossing = b.x < a.x;
  return rampsOnLevel(p, levelId)
    .filter((r) => {
      const lines = rampPolylines(r);
      const pts = lines.flat();
      if (pts.length === 0) return false;
      if (pts.every((q) => inBox(q, box))) return true;
      return crossing && lines.some((pl) => polylineTouchesBox(pl, box));
    })
    .map((r) => r.id);
}

/** Pontos de captura: as extremidades de todos os trechos das rampas do nível. */
export function rampSnapPoints(p: Project, levelId: Id): Vec2[] {
  const out: Vec2[] = [];
  for (const r of rampsOnLevel(p, levelId)) out.push(...rampEndpoints(r));
  return out;
}

/** Extremidades de cada curva da rampa (limites, bordas, caminhada e contornos de patamar). */
export const rampEndpoints = (r: Ramp): Vec2[] => stairEndpoints(r);
