import { add, arcFromSagitta, arcPointAt, arcSample, arcTangentAt, mid, norm, perp, pointInMulti, sub, type Arc, type Ring, type SketchLoop, type SketchSeg, type Vec2 } from '@hestia/geom';

/**
 * Geometria das linhas do esboço (sem desenho). O arco é o da flecha (`arcFromSagitta`); a reta é `a`→`b`.
 */

/** Afastamento (m) do teste de lado da normal: acima do erro da poligonal do anel, abaixo de qualquer cota da planta. */
const SIDE_M = 0.01;

/** Arco da aresta; `null` quando a aresta é reta (flecha ausente ou zero). */
export function arcOf(seg: SketchSeg): Arc | null {
  return seg.sag ? arcFromSagitta(seg.a, seg.b, seg.sag) : null;
}

/** Pontos da aresta de `a` até `b`: a reta, ou o arco amostrado com erro de até `tolM` metros. */
export function polyOf(seg: SketchSeg, tolM: number): Vec2[] {
  const arc = arcOf(seg);
  return arc ? arcSample(arc, 0, arc.length, 0, tolM) : [seg.a, seg.b];
}

/** Meio da aresta (sobre o arco, quando há) e a tangente unitária no sentido de `a` para `b`. */
export function edgeFrame(seg: SketchSeg): { at: Vec2; t: Vec2 } {
  const arc = arcOf(seg);
  if (!arc) return { at: mid(seg.a, seg.b), t: norm(sub(seg.b, seg.a)) };
  return { at: arcPointAt(arc, arc.length / 2), t: arcTangentAt(arc, arc.length / 2) };
}

/** Normal unitária da aresta voltada para fora do anel: o lado da perpendicular que cai fora da área do laço. */
export function outwardNormal(at: Vec2, t: Vec2, ring: Ring): Vec2 {
  const n = perp(t);
  const probe = add(at, { x: n.x * SIDE_M, y: n.y * SIDE_M });
  return pointInMulti(probe, [[ring]]) ? { x: -n.x, y: -n.y } : n;
}

/** Laço externo do resultado da validação, ou `null` quando não há (esboço aberto ou vazio). */
export function outerLoop(loops: SketchLoop[]): SketchLoop | null {
  return loops.find((l) => l.role === 'outer') ?? null;
}
