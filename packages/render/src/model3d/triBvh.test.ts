import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTriBvh, raycastTriBvh } from './triBvh.ts';

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Malha aleatória de triângulos independentes, centrados num cubo de lado 2. */
function malha(triangulos: number, random: () => number): { positions: Float32Array; indices: Uint32Array } {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let t = 0; t < triangulos; t++) {
    const cx = random() * 2 - 1;
    const cy = random() * 2 - 1;
    const cz = random() * 2 - 1;
    for (let k = 0; k < 3; k++) {
      positions.push(cx + (random() - 0.5) * 0.6, cy + (random() - 0.5) * 0.6, cz + (random() - 0.5) * 0.6);
      indices.push(t * 3 + k);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Força bruta com a interseção do próprio Three, dupla face, para comparar com o BVH. */
function forcaBruta(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  ray: THREE.Ray,
): { faceIndex: number; distance: number; point: THREE.Vector3 } | null {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  let best: { faceIndex: number; distance: number; point: THREE.Vector3 } | null = null;
  for (let f = 0; f < indices.length / 3; f++) {
    const ia = indices[f * 3]! * 3;
    const ib = indices[f * 3 + 1]! * 3;
    const ic = indices[f * 3 + 2]! * 3;
    a.set(positions[ia]!, positions[ia + 1]!, positions[ia + 2]!);
    b.set(positions[ib]!, positions[ib + 1]!, positions[ib + 2]!);
    c.set(positions[ic]!, positions[ic + 1]!, positions[ic + 2]!);
    const hit = ray.intersectTriangle(a, b, c, false, p);
    if (!hit) continue;
    const distance = hit.distanceTo(ray.origin);
    if (!best || distance < best.distance) best = { faceIndex: f, distance, point: hit.clone() };
  }
  return best;
}

describe('BVH de triângulos', () => {
  const random = rng(20261022);
  const { positions, indices } = malha(2000, random);
  const bvh = buildTriBvh(positions, indices);

  it('equivale à força bruta em 200 raios aleatórios', () => {
    for (let i = 0; i < 200; i++) {
      const origin = new THREE.Vector3((random() * 2 - 1) * 3, (random() * 2 - 1) * 3, (random() * 2 - 1) * 3);
      const target = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
      const ray = new THREE.Ray(origin, target.clone().sub(origin).normalize());
      const got = raycastTriBvh(bvh, ray);
      const want = forcaBruta(positions, indices, ray);
      if (!want) {
        expect(got).toBeNull();
        continue;
      }
      expect(got).not.toBeNull();
      expect(got!.faceIndex).toBe(want.faceIndex);
      expect(got!.distance).toBeCloseTo(want.distance, 9);
      expect(got!.point.x).toBeCloseTo(want.point.x, 9);
      expect(got!.point.y).toBeCloseTo(want.point.y, 9);
      expect(got!.point.z).toBeCloseTo(want.point.z, 9);
    }
  });

  it('raio que não acerta devolve null', () => {
    const tri = buildTriBvh(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]), new Uint32Array([0, 1, 2]));
    const ray = new THREE.Ray(new THREE.Vector3(10, 10, 5), new THREE.Vector3(0, 0, -1));
    expect(raycastTriBvh(tri, ray)).toBeNull();
  });

  it('testa muito menos triângulos que o total', () => {
    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    raycastTriBvh(bvh, ray);
    expect(bvh.stats.tested).toBeGreaterThan(0);
    expect(bvh.stats.tested).toBeLessThan(bvh.stats.triangles / 4);
  });
});
