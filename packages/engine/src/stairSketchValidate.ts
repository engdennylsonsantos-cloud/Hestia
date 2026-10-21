import {
  chainBroken,
  makePoly,
  orderBy,
  polyDist,
  prepareRun,
  PATH_TOL,
  sampleChain,
  sketchIssue,
  TOUCH_TOL,
  type Prepared,
  type StairRunSketch,
  type StairSketchIssue,
} from './stairSketchGeom.ts';
import { dist, type Vec2 } from '@hestia/geom';

/**
 * Valida o croqui de um lance (decisão 0011 §3). Só erros de geometria: espelho que passa do limite é aparado
 * e não gera erro. Códigos e textos: `STAIR_SKETCH_MESSAGES`.
 */
export function validateRunSketch(run: StairRunSketch): StairSketchIssue[] {
  return validatePrepared(run, prepareRun(run));
}

export function validatePrepared(run: StairRunSketch, P: Prepared): StairSketchIssue[] {
  const out: StairSketchIssue[] = [];
  if (chainBroken(run.boundaryLeft)) out.push(sketchIssue('stair-boundary-gap'));
  if (chainBroken(run.boundaryRight)) out.push(sketchIssue('stair-boundary-gap'));
  if (P.L.pts.length > 0 && P.R.pts.length > 0 && polyDist(P.L.pts, P.R.pts) <= TOUCH_TOL) {
    out.push(sketchIssue('stair-boundaries-touch'));
  }
  checkRisers(P, out);
  checkRiserPairs(P, out);
  if (run.path.length > 0) checkPath(run, P, out);
  return out;
}

function checkRisers(P: Prepared, out: StairSketchIssue[]): void {
  for (const g of P.risers) {
    if (g.onBoundary) {
      out.push(sketchIssue('stair-riser-on-boundary', g.index));
      continue;
    }
    const nL = g.hitsL.length;
    const nR = g.hitsR.length;
    if (nL > 1 || nR > 1) out.push(sketchIssue('stair-riser-boundary-multi', g.index));
    else if (nL === 0 || nR === 0) out.push(sketchIssue('stair-riser-not-spanning', g.index));
  }
}

/** Pares de espelhos que ligam os dois limites: mesma posição, ou que se tocam/cruzam depois de aparados. */
function checkRiserPairs(P: Prepared, out: StairSketchIssue[]): void {
  const spanning = P.risers.filter((g) => g.spans && g.trimmed);
  for (let i = 0; i < spanning.length; i++) {
    for (let j = i + 1; j < spanning.length; j++) {
      const A = spanning[i]!.trimmed!;
      const B = spanning[j]!.trimmed!;
      const sameA = dist(A[0]!, B[0]!) <= TOUCH_TOL;
      const sameB = dist(A[A.length - 1]!, B[B.length - 1]!) <= TOUCH_TOL;
      if (sameA && sameB) out.push(sketchIssue('stair-riser-same-location', spanning[i]!.index));
      else if (polyDist(A, B) <= TOUCH_TOL) out.push(sketchIssue('stair-riser-crossing', spanning[i]!.index));
    }
  }
}

function checkPath(run: StairRunSketch, P: Prepared, out: StairSketchIssue[]): void {
  const path = makePoly(sampleChain(run.path));
  if (path.pts.length < 2) {
    out.push(sketchIssue('stair-path-ends'));
    return;
  }
  // Primeiro e último espelho pela ordem dos limites (a caminhada ainda não define a ordem aqui).
  const order = orderBy(P, run, false);
  if (order.length === 0) return;
  const first = P.risers[order[0]!]!;
  const last = P.risers[order[order.length - 1]!]!;
  const start: Vec2 = path.pts[0]!;
  const end: Vec2 = path.pts[path.pts.length - 1]!;
  if (polyDist([start], first.geom.pts) > PATH_TOL || polyDist([end], last.geom.pts) > PATH_TOL) {
    out.push(sketchIssue('stair-path-ends'));
  }
  for (const g of P.risers) {
    if (polyDist(path.pts, g.geom.pts) > PATH_TOL) out.push(sketchIssue('stair-path-misses-riser', g.index));
  }
}
