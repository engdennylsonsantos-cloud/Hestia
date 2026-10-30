import {
  CHAR_W,
  LINE_H,
  MIN_FONT_RATIO,
  type DimensionPrim,
  type Drawing,
  type DrawingIssue,
  type LabelPrim,
  type Prim,
  type Pt,
  type Rect,
  type TextAnchor,
} from './drawing.ts';

export function textLines(text: string): string[] {
  return text.split('\n');
}

function signOr(v: number): 1 | -1 {
  return v >= 0 ? 1 : -1;
}

function textBoxFor(text: string, at: Pt, anchor: TextAnchor, em: number): Rect {
  const lines = textLines(text);
  let maxChars = 0;
  for (const line of lines) maxChars = Math.max(maxChars, line.length);
  const w = CHAR_W * em * maxChars;
  const h = LINE_H * em * lines.length;
  const x0 = anchor === 'start' ? at[0] : anchor === 'end' ? at[0] - w : at[0] - w / 2;
  return { x0, y0: at[1] - h / 2, x1: x0 + w, y1: at[1] + h / 2 };
}

export function labelBox(l: LabelPrim, em: number): Rect {
  return textBoxFor(l.text, l.at, l.anchor, em);
}

export interface DimGeometry {
  dimLine: [Pt, Pt];
  ext1: [Pt, Pt];
  ext2: [Pt, Pt];
  textAt: Pt;
  textAnchor: TextAnchor;
}

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];

export function dimGeometry(d: DimensionPrim, em: number): DimGeometry {
  const lines = textLines(d.text).length;
  if (d.axis === 'x') {
    const x1 = d.p1[0];
    const x2 = d.p2[0];
    const y1 = d.p1[1];
    const y2 = d.p2[1];
    const s1 = signOr(d.line - y1);
    const s2 = signOr(d.line - y2);
    const sg = signOr(d.line - (y1 + y2) / 2);
    return {
      dimLine: [[x1, d.line], [x2, d.line]],
      ext1: [[x1, y1 + s1 * 0.25 * em], [x1, d.line + s1 * 0.4 * em]],
      ext2: [[x2, y2 + s2 * 0.25 * em], [x2, d.line + s2 * 0.4 * em]],
      textAt: [(x1 + x2) / 2, d.line + sg * (0.8 * em + (lines - 1) * 0.575 * em)],
      textAnchor: 'middle',
    };
  }
  if (d.axis === 'y') {
    const x1 = d.p1[0];
    const x2 = d.p2[0];
    const y1 = d.p1[1];
    const y2 = d.p2[1];
    const s1 = signOr(d.line - x1);
    const s2 = signOr(d.line - x2);
    const sg = signOr(d.line - (x1 + x2) / 2);
    return {
      dimLine: [[d.line, y1], [d.line, y2]],
      ext1: [[x1 + s1 * 0.25 * em, y1], [d.line + s1 * 0.4 * em, y1]],
      ext2: [[x2 + s2 * 0.25 * em, y2], [d.line + s2 * 0.4 * em, y2]],
      textAt: [d.line + sg * 0.6 * em, (y1 + y2) / 2],
      textAnchor: sg > 0 ? 'start' : 'end',
    };
  }
  const dx = d.p2[0] - d.p1[0];
  const dy = d.p2[1] - d.p1[1];
  const len = Math.hypot(dx, dy) || 1;
  const u: Pt = [dx / len, dy / len];
  const n: Pt = [-u[1], u[0]];
  const sg = signOr(d.line);
  const offset = mul(n, d.line);
  const line1 = add(d.p1, offset);
  const line2 = add(d.p2, offset);
  const out1 = mul(n, sg * 0.4 * em);
  const anchor: TextAnchor = sg * n[0] > 0.3 ? 'start' : sg * n[0] < -0.3 ? 'end' : 'middle';
  const gap = (anchor === 'middle' ? 0.8 : 0.6) * em + (lines - 1) * 0.575 * em;
  const mid: Pt = [(line1[0] + line2[0]) / 2, (line1[1] + line2[1]) / 2];
  return {
    dimLine: [line1, line2],
    ext1: [add(d.p1, mul(n, sg * 0.25 * em)), add(line1, out1)],
    ext2: [add(d.p2, mul(n, sg * 0.25 * em)), add(line2, out1)],
    textAt: add(mid, mul(n, sg * gap)),
    textAnchor: anchor,
  };
}

export function dimTextBox(d: DimensionPrim, em: number): Rect {
  const g = dimGeometry(d, em);
  return textBoxFor(d.text, g.textAt, g.textAnchor, em);
}

function primPoints(p: Prim): Pt[] {
  switch (p.kind) {
    case 'polygon':
    case 'polyline':
    case 'hatch':
      return p.pts;
    case 'line':
      return [p.a, p.b];
    case 'dimension':
      return [p.p1, p.p2];
    case 'label':
      return p.leader ? [p.at, p.leader] : [p.at];
  }
}

export function bboxOf(prims: Prim[], filter?: (p: Prim) => boolean): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of prims) {
    if (filter && !filter(p)) continue;
    for (const q of primPoints(p)) {
      if (q[0] < x0) x0 = q[0];
      if (q[1] < y0) y0 = q[1];
      if (q[0] > x1) x1 = q[0];
      if (q[1] > y1) y1 = q[1];
    }
  }
  if (!(x0 <= x1 && y0 <= y1)) throw new RangeError('bboxOf: nenhum ponto');
  return { x0, y0, x1, y1 };
}

export function expandRect(r: Rect, by: number): Rect {
  return { x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by };
}

export function rectsOverlap(a: Rect, b: Rect, eps = 0): boolean {
  return a.x0 + eps < b.x1 - eps && b.x0 + eps < a.x1 - eps && a.y0 + eps < b.y1 - eps && b.y0 + eps < a.y1 - eps;
}

function segPointDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-18) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function pointInPolygonStrict(p: Pt, poly: readonly Pt[], eps: number): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (segPointDist(p, a, b) <= eps) return false;
    const intersects = a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

export function segmentIntersectsRect(a: Pt, b: Pt, r: Rect): boolean {
  const inRect = (p: Pt): boolean => p[0] >= r.x0 && p[0] <= r.x1 && p[1] >= r.y0 && p[1] <= r.y1;
  if (inRect(a) || inRect(b)) return true;
  const segs: Array<[Pt, Pt]> = [
    [[r.x0, r.y0], [r.x1, r.y0]],
    [[r.x1, r.y0], [r.x1, r.y1]],
    [[r.x1, r.y1], [r.x0, r.y1]],
    [[r.x0, r.y1], [r.x0, r.y0]],
  ];
  return segs.some(([c, d]) => segmentsIntersect(a, b, c, d));
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: Pt, b: Pt, c: Pt): boolean {
  return (
    Math.min(a[0], b[0]) - 1e-12 <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    Math.min(a[1], b[1]) - 1e-12 <= c[1] &&
    c[1] <= Math.max(a[1], b[1]) + 1e-12
  );
}

function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
}

export function rectIntersectsPolygonInterior(r: Rect, poly: readonly Pt[], eps: number): boolean {
  if (poly.length < 3) return false;
  const corners: Pt[] = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
  for (const c of corners) if (pointInPolygonStrict(c, poly, eps)) return true;
  const shrunk: Rect = { x0: r.x0 + eps, y0: r.y0 + eps, x1: r.x1 - eps, y1: r.y1 - eps };
  if (shrunk.x0 >= shrunk.x1 || shrunk.y0 >= shrunk.y1) return false;
  const inShrunk = (p: Pt): boolean => p[0] > shrunk.x0 && p[0] < shrunk.x1 && p[1] > shrunk.y0 && p[1] < shrunk.y1;
  for (const v of poly) if (inShrunk(v)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segmentIntersectsRect(poly[j]!, poly[i]!, shrunk)) return true;
  }
  return false;
}

export function sampleSegment(a: Pt, b: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

interface TextEntry { id: string; box: Rect }

function textEntries(d: Drawing): TextEntry[] {
  const out: TextEntry[] = [];
  for (const p of d.prims) {
    if (p.kind === 'label') out.push({ id: p.id, box: labelBox(p, d.em) });
    else if (p.kind === 'dimension') out.push({ id: p.id, box: dimTextBox(p, d.em) });
  }
  return out;
}

const insideRect = (p: Pt, r: Rect, tol: number): boolean =>
  p[0] >= r.x0 - tol && p[0] <= r.x1 + tol && p[1] >= r.y0 - tol && p[1] <= r.y1 + tol;

const insideRectStrict = (p: Pt, r: Rect, tol: number): boolean =>
  p[0] > r.x0 + tol && p[0] < r.x1 - tol && p[1] > r.y0 + tol && p[1] < r.y1 - tol;

export function checkDrawing(d: Drawing): DrawingIssue[] {
  const issues: DrawingIssue[] = [];
  const em = d.em;
  const texts = textEntries(d);
  const polys = d.prims.filter((p) => p.kind === 'polygon' && p.role === 'body');
  const guides = d.prims.filter((p) => (p.kind === 'line' || p.kind === 'polyline') && p.role === 'aux');
  const dims = d.prims.filter((p): p is DimensionPrim => p.kind === 'dimension');

  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (rectsOverlap(texts[i]!.box, texts[j]!.box, 0.1 * em)) issues.push({ code: 'text-overlap', ids: [texts[i]!.id, texts[j]!.id] });
    }
  }

  for (const t of texts) {
    for (const p of polys) {
      if (p.kind !== 'polygon') continue;
      if (rectIntersectsPolygonInterior(t.box, p.pts, 1e-6)) issues.push({ code: 'text-on-body', ids: [t.id, p.id] });
    }
  }

  for (const t of texts) {
    for (const g of guides) {
      if (g.kind !== 'line' && g.kind !== 'polyline') continue;
      const segs: Array<[Pt, Pt]> = g.kind === 'line' ? [[g.a, g.b]] : segmentPairs(g.pts);
      if (segs.some(([a, b]) => segmentIntersectsRect(a, b, t.box))) issues.push({ code: 'text-on-guide', ids: [t.id, g.id] });
    }
  }

  for (const dim of dims) {
    const g = dimGeometry(dim, em);
    const hits = new Set<string>();
    const testPoint = (p: Pt): void => {
      for (const poly of polys) {
        if (poly.kind !== 'polygon') continue;
        if (pointInPolygonStrict(p, poly.pts, 1e-6)) hits.add(poly.id);
      }
    };
    for (const p of sampleSegment(g.dimLine[0], g.dimLine[1], 24)) testPoint(p);
    for (const ext of [g.ext1, g.ext2]) {
      const start = ext[0];
      for (const p of sampleSegment(ext[0], ext[1], 24)) {
        if (Math.hypot(p[0] - start[0], p[1] - start[1]) > 0.3 * em) testPoint(p);
      }
    }
    for (const id of hits) issues.push({ code: 'dim-on-body', ids: [dim.id, id] });
  }

  const frameTol = 1e-6;
  for (const t of texts) if (!insideRect([t.box.x0, t.box.y0], d.frame, frameTol) || !insideRect([t.box.x1, t.box.y1], d.frame, frameTol)) {
    issues.push({ code: 'out-of-frame', ids: [t.id] });
  }
  for (const dim of dims) {
    const g = dimGeometry(dim, em);
    if (!insideRect(g.dimLine[0], d.frame, frameTol) || !insideRect(g.dimLine[1], d.frame, frameTol)) {
      issues.push({ code: 'out-of-frame', ids: [dim.id] });
    }
  }
  for (const p of d.prims) {
    if (p.kind === 'label' || p.kind === 'dimension') continue;
    for (const q of primPoints(p)) {
      if (!insideRect(q, d.frame, frameTol)) {
        issues.push({ code: 'out-of-frame', ids: [p.id] });
        break;
      }
    }
  }

  if (em / (d.frame.x1 - d.frame.x0) < MIN_FONT_RATIO) issues.push({ code: 'font-too-small', ids: [] });

  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const p of d.prims) {
    if (seen.has(p.id)) dup.add(p.id);
    seen.add(p.id);
  }
  if (dup.size > 0) issues.push({ code: 'dup-id', ids: [...dup] });

  const obstacles = d.prims.filter((p) => (p.kind === 'polygon' && p.role === 'body') || p.kind === 'hatch');
  if (obstacles.length > 0) {
    const box = bboxOf(obstacles);
    for (const dim of dims) {
      if (dim.axis === 'aligned' || dim.broken) continue;
      const g = dimGeometry(dim, em);
      if (insideRectStrict(g.dimLine[0], box, 1e-6) && insideRectStrict(g.dimLine[1], box, 1e-6)) {
        issues.push({ code: 'dim-inside-bbox', ids: [dim.id] });
      }
    }
  }

  return issues;
}

function segmentPairs(pts: Pt[]): Array<[Pt, Pt]> {
  const out: Array<[Pt, Pt]> = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push([pts[i]!, pts[i + 1]!]);
  return out;
}
