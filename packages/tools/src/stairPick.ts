import { boxOf, closestOnSegment, dist, intersectSegments, pointInRing, type Box, type Ring, type Vec2 } from '@hestia/geom';
import { isStair, stairsOnLevel, type Id, type Project, type StairCurve, type StairLanding, type StairRun } from '@hestia/model';
import { sampleChain, sampleCurve } from '@hestia/engine';

/** Escadas entre os selecionados. */
export const selectedStairs = (p: Project, ids: Id[]): Id[] => ids.filter((id) => isStair(p.elements[id]));

/** Elemento com croqui de lances e patamares: a escada e a rampa usam os mesmos componentes. */
export interface ComponentSketchHolder {
  components: Array<StairRun | StairLanding>;
}

/** Polilinhas amostradas de uma escada (ou rampa): cada limite, cada espelho, a caminhada e o contorno de cada patamar. */
export function stairPolylines(s: ComponentSketchHolder): Vec2[][] {
  const out: Vec2[][] = [];
  for (const c of s.components) {
    if (c.kind === 'landing') {
      if (c.boundary.length) out.push(sampleChain(c.boundary));
      continue;
    }
    if (c.boundaryLeft.length) out.push(sampleChain(c.boundaryLeft));
    if (c.boundaryRight.length) out.push(sampleChain(c.boundaryRight));
    for (const r of c.risers) out.push(sampleCurve(r));
    if (c.path.length) out.push(sampleChain(c.path));
  }
  return out;
}

/** Contorno de cada lance (limite esquerdo, depois o direito de volta) e de cada patamar. Vazio se o lance está incompleto. */
export function stairRings(s: ComponentSketchHolder): Ring[] {
  const out: Ring[] = [];
  for (const c of s.components) {
    if (c.kind === 'landing') {
      const ring = c.boundary.length ? sampleChain(c.boundary) : [];
      if (ring.length >= 3) out.push(ring);
    } else if (c.boundaryLeft.length && c.boundaryRight.length) {
      out.push([...sampleChain(c.boundaryLeft), ...sampleChain(c.boundaryRight).reverse()]);
    }
  }
  return out;
}

/** Distância de `at` à polilinha `pl` (menor entre os segmentos). */
function distToPolyline(at: Vec2, pl: Vec2[]): number {
  if (pl.length === 1) return dist(at, pl[0]!);
  let best = Infinity;
  for (let i = 1; i < pl.length; i++) best = Math.min(best, dist(at, closestOnSegment(at, pl[i - 1]!, pl[i]!)));
  return best;
}

/** Escada sob o cursor: dentro do contorno de um lance ou patamar, ou sobre uma linha (limite, espelho, caminhada). A mais recente vence. */
export function pickStairAt(p: Project, levelId: Id, at: Vec2, mpp: number): Id | null {
  const tol = 4 * mpp;
  const stairs = stairsOnLevel(p, levelId);
  for (let i = stairs.length - 1; i >= 0; i--) {
    const s = stairs[i]!;
    if (stairPolylines(s).some((pl) => distToPolyline(at, pl) <= tol)) return s.id;
    if (stairRings(s).some((r) => pointInRing(at, r))) return s.id;
  }
  return null;
}

/** Escadas cujo desenho cabe na janela (esq→dir) ou que a cruzam (dir→esq), como nas lajes. */
export function stairIdsInBox(p: Project, levelId: Id, a: Vec2, b: Vec2): Id[] {
  const box = boxOf([a, b]);
  const crossing = b.x < a.x;
  return stairsOnLevel(p, levelId)
    .filter((s) => {
      const lines = stairPolylines(s);
      const pts = lines.flat();
      if (pts.length === 0) return false;
      if (pts.every((q) => inBox(q, box))) return true;
      return crossing && lines.some((pl) => polylineTouchesBox(pl, box));
    })
    .map((s) => s.id);
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

/** Pontos de captura: as extremidades de todos os trechos das escadas do nível (e do que se desenha, na ferramenta). */
export function stairSnapPoints(p: Project, levelId: Id): Vec2[] {
  const out: Vec2[] = [];
  for (const s of stairsOnLevel(p, levelId)) out.push(...stairEndpoints(s));
  return out;
}

/** Extremidades de cada curva da escada (ou rampa): limites, espelhos, caminhada e contornos de patamar. */
export function stairEndpoints(s: ComponentSketchHolder): Vec2[] {
  const curves: StairCurve[] = [];
  for (const c of s.components) {
    if (c.kind === 'landing') curves.push(...c.boundary);
    else curves.push(...c.boundaryLeft, ...c.boundaryRight, ...c.risers, ...c.path);
  }
  return curves.flatMap((c) => [c.a, c.b]);
}
