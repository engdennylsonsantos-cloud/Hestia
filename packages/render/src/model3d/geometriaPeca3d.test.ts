import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { PartBox, PartProfile } from '@hestia/engine';
import { geometriaDaPeca, geometriaDoPerfil } from './geometriaPeca3d.ts';
import type { OpeningPiece } from './openingParts.ts';

/** Octógono (t, z) de raio 0,5 centrado em (t = 1, z = 2): vértices em 0, 45°, 90°... (a caixa do polígono é exata). */
const OITO: Array<[number, number]> = Array.from({ length: 8 }, (_, k) => [
  1 + 0.5 * Math.cos((2 * Math.PI * k) / 8),
  2 + 0.5 * Math.sin((2 * Math.PI * k) / 8),
]);
const DISCO: PartProfile = { plane: 'tz', pts: OITO };
const CAIXA: PartBox = { t0: 0.5, t1: 1.5, s0: 3, s1: 3.2, z0: 1.5, z1: 2.5 };

describe('geometriaDoPerfil, plano tz', () => {
  it('extrude o octógono em s: 8 faces laterais e 2 tampas triangulares', () => {
    const g = geometriaDoPerfil(DISCO, CAIXA);
    // Laterais: 8 arestas × 2 triângulos; tampas: 2 × (8 − 2) triângulos; 3 vértices por triângulo.
    expect(g.attributes.position!.count).toBe((16 + 12) * 3);
  });

  it('a caixa envolvente da geometria é exatamente a caixa da peça', () => {
    const g = geometriaDoPerfil(DISCO, CAIXA);
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    // Float32 nos buffers: a tolerância é de 1e-6 m (micrômetro).
    expect(bb.min.x).toBeCloseTo(CAIXA.t0, 6);
    expect(bb.max.x).toBeCloseTo(CAIXA.t1, 6);
    expect(bb.min.y).toBeCloseTo(CAIXA.s0, 6);
    expect(bb.max.y).toBeCloseTo(CAIXA.s1, 6);
    expect(bb.min.z).toBeCloseTo(CAIXA.z0, 6);
    expect(bb.max.z).toBeCloseTo(CAIXA.z1, 6);
  });

  it('as normais apontam para fora: tampas em ±s e laterais radiais', () => {
    const g = geometriaDoPerfil(DISCO, CAIXA);
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = g.attributes.normal as THREE.BufferAttribute;
    for (let tri = 0; tri < p.count; tri += 3) {
      const ss = [0, 1, 2].map((k) => p.getY(tri + k));
      const cap = ss.every((s) => Math.abs(s - ss[0]!) < 1e-6);
      for (let k = 0; k < 3; k++) {
        const v = tri + k;
        if (cap) {
          const expected = Math.abs(ss[0]! - CAIXA.s1) < 1e-6 ? 1 : -1;
          expect(n.getY(v) * expected).toBeGreaterThan(0.99);
        } else {
          // Lateral: a normal (em t e z) aponta do centro do disco para o vértice.
          const radial = n.getX(v) * (p.getX(v) - 1) + n.getZ(v) * (p.getZ(v) - 2);
          expect(radial).toBeGreaterThan(0);
        }
      }
    }
  });

  it('a peça com plano tz entra na montagem 3D (geometriaDaPeca) com a mesma caixa', () => {
    const piece = {
      w: CAIXA.t1 - CAIXA.t0,
      d: CAIXA.s1 - CAIXA.s0,
      h: CAIXA.z1 - CAIXA.z0,
      x: (CAIXA.t0 + CAIXA.t1) / 2,
      y: (CAIXA.s0 + CAIXA.s1) / 2,
      z: (CAIXA.z0 + CAIXA.z1) / 2,
      role: 'handle',
      material: 'metal',
      materialId: 'metal',
      profile: DISCO,
    } as unknown as OpeningPiece;
    const g = geometriaDaPeca(piece);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(CAIXA.s1, 6);
    const pos = g.attributes.position!.array;
    for (const v of pos) expect(Number.isFinite(v)).toBe(true);
  });
});
