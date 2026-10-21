import {
  add,
  arcFromSagitta,
  arcSample,
  closestOnSegment,
  cross,
  dist,
  dot,
  lerp,
  len,
  mid,
  mul,
  norm,
  sub,
  type Vec2,
} from '@hestia/geom';

/** Reta (sag = 0) ou arco por flecha, mesma convenção de `arcFromSagitta`. Estrutura igual a `StairCurve` do modelo. */
export interface StairCurve {
  a: Vec2;
  b: Vec2;
  sag: number;
}

/** Croqui de um lance (decisão 0011 §2). Os limites são cadeias contínuas; o esquerdo fica à esquerda no sentido de subida. */
export interface StairRunSketch {
  boundaryLeft: StairCurve[];
  boundaryRight: StairCurve[];
  risers: StairCurve[];
  path: StairCurve[];
}

export interface StairLandingSketch {
  boundary: StairCurve[];
}

export interface StairSketchIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  /** Índice do espelho em `run.risers` (a ordem do vetor não tem relação com a subida). */
  riserIndex?: number;
}

/** Erro máximo de corda ao amostrar arcos: flecha de 0,3 mm. */
export const SAMPLE_TOL = 0.0003;
/** Continuidade entre segmentos de uma cadeia (m). */
export const CHAIN_TOL = 1e-6;
/** Toque ou cruzamento entre linhas (m). */
export const TOUCH_TOL = 1e-6;
/** Distância máxima para a caminhada encostar em um espelho (m). */
export const PATH_TOL = 1e-3;
const POINT_TOL = 1e-7;
const SEG_TOL = 1e-9;

/** Textos exatos da decisão 0011 §3 (pt-BR). */
export const STAIR_SKETCH_MESSAGES: Record<string, string> = {
  'stair-boundaries-touch': 'Os limites esquerdo e direito do lance não podem se tocar.',
  'stair-boundary-gap': 'Cada limite deve ser uma cadeia contínua de retas e arcos.',
  'stair-riser-on-boundary': 'Parte do espelho está sobre o limite: não é permitido.',
  'stair-riser-crossing': 'Espelhos que se cruzam não são permitidos.',
  'stair-riser-boundary-multi': 'O espelho cruza o mesmo limite mais de uma vez.',
  'stair-riser-not-spanning': 'Cada espelho deve ligar o limite esquerdo ao direito.',
  'stair-riser-same-location': 'Dois espelhos ocupam a mesma posição.',
  'stair-path-ends': 'A caminhada deve ir do primeiro ao último espelho.',
  'stair-path-misses-riser': 'A caminhada não cruza todos os espelhos.',
  'stair-landing-open': 'O contorno do patamar deve ser um laço fechado.',
};

export function sketchIssue(code: string, riserIndex?: number): StairSketchIssue {
  const issue: StairSketchIssue = { code, severity: 'error', message: STAIR_SKETCH_MESSAGES[code] ?? code };
  if (riserIndex !== undefined) issue.riserIndex = riserIndex;
  return issue;
}

/** Amostra uma reta (2 pontos) ou um arco em polilinha, com erro de corda ≤ `step` (padrão 0,3 mm). */
export function sampleCurve(c: StairCurve, step = SAMPLE_TOL): Vec2[] {
  const arc = Math.abs(c.sag) < 1e-6 ? null : arcFromSagitta(c.a, c.b, c.sag);
  if (!arc) return [{ ...c.a }, { ...c.b }];
  const pts = arcSample(arc, 0, arc.length, 0, step);
  pts[0] = { ...c.a };
  pts[pts.length - 1] = { ...c.b };
  return pts;
}

export function pushDistinct(out: Vec2[], p: Vec2): void {
  const last = out[out.length - 1];
  if (!last || dist(last, p) > POINT_TOL) out.push(p);
}

/** Cadeia amostrada sem pontos repetidos nas emendas. */
export function sampleChain(cs: StairCurve[]): Vec2[] {
  const out: Vec2[] = [];
  for (const c of cs) for (const p of sampleCurve(c)) pushDistinct(out, p);
  return out;
}

/** Vazia, ou com emenda que não encosta (fim de um segmento ≠ início do seguinte). */
export function chainBroken(cs: StairCurve[]): boolean {
  if (cs.length === 0) return true;
  for (let i = 1; i < cs.length; i++) if (dist(cs[i - 1]!.b, cs[i]!.a) > CHAIN_TOL) return true;
  return false;
}

/** Polilinha com comprimento de arco acumulado (`cum[i]` é a distância do início até `pts[i]`). */
export interface Poly {
  pts: Vec2[];
  cum: number[];
}

export function makePoly(pts: Vec2[]): Poly {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
  return { pts, cum };
}

export const polyLength = (p: Poly): number => p.cum[p.cum.length - 1] ?? 0;
const segCount = (p: Poly): number => Math.max(0, p.pts.length - 1);
const segLen = (p: Poly, i: number): number => p.cum[i + 1]! - p.cum[i]!;

/** Índice j do segmento que contém o comprimento `s` (cum[j] ≤ s ≤ cum[j+1]). */
export function segAt(p: Poly, s: number): number {
  let j = 0;
  while (j < segCount(p) - 1 && p.cum[j + 1]! < s) j++;
  return j;
}

/** Ponto à distância `s` do início (limitado às extremidades). */
export function pointAtLength(p: Poly, s: number): Vec2 {
  const n = p.pts.length;
  if (n === 1 || s <= 0) return p.pts[0]!;
  if (s >= polyLength(p)) return p.pts[n - 1]!;
  const j = segAt(p, s);
  const l = segLen(p, j);
  return lerp(p.pts[j]!, p.pts[j + 1]!, l < 1e-12 ? 0 : (s - p.cum[j]!) / l);
}

/** Ponto de um cruzamento entre espelho e outra polilinha: `s` no espelho, `sb` na outra. */
export interface Hit {
  p: Vec2;
  s: number;
  sb: number;
}

/** Interseção de dois segmentos fechados. Null se paralelos (inclusive colineares) ou sem interseção. */
export function segmentHit(
  p1: Vec2,
  p2: Vec2,
  q1: Vec2,
  q2: Vec2,
): { point: Vec2; t: number; u: number } | null {
  const d = sub(p2, p1);
  const e = sub(q2, q1);
  const den = cross(d, e);
  if (Math.abs(den) <= 1e-12 * len(d) * len(e)) return null;
  const qp = sub(q1, p1);
  const t = cross(qp, e) / den;
  const u = cross(qp, d) / den;
  if (t < -SEG_TOL || t > 1 + SEG_TOL || u < -SEG_TOL || u > 1 + SEG_TOL) return null;
  const tc = Math.min(1, Math.max(0, t));
  const uc = Math.min(1, Math.max(0, u));
  return { point: add(p1, mul(d, tc)), t: tc, u: uc };
}

/** Cruzamentos de `A` com `B` (pontos distintos). `s` vem de `A`, `sb` de `B`. */
export function crossings(A: Poly, B: Poly): Hit[] {
  const out: Hit[] = [];
  for (let i = 0; i < segCount(A); i++) {
    for (let j = 0; j < segCount(B); j++) {
      const h = segmentHit(A.pts[i]!, A.pts[i + 1]!, B.pts[j]!, B.pts[j + 1]!);
      if (!h) continue;
      const hit: Hit = { p: h.point, s: A.cum[i]! + h.t * segLen(A, i), sb: B.cum[j]! + h.u * segLen(B, j) };
      if (!out.some((o) => dist(o.p, hit.p) <= TOUCH_TOL)) out.push(hit);
    }
  }
  return out;
}

/** Há trecho de sobreposição colinear (comprimento > TOUCH_TOL) entre `A` e `B`? */
export function overlapsCollinear(A: Poly, B: Poly): boolean {
  for (let i = 0; i < segCount(A); i++) {
    const p = A.pts[i]!;
    const q = A.pts[i + 1]!;
    const lp = len(sub(q, p));
    if (lp < 1e-9) continue;
    const du = mul(sub(q, p), 1 / lp);
    for (let j = 0; j < segCount(B); j++) {
      const r = B.pts[j]!;
      const s = B.pts[j + 1]!;
      const le = len(sub(s, r));
      if (le < 1e-9) continue;
      if (Math.abs(cross(du, mul(sub(s, r), 1 / le))) > 1e-9) continue;
      if (Math.abs(cross(du, sub(r, p))) > TOUCH_TOL || Math.abs(cross(du, sub(s, p))) > TOUCH_TOL) continue;
      const b0 = dot(sub(r, p), du);
      const b1 = dot(sub(s, p), du);
      const overlap = Math.min(lp, Math.max(b0, b1)) - Math.max(0, Math.min(b0, b1));
      if (overlap > TOUCH_TOL) return true;
    }
  }
  return false;
}

function ptSegDist(p: Vec2, a: Vec2, b: Vec2): number {
  return dist(p, closestOnSegment(p, a, b));
}

function segDist(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): number {
  if (segmentHit(p1, p2, q1, q2)) return 0;
  return Math.min(ptSegDist(p1, q1, q2), ptSegDist(p2, q1, q2), ptSegDist(q1, p1, p2), ptSegDist(q2, p1, p2));
}

function segsOf(pts: Vec2[]): Array<[Vec2, Vec2]> {
  if (pts.length === 1) return [[pts[0]!, pts[0]!]];
  const out: Array<[Vec2, Vec2]> = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push([pts[i]!, pts[i + 1]!]);
  return out;
}

/** Menor distância entre duas polilinhas (um ponto é uma polilinha de 1 vértice). */
export function polyDist(a: Vec2[], b: Vec2[]): number {
  let best = Infinity;
  const sb = segsOf(b);
  for (const [p1, p2] of segsOf(a)) {
    for (const [q1, q2] of sb) {
      const d = segDist(p1, p2, q1, q2);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Espelho preparado: amostra, cruzamentos com os limites e, se liga os dois limites, o trecho aparado. */
export interface RiserGeom {
  index: number;
  full: Poly;
  onBoundary: boolean;
  hitsL: Hit[];
  hitsR: Hit[];
  spans: boolean;
  /** Trecho aparado de `a` (no limite esquerdo) até `b` (no direito); null se não liga os dois. */
  trimmed: Vec2[] | null;
  /** Geometria usada para ordenar e para a caminhada: o trecho aparado, ou a amostra inteira. */
  geom: Poly;
}

export interface Prepared {
  L: Poly;
  R: Poly;
  risers: RiserGeom[];
}

function trimPoints(full: Poly, hl: Hit, hr: Hit): Vec2[] {
  const leftFirst = hl.s <= hr.s;
  const lo = leftFirst ? hl : hr;
  const hi = leftFirst ? hr : hl;
  const out: Vec2[] = [lo.p];
  full.pts.forEach((p, i) => {
    const s = full.cum[i]!;
    if (s > lo.s + SEG_TOL && s < hi.s - SEG_TOL) pushDistinct(out, p);
  });
  pushDistinct(out, hi.p);
  return leftFirst ? out : out.reverse();
}

export function prepareRun(run: StairRunSketch): Prepared {
  const L = makePoly(sampleChain(run.boundaryLeft));
  const R = makePoly(sampleChain(run.boundaryRight));
  const risers = run.risers.map((c, index): RiserGeom => {
    const full = makePoly(sampleCurve(c));
    const onBoundary = overlapsCollinear(full, L) || overlapsCollinear(full, R);
    const hitsL = onBoundary ? [] : crossings(full, L);
    const hitsR = onBoundary ? [] : crossings(full, R);
    const spans = !onBoundary && hitsL.length === 1 && hitsR.length === 1;
    const trimmed = spans ? trimPoints(full, hitsL[0]!, hitsR[0]!) : null;
    return { index, full, onBoundary, hitsL, hitsR, spans, trimmed, geom: trimmed ? makePoly(trimmed) : full };
  });
  return { L, R, risers };
}

/** Ponto médio por comprimento de arco da geometria do espelho. */
export function midOf(p: Poly): Vec2 {
  return pointAtLength(p, polyLength(p) / 2);
}

/** Eixo de subida: perpendicular ao vetor do ponto médio direito ao esquerdo (esquerdo fica à esquerda). */
export function boundaryAxis(run: StairRunSketch): Vec2 | null {
  const mL = chainMid(run.boundaryLeft);
  const mR = chainMid(run.boundaryRight);
  if (!mL || !mR) return null;
  const v = sub(mL, mR);
  if (len(v) < 1e-9) return null;
  const w = norm(v);
  return { x: w.y, y: -w.x };
}

function chainMid(cs: StairCurve[]): Vec2 | null {
  const first = cs[0];
  const last = cs[cs.length - 1];
  return first && last ? mid(first.a, last.b) : null;
}

/** Comprimento na caminhada (path) em que ela cruza o espelho; se não cruza, o do ponto mais próximo. */
function pathParam(path: Poly, geom: Poly): number {
  const hits = crossings(geom, path);
  if (hits.length > 0) return Math.min(...hits.map((h) => h.sb));
  const m = midOf(geom);
  let best = Infinity;
  let s = 0;
  for (let j = 0; j < segCount(path); j++) {
    const c = closestOnSegment(m, path.pts[j]!, path.pts[j + 1]!);
    const d = dist(m, c);
    if (d < best) {
      best = d;
      s = path.cum[j]! + dist(path.pts[j]!, c);
    }
  }
  return s;
}

/**
 * Índices (em `run.risers`) na ordem de subida. Com `byPath` e caminhada válida, pela posição do cruzamento na
 * caminhada; senão, pela projeção do ponto médio sobre o eixo dos limites.
 */
export function orderBy(P: Prepared, run: StairRunSketch, byPath: boolean): number[] {
  const path = byPath && run.path.length > 0 ? makePoly(sampleChain(run.path)) : null;
  const usePath = path !== null && path.pts.length >= 2;
  const axis = usePath ? null : (boundaryAxis(run) ?? { x: 1, y: 0 });
  const keyed = P.risers.map((g) => ({
    i: g.index,
    k: path && usePath ? pathParam(path, g.geom) : dot(midOf(g.geom), axis!),
  }));
  keyed.sort((x, y) => x.k - y.k || x.i - y.i);
  return keyed.map((o) => o.i);
}

/** Índices dos espelhos (em `run.risers`) na ordem de subida (pela caminhada, se houver). */
export function orderRisers(run: StairRunSketch): number[] {
  return orderBy(prepareRun(run), run, true);
}

/** Espelhos aparados, na ordem do vetor `run.risers` (um por espelho; sem interseção válida, a amostra inteira). */
export function trimRisers(run: StairRunSketch): Array<{ a: Vec2; b: Vec2; points: Vec2[] }> {
  return prepareRun(run).risers.map((g) => {
    const pts = g.geom.pts;
    return { a: pts[0]!, b: pts[pts.length - 1]!, points: pts };
  });
}

/** Caminhada automática: pontos médios dos espelhos aparados, na ordem de subida. */
export function autoPath(run: StairRunSketch): Vec2[] {
  const P = prepareRun(run);
  return orderBy(P, run, true).map((i) => midOf(P.risers[i]!.geom));
}

/** Trecho de `p` estritamente entre os comprimentos s0 e s1, na direção de s0 para s1. */
export function between(p: Poly, s0: number, s1: number): Vec2[] {
  const lo = Math.min(s0, s1) + SEG_TOL;
  const hi = Math.max(s0, s1) - SEG_TOL;
  const out: Vec2[] = [];
  p.pts.forEach((q, i) => {
    const s = p.cum[i]!;
    if (s > lo && s < hi) out.push(q);
  });
  return s0 <= s1 ? out : out.reverse();
}
