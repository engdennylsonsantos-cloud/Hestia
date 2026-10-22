import * as THREE from 'three';

/** Triângulo mais próximo atingido pelo raio, no espaço local da malha. */
export interface TriBvhHit {
  faceIndex: number;
  distance: number;
  point: THREE.Vector3;
}

/** BVH de triângulos de uma geometria indexada: caixas alinhadas, divisão por mediana e folhas de até 8 triângulos. */
export interface TriBvh {
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
  /** Ordem dos triângulos nas folhas (valores são `faceIndex`). */
  order: Uint32Array;
  /** Caixa de cada nó: minx, miny, minz, maxx, maxy, maxz. */
  bounds: Float64Array;
  /** Filho esquerdo; −1 marca folha. */
  left: Int32Array;
  right: Int32Array;
  first: Uint32Array;
  count: Uint32Array;
  stats: { triangles: number; nodes: number; leaves: number; depth: number; tested: number };
}

const LEAF = 8;

/** Constrói o BVH a partir das posições e dos índices da geometria (triângulos de 3 em 3). */
export function buildTriBvh(positions: ArrayLike<number>, indices: ArrayLike<number>): TriBvh {
  const triangles = Math.floor(indices.length / 3);
  const maxNodes = Math.max(1, triangles * 2 - 1);
  const bvh: TriBvh = {
    positions,
    indices,
    order: new Uint32Array(triangles),
    bounds: new Float64Array(maxNodes * 6),
    left: new Int32Array(maxNodes),
    right: new Int32Array(maxNodes),
    first: new Uint32Array(maxNodes),
    count: new Uint32Array(maxNodes),
    stats: { triangles, nodes: 0, leaves: 0, depth: 0, tested: 0 },
  };
  if (!triangles) return bvh;

  const centroids = new Float64Array(triangles * 3);
  for (let t = 0; t < triangles; t++) {
    bvh.order[t] = t;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 3; k++) {
      const v = indices[t * 3 + k]! * 3;
      x += positions[v]!;
      y += positions[v + 1]!;
      z += positions[v + 2]!;
    }
    centroids[t * 3] = x / 3;
    centroids[t * 3 + 1] = y / 3;
    centroids[t * 3 + 2] = z / 3;
  }

  let next = 0;
  const build = (start: number, end: number, depth: number): number => {
    const node = next++;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    let cMinX = Infinity;
    let cMinY = Infinity;
    let cMinZ = Infinity;
    let cMaxX = -Infinity;
    let cMaxY = -Infinity;
    let cMaxZ = -Infinity;
    for (let i = start; i < end; i++) {
      const t = bvh.order[i]!;
      const cx = centroids[t * 3]!;
      const cy = centroids[t * 3 + 1]!;
      const cz = centroids[t * 3 + 2]!;
      if (cx < cMinX) cMinX = cx;
      if (cy < cMinY) cMinY = cy;
      if (cz < cMinZ) cMinZ = cz;
      if (cx > cMaxX) cMaxX = cx;
      if (cy > cMaxY) cMaxY = cy;
      if (cz > cMaxZ) cMaxZ = cz;
      for (let k = 0; k < 3; k++) {
        const v = indices[t * 3 + k]! * 3;
        const x = positions[v]!;
        const y = positions[v + 1]!;
        const z = positions[v + 2]!;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
    const b = node * 6;
    bvh.bounds[b] = minX;
    bvh.bounds[b + 1] = minY;
    bvh.bounds[b + 2] = minZ;
    bvh.bounds[b + 3] = maxX;
    bvh.bounds[b + 4] = maxY;
    bvh.bounds[b + 5] = maxZ;
    if (depth > bvh.stats.depth) bvh.stats.depth = depth;

    if (end - start <= LEAF) {
      bvh.left[node] = -1;
      bvh.first[node] = start;
      bvh.count[node] = end - start;
      bvh.stats.leaves++;
      return node;
    }

    const ex = cMaxX - cMinX;
    const ey = cMaxY - cMinY;
    const ez = cMaxZ - cMinZ;
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const mid = (start + end) >> 1;
    const part = Array.from(bvh.order.subarray(start, end));
    part.sort((a, c) => centroids[a * 3 + axis]! - centroids[c * 3 + axis]!);
    bvh.order.set(part, start);

    bvh.left[node] = build(start, mid, depth + 1);
    bvh.right[node] = build(mid, end, depth + 1);
    return node;
  };

  build(0, triangles, 0);
  bvh.stats.nodes = next;
  return bvh;
}

/**
 * Triângulo mais próximo atingido por `ray` (espaço local), com interseção de Möller–Trumbore. O `side` segue o
 * material da malha, como o `Raycaster`: `FrontSide` descarta as faces de trás, `BackSide` as da frente e `DoubleSide`
 * aceita as duas. `accept` filtra triângulos (usado para exigir uma faixa de elemento).
 */
export function raycastTriBvh(
  bvh: TriBvh,
  ray: THREE.Ray,
  maxDist = Infinity,
  side: THREE.Side = THREE.DoubleSide,
  accept?: (faceIndex: number) => boolean,
): TriBvhHit | null {
  bvh.stats.tested = 0;
  if (!bvh.stats.triangles || maxDist <= 0) return null;

  const { positions, indices, order, bounds, left, right, first, count } = bvh;
  const ox = ray.origin.x;
  const oy = ray.origin.y;
  const oz = ray.origin.z;
  const dx = ray.direction.x;
  const dy = ray.direction.y;
  const dz = ray.direction.z;
  let bestT = maxDist;
  let bestFace = -1;
  const stack: number[] = [0];

  while (stack.length) {
    const node = stack.pop()!;
    if (!hitBox(bounds, node, ox, oy, oz, dx, dy, dz, bestT)) continue;
    if (left[node] === -1) {
      const f = first[node]!;
      const end = f + count[node]!;
      for (let i = f; i < end; i++) {
        const face = order[i]!;
        bvh.stats.tested++;
        if (accept && !accept(face)) continue;
        const t = intersectTriangle(positions, indices, face, ox, oy, oz, dx, dy, dz, side);
        if (t !== null && (t < bestT || (t === bestT && (bestFace < 0 || face < bestFace)))) {
          bestT = t;
          bestFace = face;
        }
      }
    } else {
      stack.push(left[node]!, right[node]!);
    }
  }

  if (bestFace < 0) return null;
  return { faceIndex: bestFace, distance: bestT, point: ray.at(bestT, new THREE.Vector3()) };
}

function hitBox(
  bounds: Float64Array,
  node: number,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): boolean {
  const b = node * 6;
  let tmin = 0;
  let tmax = maxDist;
  for (let axis = 0; axis < 3; axis++) {
    const o = axis === 0 ? ox : axis === 1 ? oy : oz;
    const d = axis === 0 ? dx : axis === 1 ? dy : dz;
    const lo = bounds[b + axis]!;
    const hi = bounds[b + 3 + axis]!;
    if (d === 0) {
      if (o < lo || o > hi) return false;
      continue;
    }
    const inv = 1 / d;
    let t1 = (lo - o) * inv;
    let t2 = (hi - o) * inv;
    if (t1 > t2) {
      const s = t1;
      t1 = t2;
      t2 = s;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  return true;
}

function intersectTriangle(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  face: number,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  side: THREE.Side,
): number | null {
  const ia = indices[face * 3]! * 3;
  const ib = indices[face * 3 + 1]! * 3;
  const ic = indices[face * 3 + 2]! * 3;
  const ax = positions[ia]!;
  const ay = positions[ia + 1]!;
  const az = positions[ia + 2]!;
  const e1x = positions[ib]! - ax;
  const e1y = positions[ib + 1]! - ay;
  const e1z = positions[ib + 2]! - az;
  const e2x = positions[ic]! - ax;
  const e2y = positions[ic + 1]! - ay;
  const e2z = positions[ic + 2]! - az;

  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (side === THREE.FrontSide) {
    if (!(det > 0)) return null;
  } else if (side === THREE.BackSide) {
    if (!(det < 0)) return null;
  } else if (det === 0) {
    return null;
  }

  const inv = 1 / det;
  const tx = ox - ax;
  const ty = oy - ay;
  const tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;

  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return null;

  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t >= 0 ? t : null;
}
