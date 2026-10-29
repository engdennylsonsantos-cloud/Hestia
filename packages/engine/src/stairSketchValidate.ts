import {
  chainBroken,
  makePoly,
  polyDist,
  prepareRun,
  PATH_TOL,
  sampleChain,
  sketchIssue,
  TOUCH_TOL,
  walkOf,
  type Prepared,
  type RiserGeom,
  type StairRunSketch,
  type StairSketchIssue,
} from './stairSketchGeom.ts';
import { defaultUnits, formatQuantity, type ResolvedUnits } from '@hestia/model';
import { dist, type Vec2 } from '@hestia/geom';
import { spiralSweepOf } from './stairSpiral.ts';

/**
 * Opções do croqui. `sweep`: varredura (rad, com sinal) de um caracol, que separa os espelhos por volta (`turnsOf`). Sem
 * ela, vale a do metadado `spiral` do lance, se houver (decisão 0014 §1 item 2); croqui livre não tem varredura.
 */
export interface RunSketchOptions {
  sweep?: number;
  /** Unidades do projeto para as mensagens (padrão: as de fábrica). */
  units?: ResolvedUnits;
}

/**
 * Valida o croqui de um lance (decisão 0011 §3). Só erros de geometria: espelho que passa do limite é aparado
 * e não gera erro. Códigos e textos: `STAIR_SKETCH_MESSAGES`. Com `sweep` (caracol), espelhos de voltas diferentes não
 * se comparam em planta (decisão 0014 §1 item 3).
 */
export function validateRunSketch(run: StairRunSketch, opts: RunSketchOptions = {}): StairSketchIssue[] {
  return validatePrepared(run, prepareRun(run), opts.sweep ?? spiralSweepOf(run), opts.units);
}

export function validatePrepared(run: StairRunSketch, P: Prepared, sweep?: number, units?: ResolvedUnits): StairSketchIssue[] {
  const u = units ?? defaultUnits();
  const out: StairSketchIssue[] = [];
  if (chainBroken(run.boundaryLeft)) out.push(sketchIssue('stair-boundary-gap'));
  if (chainBroken(run.boundaryRight)) out.push(sketchIssue('stair-boundary-gap'));
  if (P.L.pts.length > 0 && P.R.pts.length > 0 && polyDist(P.L.pts, P.R.pts) <= TOUCH_TOL) {
    out.push(sketchIssue('stair-boundaries-touch'));
  }
  checkRisers(P, u, out);
  checkRiserPairs(P, out, u, sweep !== undefined ? turnsOf(run, P, sweep) : undefined);
  if (run.path.length > 0) checkPath(run, P, out);
  return out;
}

/**
 * Volta de cada espelho (por índice do vetor) num caracol de varredura `sweep` (decisão 0014 §1 item 3). Com k a posição
 * do espelho na ordem de subida, o ângulo acumulado é k·|sweep|/(N−1) e a volta é floor(ângulo ÷ 2π). Espelhos de voltas
 * diferentes têm cotas diferentes (um degrau de altura h por espelho, pelo menos), por isso não se comparam em planta.
 * A volta vizinha na emenda (espelhos consecutivos) fica nesse caso: a diferença de cota é h, nunca menor que h.
 */
export function turnsOf(run: StairRunSketch, P: Prepared, sweep: number): Map<number, number> {
  const turn = new Map<number, number>();
  const n = P.risers.length;
  if (n < 2 || !(sweep !== 0) || !Number.isFinite(sweep)) return turn;
  const step = Math.abs(sweep) / (n - 1);
  walkOf(P, run, true).order.forEach((i, k) => turn.set(i, Math.floor((k * step) / (2 * Math.PI) + 1e-9)));
  return turn;
}

function checkRisers(P: Prepared, u: ResolvedUnits, out: StairSketchIssue[]): void {
  for (const g of P.risers) {
    if (g.onBoundary) {
      out.push(sketchIssue('stair-riser-on-boundary', g.index));
      continue;
    }
    const nL = g.hitsL.length;
    const nR = g.hitsR.length;
    if (nL > 1 || nR > 1) out.push(sketchIssue('stair-riser-boundary-multi', g.index));
    else if (nL === 0 || nR === 0) out.push(notSpanning(P, g, u, nL === 0 ? 'esquerdo' : 'direito'));
  }
}

/** Distância na unidade de medida pequena do projeto (cm por padrão), com uma casa. */
const gapText = (u: ResolvedUnits, m: number): string => formatQuantity(u, 'smallLength', m, { decimals: 1 });

/**
 * Espelho que não liga os limites: diz qual espelho (nº no croqui), qual limite falta e por quanto (a menor distância das
 * pontas do espelho até o limite). Se os dois faltam, o do lado que falta mais.
 */
function notSpanning(P: Prepared, g: RiserGeom, u: ResolvedUnits, side: 'esquerdo' | 'direito'): StairSketchIssue {
  const boundary = side === 'esquerdo' ? P.L : P.R;
  const ends = [g.full.pts[0]!, g.full.pts[g.full.pts.length - 1]!];
  const gap = Math.min(...ends.map((e) => polyDist([e], boundary.pts)));
  const text = `Espelho nº ${g.index + 1}: deve ligar o limite esquerdo ao direito, mas não chega ao limite ${side} (falta ${gapText(u, gap)}).`;
  return sketchIssue('stair-riser-not-spanning', g.index, text);
}

/**
 * Pares de espelhos que ligam os dois limites: mesma posição, ou que se tocam/cruzam depois de aparados. Com `turn`
 * (caracol), só se comparam espelhos da mesma volta.
 */
function checkRiserPairs(P: Prepared, out: StairSketchIssue[], u: ResolvedUnits, turn?: Map<number, number>): void {
  const spanning = P.risers.filter((g) => g.spans && g.trimmed);
  for (let i = 0; i < spanning.length; i++) {
    for (let j = i + 1; j < spanning.length; j++) {
      const ga = spanning[i]!;
      const gb = spanning[j]!;
      if (turn && turn.get(ga.index) !== turn.get(gb.index)) continue;
      const A = ga.trimmed!;
      const B = gb.trimmed!;
      const sameA = dist(A[0]!, B[0]!) <= TOUCH_TOL;
      const sameB = dist(A[A.length - 1]!, B[B.length - 1]!) <= TOUCH_TOL;
      // Os dois espelhos pelo nº no croqui e a distância entre eles (em cm), para o usuário achar os dois.
      const pair = `Espelhos nº ${ga.index + 1} e nº ${gb.index + 1}`;
      const d = polyDist(A, B);
      if (sameA && sameB) {
        out.push(sketchIssue('stair-riser-same-location', ga.index, `${pair} ocupam a mesma posição (distância ${gapText(u, d)}).`));
      } else if (d <= TOUCH_TOL) {
        out.push(sketchIssue('stair-riser-crossing', ga.index, `${pair} se cruzam ou se tocam: não são permitidos (distância ${gapText(u, d)}).`));
      }
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
  const order = walkOf(P, run, false).order;
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
