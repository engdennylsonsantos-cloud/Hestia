import { ringArea, triangulate, type Polygon, type Ring } from '@hestia/geom';
import type { ResolvedLevel } from '@hestia/engine';
import type { Id } from '@hestia/model';

/** Malha de um material: vértices próprios por face (sombreamento chapado, arestas nítidas). */
export interface SolidBatch {
  materialId: Id;
  positions: number[];
  normals: number[];
  indices: number[];
}

function oriented(r: Ring, ccw: boolean): Ring {
  const a = ringArea(r);
  return (a > 0) === ccw ? r : [...r].reverse();
}

function push(b: SolidBatch, v: number[], n: [number, number, number], tris: number[]): void {
  const base = b.positions.length / 3;
  for (let i = 0; i < v.length; i += 3) {
    b.positions.push(v[i]!, v[i + 1]!, v[i + 2]!);
    b.normals.push(n[0], n[1], n[2]);
  }
  for (const t of tris) b.indices.push(base + t);
}

/** Extrusão vertical de um polígono com furos entre z0 e z1. */
export function extrudePolygon(b: SolidBatch, poly: Polygon, z0: number, z1: number): void {
  if (z1 - z0 < 1e-6 || !poly[0]) return;
  const rings = poly.map((r, i) => oriented(r, i === 0));
  const norm: Polygon = rings;
  const m = triangulate(norm);
  const top: number[] = [];
  const bottom: number[] = [];
  for (let i = 0; i < m.positions.length; i += 2) {
    top.push(m.positions[i]!, m.positions[i + 1]!, z1);
    bottom.push(m.positions[i]!, m.positions[i + 1]!, z0);
  }
  const up: number[] = [];
  const down: number[] = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    let a = m.indices[i]!;
    let bb = m.indices[i + 1]!;
    const c = m.indices[i + 2]!;
    const cr = (m.positions[bb * 2]! - m.positions[a * 2]!) * (m.positions[c * 2 + 1]! - m.positions[a * 2 + 1]!) - (m.positions[bb * 2 + 1]! - m.positions[a * 2 + 1]!) * (m.positions[c * 2]! - m.positions[a * 2]!);
    if (cr < 0) [a, bb] = [bb, a];
    up.push(a, bb, c);
    down.push(a, c, bb);
  }
  push(b, top, [0, 0, 1], up);
  push(b, bottom, [0, 0, -1], down);
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const L = Math.hypot(dx, dy);
      if (L < 1e-9) continue;
      const nx = dy / L;
      const ny = -dx / L;
      push(b, [p.x, p.y, z0, q.x, q.y, z0, q.x, q.y, z1, p.x, p.y, z1], [nx, ny, 0], [0, 1, 2, 0, 2, 3]);
    }
  }
}

export interface LevelSolids {
  batches: SolidBatch[];
}

/** Sólidos de todas as camadas das paredes do nível, por material. */
export function buildLevelSolids(r: ResolvedLevel): LevelSolids {
  const byMat = new Map<Id, SolidBatch>();
  const batch = (m: Id): SolidBatch => {
    let b = byMat.get(m);
    if (!b) {
      b = { materialId: m, positions: [], normals: [], indices: [] };
      byMat.set(m, b);
    }
    return b;
  };
  for (const rw of Object.values(r.walls)) {
    for (const l of rw.layers) {
      const b = batch(l.materialId);
      for (const poly of l.cut) extrudePolygon(b, poly, rw.baseZ, rw.baseZ + rw.height);
    }
    for (const pc of rw.pieces) {
      const b = batch(pc.materialId);
      for (const poly of pc.poly) extrudePolygon(b, poly, rw.baseZ + pc.z0, rw.baseZ + pc.z1);
    }
  }
  return { batches: [...byMat.values()] };
}
