import { ringArea, triangulate, type Polygon, type Ring } from '@hestia/geom';
import { bandTopAt, slabRiseAt, type LayerBand, type ResolvedFloor, type ResolvedLevel, type ResolvedSlab } from '@hestia/engine';
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

/**
 * Extrusão vertical de um polígono com furos entre z0 e z1. Com `topAt`/`bottomAt` (cota por ponto, planos
 * inclinados), o topo e a base seguem essas funções em vez de z1 e z0; a espessura vertical é a mesma em todo lugar.
 */
export function extrudePolygon(
  b: SolidBatch,
  poly: Polygon,
  z0: number,
  z1: number,
  topAt?: (x: number, y: number) => number,
  bottomAt?: (x: number, y: number) => number,
): void {
  if (z1 - z0 < 1e-6 || !poly[0]) return;
  const rings = poly.map((r, i) => oriented(r, i === 0));
  const norm: Polygon = rings;
  const m = triangulate(norm);
  const top: number[] = [];
  const bottom: number[] = [];
  const zTop = (x: number, y: number): number => (topAt ? topAt(x, y) : z1);
  const zBot = (x: number, y: number): number => (bottomAt ? bottomAt(x, y) : z0);
  for (let i = 0; i < m.positions.length; i += 2) {
    top.push(m.positions[i]!, m.positions[i + 1]!, zTop(m.positions[i]!, m.positions[i + 1]!));
    bottom.push(m.positions[i]!, m.positions[i + 1]!, zBot(m.positions[i]!, m.positions[i + 1]!));
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
  // Normais dos planos (lineares por construção): com z = g·p + c, a de cima é (-gx, -gy, 1) e a de baixo (gx, gy, -1).
  const o = poly[0]![0]!;
  const gradient = (at: (x: number, y: number) => number): [number, number] => [at(o.x + 1, o.y) - at(o.x, o.y), at(o.x, o.y + 1) - at(o.x, o.y)];
  let topN: [number, number, number] = [0, 0, 1];
  if (topAt) {
    const [gx, gy] = gradient(topAt);
    const l = Math.hypot(gx, gy, 1);
    topN = [-gx / l, -gy / l, 1 / l];
  }
  let bottomN: [number, number, number] = [0, 0, -1];
  if (bottomAt) {
    const [gx, gy] = gradient(bottomAt);
    const l = Math.hypot(gx, gy, 1);
    bottomN = [gx / l, gy / l, -1 / l];
  }
  push(b, top, topN, up);
  push(b, bottom, bottomN, down);
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
      push(b, [p.x, p.y, zBot(p.x, p.y), q.x, q.y, zBot(q.x, q.y), q.x, q.y, zTop(q.x, q.y), p.x, p.y, zTop(p.x, p.y)], [nx, ny, 0], [0, 1, 2, 0, 2, 3]);
    }
  }
}

export interface LevelSolids {
  batches: SolidBatch[];
}

/** Lote do material `m` dentro do mapa, criado na primeira vez. */
function batchOf(byMat: Map<Id, SolidBatch>, m: Id): SolidBatch {
  let b = byMat.get(m);
  if (!b) {
    b = { materialId: m, positions: [], normals: [], indices: [] };
    byMat.set(m, b);
  }
  return b;
}

/** Sólidos de todas as camadas das paredes do nível, por material. */
export function buildLevelSolids(r: ResolvedLevel): LevelSolids {
  const byMat = new Map<Id, SolidBatch>();
  for (const rw of Object.values(r.walls)) {
    for (const l of rw.layers) {
      const b = batchOf(byMat, l.materialId);
      for (const band of l.bands) {
        const topAt = band.slope ? slopeTop(band, rw.baseZ) : undefined;
        for (const poly of band.poly) extrudePolygon(b, poly, rw.baseZ + band.z0, rw.baseZ + band.z1, topAt);
      }
    }
  }
  return { batches: [...byMat.values()] };
}

/** Sólidos dos pisos: uma extrusão por camada entre as cotas absolutas (furos incluídos), agrupada por material. */
export function buildFloorSolids(floors: ResolvedFloor[]): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const f of floors) {
    for (const l of f.layers) {
      const b = batchOf(byMat, l.materialId);
      for (const poly of f.polygon) extrudePolygon(b, poly, l.z0, l.z1);
    }
  }
  return [...byMat.values()];
}

/**
 * Sólidos das lajes (D2): uma extrusão por camada, por material, com furos. Com inclinação, topo e base da camada
 * seguem o mesmo plano (a subida de `slabRiseAt`), então a espessura vertical fica constante.
 */
export function buildSlabSolids(slabs: ResolvedSlab[]): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const s of slabs) {
    const sl = s.slope;
    for (const l of s.layers) {
      const b = batchOf(byMat, l.materialId);
      const topAt = sl ? (x: number, y: number): number => l.z1 + slabRiseAt(sl, { x, y }) : undefined;
      const bottomAt = sl ? (x: number, y: number): number => l.z0 + slabRiseAt(sl, { x, y }) : undefined;
      for (const poly of s.polygon) extrudePolygon(b, poly, l.z0, l.z1, topAt, bottomAt);
    }
  }
  return [...byMat.values()];
}

const slopeTop = (band: LayerBand, baseZ: number) => (x: number, y: number): number => baseZ + bandTopAt(band, { x, y });
