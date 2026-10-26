import {
  add,
  cross,
  intersectCircleLine,
  intersectCircles,
  intersectLines,
  mul,
  offsetArc,
  perp,
  signedDistToLine,
  sub,
  type SketchDraft,
  type SketchSeg,
  type Vec2,
} from '@hestia/geom';
import { addSegs, type NewSeg } from './perimeterSession.ts';
import {
  MOD_TOL,
  curveOf,
  gap,
  traceDist,
  withGeom,
  stripId,
  type Curve,
  type Geom,
} from './perimeterModifyCurve.ts';

/** Lado do deslocamento para uma linha: para a reta, sinal do lado; para o arco, para fora (+1) ou para dentro (−1). */
function sideSign(seg: SketchSeg, c: Curve, sidePt: Vec2): number | null {
  if (!c.arc) {
    const s = signedDistToLine(sidePt, seg.a, seg.b);
    return Math.abs(s) <= MOD_TOL ? null : Math.sign(s);
  }
  const rp = gap(sidePt, c.arc.center);
  return Math.abs(rp - c.arc.radius) <= MOD_TOL ? null : Math.sign(rp - c.arc.radius);
}

/** Sinal do deslocamento pela esquerda do percurso (a linha já orientada): arco usa para fora·k. */
function leftSign(seg: SketchSeg, c: Curve, sidePt: Vec2): number | null {
  const s = sideSign(seg, c, sidePt);
  if (s === null) return null;
  return c.arc ? s * c.arc.k : s;
}

/**
 * Cópia deslocada de uma linha, para o lado de `sidePt`. Reta: paralela. Arco: concêntrico (raio ± dist).
 * Null se o ponto de lado cai sobre a linha ou se o raio zera.
 */
function offsetGeom(seg: SketchSeg, dist: number, sidePt: Vec2): Geom | null {
  const c = curveOf(seg);
  const sgn = sideSign(seg, c, sidePt);
  if (sgn === null) return null;
  if (!c.arc) {
    const shift = mul(perp(c.u), sgn * dist);
    return { a: add(seg.a, shift), b: add(seg.b, shift) };
  }
  // offsetArc desloca à esquerda do sentido a→b; o raio cresce com k (sinal da flecha), então para fora é sgn·k.
  const o = offsetArc(seg.a, seg.b, seg.sag ?? 0, sgn * c.arc.k * dist);
  return o ? { a: o.a, b: o.b, sag: o.sag } : null;
}

/**
 * Deslocar (Revit: Offset, cópia): cada linha selecionada gera uma cópia paralela (ou concêntrica, no arco) para o lado
 * de `sidePt`. As originais ficam. Cópias não se encontram nas pontas: use `offsetLoop` para cadeias conectadas.
 * Null se alguma linha não pode ser deslocada.
 */
export function offsetSegs(d: SketchDraft, ids: string[], dist: number, sidePt: Vec2): SketchDraft | null {
  if (!(dist > MOD_TOL)) return null;
  const want = new Set(ids);
  const sel = d.segs.filter((s) => want.has(s.id));
  if (sel.length === 0) return null;
  const copies: NewSeg[] = [];
  for (const s of sel) {
    const g = offsetGeom(s, dist, sidePt);
    if (!g) return null;
    copies.push(stripId(withGeom(s, g)));
  }
  return addSegs(d, copies);
}

/** Linha orientada no sentido do percurso da cadeia. `rev` = o percurso vai de b para a. */
interface Oriented {
  src: SketchSeg;
  rev: boolean;
  g: Geom;
}

/** Cadeia de linhas conectadas, na ordem do percurso; `closed` = laço fechado. */
interface Chain {
  items: Oriented[];
  closed: boolean;
}

function orient(src: SketchSeg, rev: boolean): Geom {
  if (!rev) return { a: src.a, b: src.b, sag: src.sag };
  return { a: src.b, b: src.a, sag: src.sag ? -src.sag : undefined };
}

/** Percorre as linhas selecionadas como uma polilinha aberta ou um laço. Null se há ramificação ou mais de uma cadeia. */
function chainOf(sel: SketchSeg[]): Chain | null {
  const touches = (p: Vec2, s: SketchSeg): boolean => gap(p, s.a) <= MOD_TOL || gap(p, s.b) <= MOD_TOL;
  const free = (p: Vec2, self: SketchSeg): boolean => !sel.some((s) => s !== self && touches(p, s));
  let start: { s: SketchSeg; rev: boolean } | undefined;
  const open = sel.find((s) => free(s.a, s));
  if (open) start = { s: open, rev: false };
  else {
    const back = sel.find((s) => free(s.b, s));
    if (back) start = { s: back, rev: true };
  }
  const closed = start === undefined;
  const first = start ?? { s: sel[0]!, rev: false };
  const items: Oriented[] = [];
  const used = new Set<string>();
  let cur = first;
  for (;;) {
    items.push({ src: cur.s, rev: cur.rev, g: orient(cur.s, cur.rev) });
    used.add(cur.s.id);
    const endP = cur.rev ? cur.s.a : cur.s.b;
    const next = sel.filter((s) => !used.has(s.id) && touches(endP, s));
    if (next.length === 0) break;
    if (next.length > 1) return null;
    const n = next[0]!;
    cur = { s: n, rev: gap(n.a, endP) > MOD_TOL };
  }
  if (items.length !== sel.length) return null;
  if (closed) {
    const last = items[items.length - 1]!.g;
    if (gap(last.b, items[0]!.g.a) > MOD_TOL) return null;
  }
  return { items, closed };
}

/** Elemento do deslocamento: curva orientada, lado D (esquerda do percurso) e a curva deslocada. */
interface Elem {
  src: SketchSeg;
  rev: boolean;
  g: Geom;
  c: Curve;
  D: number;
  /** Reta deslocada: ponto e direção. */
  lp: Vec2;
  ld: Vec2;
  /** Arco deslocado: centro e raio novo (R + k·D). */
  cc: Vec2;
  r2: number;
}

function elemOf(it: Oriented, D: number): Elem | null {
  const seg: SketchSeg = withGeom(it.src, it.g);
  const c = curveOf(seg);
  if (!c.arc) {
    return { src: it.src, rev: it.rev, g: it.g, c, D, lp: add(seg.a, mul(perp(c.u), D)), ld: sub(seg.b, seg.a), cc: seg.a, r2: 0 };
  }
  const r2 = c.arc.radius + c.arc.k * D;
  if (r2 <= MOD_TOL) return null;
  return { src: it.src, rev: it.rev, g: it.g, c, D, lp: seg.a, ld: seg.b, cc: c.arc.center, r2 };
}

/** Posição de um ponto da curva original depois do deslocamento (vale para as pontas). */
function offsetPt(e: Elem, p: Vec2): Vec2 {
  if (!e.c.arc) return add(p, mul(perp(e.c.u), e.D));
  return add(e.cc, mul(sub(p, e.cc), e.r2 / e.c.arc.radius));
}

/** Interseções das duas curvas deslocadas (retas e circunferências inteiras). */
function offsetHits(e1: Elem, e2: Elem): Vec2[] {
  const arc1 = e1.c.arc;
  const arc2 = e2.c.arc;
  if (!arc1 && !arc2) {
    const r = intersectLines(e1.lp, e1.ld, e2.lp, e2.ld);
    return r ? [r.point] : [];
  }
  if (arc1 && arc2) return intersectCircles(e1.cc, e1.r2, e2.cc, e2.r2);
  if (arc1) return intersectCircleLine(e1.cc, e1.r2, e2.lp, e2.ld);
  return intersectCircleLine(e2.cc, e2.r2, e1.lp, e1.ld);
}

/**
 * Canto entre duas linhas deslocadas: interseção mais próxima do vértice original `J`. Retas paralelas e coincidentes
 * (linha contínua) dão o próprio vértice deslocado. Null se não se encontram.
 */
function cornerOf(e1: Elem, e2: Elem, J: Vec2): Vec2 | null {
  const hits = offsetHits(e1, e2);
  if (hits.length) return hits.reduce((best, p) => (gap(p, J) < gap(best, J) ? p : best));
  if (!e1.c.arc && !e2.c.arc) {
    const off = Math.abs(cross(e1.ld, sub(e2.lp, e1.lp))) / Math.hypot(e1.ld.x, e1.ld.y);
    if (off <= MOD_TOL) return offsetPt(e1, J);
  }
  return null;
}

/** Linha final entre dois pontos deslocados, na orientação original da linha (arco com flecha do mesmo lado). */
function rebuild(e: Elem, p0: Vec2, p1: Vec2): Geom | null {
  if (gap(p0, p1) <= MOD_TOL) return null;
  if (!e.c.arc) return e.rev ? { a: p1, b: p0 } : { a: p0, b: p1 };
  const chord = gap(p0, p1);
  const h = e.r2 - Math.sqrt(Math.max(0, e.r2 * e.r2 - (chord * chord) / 4));
  const sagOr = e.c.arc.k * h;
  return e.rev ? { a: p1, b: p0, sag: -sagOr } : { a: p0, b: p1, sag: sagOr };
}

/**
 * Deslocar uma cadeia ou laço (Revit: Offset com linhas encadeadas). Os cantos são recalculados como interseção das
 * linhas deslocadas, então o resultado continua conectado. O lado vem da linha mais próxima de `sidePt`.
 * Cópias: as originais ficam. Null se a seleção não forma uma cadeia, se há ramificação ou se algum canto não existe.
 */
export function offsetLoop(d: SketchDraft, ids: string[], dist: number, sidePt: Vec2): SketchDraft | null {
  if (!(dist > MOD_TOL)) return null;
  const want = new Set(ids);
  const sel = d.segs.filter((s) => want.has(s.id));
  if (sel.length === 0) return null;
  const chain = chainOf(sel);
  if (!chain) return null;

  let near: Oriented | undefined;
  let best = Infinity;
  for (const it of chain.items) {
    const t = traceDist(curveOf(withGeom(it.src, it.g)), sidePt);
    if (t < best) {
      best = t;
      near = it;
    }
  }
  const nearSeg = withGeom(near!.src, near!.g);
  const sgn = leftSign(nearSeg, curveOf(nearSeg), sidePt);
  if (sgn === null) return null;
  const elems: Elem[] = [];
  for (const it of chain.items) {
    const e = elemOf(it, sgn * dist);
    if (!e) return null;
    elems.push(e);
  }

  const n = elems.length;
  const joints = chain.closed ? n : n - 1;
  const corners: Vec2[] = [];
  for (let j = 0; j < joints; j++) {
    const e1 = elems[j]!;
    const e2 = elems[(j + 1) % n]!;
    const J = e1.g.b;
    const p = cornerOf(e1, e2, J);
    if (!p) return null;
    corners.push(p);
  }

  const out: NewSeg[] = [];
  for (let i = 0; i < n; i++) {
    const e = elems[i]!;
    const p0 = chain.closed || i > 0 ? corners[(i - 1 + n) % n]! : offsetPt(e, e.g.a);
    const p1 = chain.closed || i < n - 1 ? corners[i]! : offsetPt(e, e.g.b);
    const g = rebuild(e, p0, p1);
    if (!g) return null;
    out.push(stripId(withGeom(e.src, g)));
  }
  return addSegs(d, out);
}
