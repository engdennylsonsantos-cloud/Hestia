import { dist, type Vec2 } from './vec.ts';
import { SkeletonFail, type Node, type Sim } from './skeletonCore.ts';

/** Aresta líder de uma face (uma por reta; arestas colineares de mesmo peso compartilham a face). */
export interface LeaderInfo {
  id: number;
  ring: number;
  edge: number;
  w: number;
}

export interface RawFace {
  ring: number;
  edge: number;
  polygon: Vec2[];
  z: number[];
}

export interface RawArc {
  a: Vec2;
  b: Vec2;
  za: number;
  zb: number;
  faces: [number, number];
}

/**
 * Contorno de uma face: caminha pelas arestas-base e arcos rotulados com `L`.
 * Cada nó da face tem exatamente dois segmentos dela; qualquer desvio é erro de topologia.
 */
function walkFace(sim: Sim, L: number): Node[] {
  const segIdx: number[] = [];
  sim.segs.forEach((s, k) => {
    if (s.f1 === L || s.f2 === L) segIdx.push(k);
  });
  const adj = new Map<number, number[]>();
  for (const k of segIdx) {
    const s = sim.segs[k]!;
    for (const end of [s.a, s.b]) {
      const list = adj.get(end);
      if (list) list.push(k);
      else adj.set(end, [k]);
    }
  }
  const first = segIdx.find((k) => sim.segs[k]!.base);
  if (first === undefined) throw new SkeletonFail('face sem aresta de contorno');
  const used = new Set<number>([first]);
  const start = sim.segs[first]!.a;
  const path: Node[] = [sim.nodes[start]!];
  let cur = sim.segs[first]!.b;
  let guard = 0;
  while (cur !== start) {
    if (++guard > segIdx.length + 1) throw new SkeletonFail('contorno de face não fecha');
    path.push(sim.nodes[cur]!);
    const cands = (adj.get(cur) ?? []).filter((k) => !used.has(k));
    if (cands.length !== 1) throw new SkeletonFail('topologia do esqueleto inconsistente');
    const k = cands[0]!;
    used.add(k);
    const s = sim.segs[k]!;
    cur = s.a === cur ? s.b : s.a;
  }
  if (used.size !== segIdx.length) throw new SkeletonFail('face com mais de um contorno');
  return path;
}

/** Remove repetidos, garante orientação anti-horária e devolve polígono com alturas. */
function toPolygon(path: Node[]): { polygon: Vec2[]; z: number[] } {
  const pts: Node[] = [];
  for (const q of path) {
    const last = pts[pts.length - 1];
    if (!last || dist(last, q) > 1e-9) pts.push(q);
  }
  while (pts.length > 1 && dist(pts[0]!, pts[pts.length - 1]!) <= 1e-9) pts.pop();
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  if (pts.length < 3 || Math.abs(area) < 1e-12) throw new SkeletonFail('face degenerada (área zero)');
  if (area < 0) pts.reverse();
  return { polygon: pts.map((p) => ({ x: p.x, y: p.y })), z: pts.map((p) => p.z) };
}

/** Monta faces (uma por líder com peso > 0) e arcos (arestas do esqueleto entre duas faces). */
export function buildOutput(sim: Sim, leaders: LeaderInfo[]): { faces: RawFace[]; arcs: RawArc[] } {
  const faces: RawFace[] = [];
  const faceIdx = new Map<number, number>();
  for (const L of leaders) {
    if (L.w <= 0) continue;
    const { polygon, z } = toPolygon(walkFace(sim, L.id));
    faceIdx.set(L.id, faces.length);
    faces.push({ ring: L.ring, edge: L.edge, polygon, z });
  }
  const arcs: RawArc[] = [];
  for (const s of sim.segs) {
    if (s.base) continue;
    const fa = faceIdx.get(s.f1);
    const fb = faceIdx.get(s.f2);
    if (fa === undefined || fb === undefined) continue;
    const na = sim.nodes[s.a]!;
    const nb = sim.nodes[s.b]!;
    if (dist(na, nb) <= 1e-9) continue;
    arcs.push({ a: { x: na.x, y: na.y }, b: { x: nb.x, y: nb.y }, za: na.z, zb: nb.z, faces: [fa, fb] });
  }
  return { faces, arcs };
}
