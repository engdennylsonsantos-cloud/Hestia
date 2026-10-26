import {
  add,
  arcFromSagitta,
  arcLocal,
  arcPointAt,
  closestOnSegment,
  dot,
  intersectCircleLine,
  intersectCircles,
  intersectLines,
  mul,
  perp,
  sagFromThreePoints,
  sub,
  type Arc,
  type SketchSeg,
  type Vec2,
} from '@hestia/geom';

/** Tolerância do esboço (1 mm), a mesma de conexão do validador. */
export const MOD_TOL = 1e-3;

/** Distância entre dois pontos (o nome `dist` fica livre para os parâmetros de deslocamento). */
export const gap = (p: Vec2, q: Vec2): number => Math.hypot(p.x - q.x, p.y - q.y);

/** Geometria de uma linha do rascunho: reta, ou arco pela flecha (mesma convenção de `sketchGeom`). */
export interface Curve {
  seg: SketchSeg;
  arc: Arc | null;
  /** Comprimento do traço (eixo do arco, ou a reta). */
  len: number;
  /** Direção unitária a→b (reta). */
  u: Vec2;
}

/** Geometria pura de uma linha: a, b e a flecha (ausente = reta). */
export interface Geom {
  a: Vec2;
  b: Vec2;
  sag?: number;
}

/** Interseção de duas curvas, com o parâmetro de cada uma (distância desde a ponta a). */
export interface Hit {
  p: Vec2;
  t1: number;
  t2: number;
}

export function curveOf(seg: SketchSeg): Curve {
  const arc = seg.sag ? arcFromSagitta(seg.a, seg.b, seg.sag) : null;
  const L = gap(seg.a, seg.b);
  return {
    seg,
    arc,
    len: arc ? arc.length : L,
    u: L > 0 ? mul(sub(seg.b, seg.a), 1 / L) : { x: 1, y: 0 },
  };
}

/** Ponto da curva à distância `t` desde a ponta a (fora de [0, len] é o prolongamento). Nas pontas devolve a ponta exata. */
export function pointAt(c: Curve, t: number): Vec2 {
  if (Math.abs(t) <= 1e-12) return c.seg.a;
  if (Math.abs(t - c.len) <= 1e-12) return c.seg.b;
  if (c.arc) return arcPointAt(c.arc, t);
  return add(c.seg.a, mul(c.u, t));
}

/** Parâmetro do ponto projetado na curva (sem limitar ao traço). */
export function paramOf(c: Curve, p: Vec2): number {
  if (c.arc) return arcLocal(c.arc, p).t;
  return dot(sub(p, c.seg.a), c.u);
}

/** Parâmetro limitado ao traço: o clique cai sempre sobre a linha. */
export function traceParam(c: Curve, p: Vec2): number {
  return Math.min(c.len, Math.max(0, paramOf(c, p)));
}

/** Distância de p ao traço da linha (não à reta ou à circunferência inteira). */
export function traceDist(c: Curve, p: Vec2): number {
  if (!c.arc) return gap(p, closestOnSegment(p, c.seg.a, c.seg.b));
  const loc = arcLocal(c.arc, p);
  if (loc.t >= 0 && loc.t <= c.len) return Math.abs(loc.s);
  return Math.min(gap(p, c.seg.a), gap(p, c.seg.b));
}

function rawHits(c1: Curve, c2: Curve): Vec2[] {
  if (c1.arc && c2.arc) return intersectCircles(c1.arc.center, c1.arc.radius, c2.arc.center, c2.arc.radius);
  if (c1.arc) return intersectCircleLine(c1.arc.center, c1.arc.radius, c2.seg.a, sub(c2.seg.b, c2.seg.a));
  if (c2.arc) return intersectCircleLine(c2.arc.center, c2.arc.radius, c1.seg.a, sub(c1.seg.b, c1.seg.a));
  const r = intersectLines(c1.seg.a, sub(c1.seg.b, c1.seg.a), c2.seg.a, sub(c2.seg.b, c2.seg.a));
  return r ? [r.point] : [];
}

/** Interseções das curvas inteiras (retas infinitas e circunferências), sem repetidas. Colineares: nenhuma. */
export function curveHits(c1: Curve, c2: Curve): Hit[] {
  const out: Hit[] = [];
  for (const p of rawHits(c1, c2)) {
    if (out.some((h) => gap(h.p, p) <= MOD_TOL)) continue;
    out.push({ p, t1: paramOf(c1, p), t2: paramOf(c2, p) });
  }
  return out;
}

/** Interseções que caem dentro dos dois traços (com tolerância nas pontas). */
export function traceHits(c1: Curve, c2: Curve): Hit[] {
  return curveHits(c1, c2).filter(
    (h) => h.t1 >= -MOD_TOL && h.t1 <= c1.len + MOD_TOL && h.t2 >= -MOD_TOL && h.t2 <= c2.len + MOD_TOL,
  );
}

/**
 * Pedaço da curva entre t0 e t1 (t0 < t1; fora de [0, len] estende). Arco: o trecho continua na mesma circunferência
 * e a flecha é recalculada. Null se o pedaço for menor que 1 mm ou se o arco passar de meia volta (não representável).
 */
export function pieceOf(c: Curve, t0: number, t1: number): Geom | null {
  if (t1 - t0 <= MOD_TOL) return null;
  const a = pointAt(c, t0);
  const b = pointAt(c, t1);
  if (!c.arc) return { a, b };
  const R = c.arc.radius;
  if (t1 - t0 > Math.PI * R + 1e-9) return null;
  const chord = gap(a, b);
  const h = R - Math.sqrt(Math.max(0, R * R - (chord * chord) / 4));
  return { a, b, sag: c.arc.k * h };
}

/** Acrescenta a geometria à linha, mantendo id e flags de telhado. Flecha ausente ou zero = reta. */
export function withGeom(seg: SketchSeg, g: Geom): SketchSeg {
  const { sag: _old, ...rest } = seg;
  const out: SketchSeg = { ...rest, a: g.a, b: g.b };
  if (g.sag) out.sag = g.sag;
  return out;
}

/** Linha sem id (formato de criação). */
export function stripId(seg: SketchSeg): Omit<SketchSeg, 'id'> {
  const { id: _id, ...rest } = seg;
  return rest;
}

/**
 * Flecha do arco que passa por a, m e b, com m sobre o arco menor (o que a flecha representa).
 * 0 quando estão alinhados (reta). Null se m não cai sobre o arco menor entre a e b.
 */
export function sagThrough(a: Vec2, m: Vec2, b: Vec2): number | null {
  const s = sagFromThreePoints(a, m, b);
  if (Math.abs(s) < 1e-6) return gap(a, b) > MOD_TOL ? 0 : null;
  const arc = arcFromSagitta(a, b, s);
  if (!arc) return null;
  const loc = arcLocal(arc, m);
  return Math.abs(loc.s) <= 1e-6 && loc.t >= -1e-6 && loc.t <= arc.length + 1e-6 ? s : null;
}

/**
 * Move uma ponta (`which`) para `p`. Reta: só as pontas. Arco: o novo arco passa pelo meio do arco original.
 * Null se a linha ficaria com menos de 1 mm ou o arco não se sustenta.
 */
export function moveEnd(seg: SketchSeg, which: 'a' | 'b', p: Vec2): SketchSeg | null {
  const c = curveOf(seg);
  const a = which === 'a' ? p : seg.a;
  const b = which === 'b' ? p : seg.b;
  if (gap(a, b) <= MOD_TOL) return null;
  if (!c.arc) return withGeom(seg, { a, b });
  const sag = sagThrough(a, pointAt(c, c.len / 2), b);
  return sag === null ? null : withGeom(seg, { a, b, sag });
}

/** Perpendicular à esquerda do sentido a→b, com o comprimento dado. */
export const leftOf = (c: Curve, d: number): Vec2 => mul(perp(c.u), d);
