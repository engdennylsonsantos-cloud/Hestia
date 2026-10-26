import { arcFromSagitta, arcLocal, arcPointAt, intersectCircleLine, intersectCircles, type Arc } from './arc.ts';
import { closestOnSegment, intersectSegments } from './line.ts';
import type { SketchSeg } from './sketchTypes.ts';
import { add, cross, dist, dot, mul, norm, sub, type Vec2 } from './vec.ts';

/** Tolerância de conexão e de contato do esboço: 1 mm (o pacote geom trabalha em metros). */
export const SKETCH_TOL = 1e-3;

/** Linha do esboço com geometria pronta: reta (`arc` nulo) ou arco. `len` é o comprimento do eixo. */
export interface SegGeo {
  seg: SketchSeg;
  arc: Arc | null;
  len: number;
}

/** Contato entre duas linhas. `t1`/`t2` dizem onde cai em cada uma (distância desde a ponta a). */
export interface Contact {
  p: Vec2;
  t1: number;
  t2: number;
  /** Colineares sobrepostas: `p` é o meio do trecho comum. */
  overlap: boolean;
}

export function segGeo(seg: SketchSeg): SegGeo {
  const arc = seg.sag ? arcFromSagitta(seg.a, seg.b, seg.sag) : null;
  return { seg, arc, len: arc ? arc.length : dist(seg.a, seg.b) };
}

/** Distância de p ao traço da linha (não à reta ou circunferência inteira). */
export function distToSeg(p: Vec2, g: SegGeo): number {
  if (!g.arc) return dist(p, closestOnSegment(p, g.seg.a, g.seg.b));
  const loc = arcLocal(g.arc, p);
  if (loc.t >= 0 && loc.t <= g.len) return Math.abs(loc.s);
  return Math.min(dist(p, g.seg.a), dist(p, g.seg.b));
}

/** Contato longe das pontas: cruzamento de verdade, e não encontro em vértice. */
export function isInterior(t: number, g: SegGeo): boolean {
  return t > SKETCH_TOL && t < g.len - SKETCH_TOL;
}

const swap = (c: Contact): Contact => ({ ...c, t1: c.t2, t2: c.t1 });
const clampT = (t: number, len: number): number => Math.min(len, Math.max(0, t));

/** Contatos entre duas linhas quaisquer (reta ou arco), com tolerância de 1 mm. */
export function contactsOf(g1: SegGeo, g2: SegGeo): Contact[] {
  if (g1.arc && g2.arc) return arcArc(g1, g1.arc, g2, g2.arc);
  if (g2.arc) return lineArc(g1, g2, g2.arc);
  if (g1.arc) return lineArc(g2, g1, g1.arc).map(swap);
  return lineLine(g1, g2);
}

function lineLine(g1: SegGeo, g2: SegGeo): Contact[] {
  const a1 = g1.seg.a;
  const b1 = g1.seg.b;
  const a2 = g2.seg.a;
  const b2 = g2.seg.b;
  const u = norm(sub(b1, a1));
  const v = norm(sub(b2, a2));
  if (Math.abs(cross(u, v)) > 1e-9) {
    const p = intersectSegments(a1, b1, a2, b2);
    return p ? [{ p, t1: dist(a1, p), t2: dist(a2, p), overlap: false }] : [];
  }
  const off = (q: Vec2): number => Math.abs(cross(u, sub(q, a1)));
  if (off(a2) > SKETCH_TOL || off(b2) > SKETCH_TOL) return [];
  const s = (q: Vec2): number => dot(sub(q, a1), u);
  const lo = Math.max(0, Math.min(s(a2), s(b2)));
  const hi = Math.min(g1.len, Math.max(s(a2), s(b2)));
  if (hi - lo <= SKETCH_TOL) return [];
  const p = add(a1, mul(u, (lo + hi) / 2));
  return [{ p, t1: (lo + hi) / 2, t2: dist(a2, p), overlap: true }];
}

function lineArc(l: SegGeo, c: SegGeo, arc: Arc): Contact[] {
  const out: Contact[] = [];
  const d = sub(l.seg.b, l.seg.a);
  for (const p of intersectCircleLine(arc.center, arc.radius, l.seg.a, d)) {
    if (dist(p, closestOnSegment(p, l.seg.a, l.seg.b)) > SKETCH_TOL) continue;
    const loc = arcLocal(arc, p);
    if (loc.t < -SKETCH_TOL || loc.t > c.len + SKETCH_TOL) continue;
    out.push({ p, t1: dist(l.seg.a, p), t2: clampT(loc.t, c.len), overlap: false });
  }
  return out;
}

function arcArc(g1: SegGeo, A: Arc, g2: SegGeo, B: Arc): Contact[] {
  if (dist(A.center, B.center) < SKETCH_TOL && Math.abs(A.radius - B.radius) < SKETCH_TOL) {
    // Mesma circunferência: sobrepõem-se se uma ponta ou o meio de um cai no interior do outro.
    // Dois arcos que fecham o círculo só se encontram nas pontas, e isso não é sobreposição.
    const inner = (q: Vec2, arc: Arc, len: number): boolean => {
      const t = arcLocal(arc, q).t;
      return t > SKETCH_TOL && t < len - SKETCH_TOL;
    };
    const pa = [arcPointAt(A, g1.len / 2), g1.seg.a, g1.seg.b];
    const pb = [arcPointAt(B, g2.len / 2), g2.seg.a, g2.seg.b];
    const p = pa.find((q) => inner(q, B, g2.len)) ?? pb.find((q) => inner(q, A, g1.len));
    return p ? [{ p, t1: 0, t2: 0, overlap: true }] : [];
  }
  const out: Contact[] = [];
  for (const p of intersectCircles(A.center, A.radius, B.center, B.radius)) {
    const la = arcLocal(A, p);
    const lb = arcLocal(B, p);
    if (la.t < -SKETCH_TOL || la.t > g1.len + SKETCH_TOL) continue;
    if (lb.t < -SKETCH_TOL || lb.t > g2.len + SKETCH_TOL) continue;
    out.push({ p, t1: clampT(la.t, g1.len), t2: clampT(lb.t, g2.len), overlap: false });
  }
  return out;
}
