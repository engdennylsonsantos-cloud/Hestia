import {
  add,
  arcFromSagitta,
  arcPointAt,
  arcSample,
  arcTangentAt,
  dist,
  equal,
  mid,
  mul,
  norm,
  perp,
  pointInMulti,
  sub,
  validateSketch,
  type SketchDraft,
  type SketchSeg,
  type Vec2,
} from '@hestia/geom';
import { segDistance } from './sketchPickFaceGeom.ts';
import type { PreviewItem } from './types.ts';

/**
 * Geometria de clique do esboço, em metros (a ferramenta não vê a vista). Os valores em pixels viram metros pelo
 * `metersPerPixel` do ambiente.
 */

/** Meia-base e recuo do triângulo de inclinação, em px de tela. Iguais a render/plan/sketchSlope.ts (o tools não importa render). */
export const SLOPE_HALF_PX = 9;
export const SLOPE_GAP_PX = 38;
/** Tolerância de clique numa linha do esboço, em px de tela (como `sketchHitSeg`). */
export const SELECT_PX = 6;

/** Erro máximo da poligonal de um arco, em metros: arco liso na prévia e na captura. */
const CHORD_M = 0.005;
/** Afastamento do teste de lado da normal, em metros (como `outwardNormal` do render). */
const SIDE_M = 0.01;

/** Pontos da linha de `a` até `b`: a reta, ou o arco amostrado. */
export function chords(seg: SketchSeg, tol = CHORD_M): Vec2[] {
  const arc = seg.sag ? arcFromSagitta(seg.a, seg.b, seg.sag) : null;
  return arc ? arcSample(arc, 0, arc.length, 0, tol) : [seg.a, seg.b];
}

/** Uma linha de prévia por corda da linha (arcos saem em poligonal). */
export function segLines(seg: SketchSeg, style: { dashed?: boolean; halo?: boolean } = {}): PreviewItem[] {
  const pts = chords(seg);
  const out: PreviewItem[] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push({ kind: 'line', a: pts[i]!, b: pts[i + 1]!, ...style });
  return out;
}

/** Cordas de todas as linhas do rascunho, para a captura perpendicular e de alinhamento. */
export function draftEdges(segs: SketchSeg[]): Array<{ a: Vec2; b: Vec2 }> {
  return segs.flatMap((s) => {
    const pts = chords(s);
    return pts.slice(0, -1).map((a, i) => ({ a, b: pts[i + 1]! }));
  });
}

/** Pontas das linhas: vértices para a captura de extremidade. */
export const draftPoints = (segs: SketchSeg[]): Vec2[] => segs.flatMap((s) => [s.a, s.b]);

/** Linha mais próxima de `p` dentro de `tolM` metros, ou null. */
export function hitSeg(segs: SketchSeg[], p: Vec2, tolM: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const s of segs) {
    const d = segDistance(s, p);
    if (d <= tolM && (!best || d < best.d)) best = { id: s.id, d };
  }
  return best?.id ?? null;
}

/** A linha já existe no rascunho (mesmas pontas, nos dois sentidos, e mesma flecha). */
export function hasSeg(segs: SketchSeg[], seg: SketchSeg): boolean {
  const sg = (x: number | undefined): number => x ?? 0;
  return segs.some(
    (s) =>
      (equal(s.a, seg.a) && equal(s.b, seg.b) && sg(s.sag) === sg(seg.sag)) ||
      (equal(s.a, seg.b) && equal(s.b, seg.a) && sg(s.sag) === -sg(seg.sag)),
  );
}

/** Vértices do retângulo de dois cantos opostos (prévia da caixa). */
export const boxRing = (a: Vec2, b: Vec2): Vec2[] => [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];

/** Ponto de referência de uma linha (meio da corda, ou o meio sobre o arco) e a tangente unitária de `a` para `b`. */
function edgeFrame(seg: SketchSeg): { at: Vec2; t: Vec2 } {
  const arc = seg.sag ? arcFromSagitta(seg.a, seg.b, seg.sag) : null;
  if (!arc) return { at: mid(seg.a, seg.b), t: norm(sub(seg.b, seg.a)) };
  return { at: arcPointAt(arc, arc.length / 2), t: arcTangentAt(arc, arc.length / 2) };
}

/** Normal unitária da aresta voltada para fora do laço. */
function outwardNormal(at: Vec2, t: Vec2, ring: Vec2[]): Vec2 {
  const n = perp(t);
  const probe = add(at, mul(n, SIDE_M));
  return pointInMulti(probe, [[ring]]) ? mul(n, -1) : n;
}

/**
 * Aresta do laço externo cujo triângulo de inclinação está sob `p`, ou null. O centro do triângulo fica `SLOPE_GAP_PX`
 * para fora da aresta (em metros: `GAP × metersPerPixel`); o raio é o do círculo que contém o triângulo.
 */
export function triangleHit(draft: SketchDraft, p: Vec2, mpp: number): string | null {
  const outer = validateSketch(draft.segs).loops.find((l) => l.role === 'outer');
  if (!outer) return null;
  const byId = new Map(draft.segs.map((s) => [s.id, s] as const));
  let best: { id: string; d: number } | null = null;
  for (const ls of outer.segs) {
    const seg = byId.get(ls.id) ?? ls;
    if (dist(seg.a, seg.b) < 1e-9) continue;
    const { at, t } = edgeFrame(seg);
    const c = add(at, mul(outwardNormal(at, t, outer.ring), SLOPE_GAP_PX * mpp));
    const d = dist(p, c);
    if (d <= SLOPE_HALF_PX * Math.SQRT2 * mpp && (!best || d < best.d)) best = { id: seg.id, d };
  }
  return best?.id ?? null;
}
