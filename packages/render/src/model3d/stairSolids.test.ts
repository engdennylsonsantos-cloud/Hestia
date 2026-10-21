import { describe, expect, it } from 'vitest';
import { DEFAULT_STAIR_TYPES } from '@hestia/model';
import type { ResolvedStair, ResolvedStairStep } from '@hestia/engine';
import { straightStair } from '../stairFixture.helper.ts';
import { buildStairSolids, riserSlab } from './stairSolids.ts';
import type { SolidBatch } from './solids.ts';

/** Volume por teorema da divergência (malha fechada e bem orientada), como em solids.test.ts. */
function volume(b: { positions: number[]; indices: number[] }): number {
  let v = 0;
  const p = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [p0, p1, p2] = [p(b.indices[i]!), p(b.indices[i + 1]!), p(b.indices[i + 2]!)];
    v += (p0[0] * (p1[1] * p2[2] - p1[2] * p2[1]) - p0[1] * (p1[0] * p2[2] - p1[2] * p2[0]) + p0[2] * (p1[0] * p2[1] - p1[1] * p2[0])) / 6;
  }
  return v;
}

const total = (batches: SolidBatch[]): number => batches.reduce((s, b) => s + Math.abs(volume(b)), 0);

const N = 10;
const P = 0.28;
const H = 0.175;
const W = 1;
const MONO = { ...DEFAULT_STAIR_TYPES[0]!, riserThickness: 0.02 };
const ASSEMBLED = { ...DEFAULT_STAIR_TYPES[1]! };

/** Degrau de patamar no topo (sem espelho): retângulo de W × 1,2 m na cota final. */
function withLanding(s: ResolvedStair): ResolvedStair {
  const landing: ResolvedStairStep = {
    componentIndex: 1,
    kind: 'landing',
    index: 0,
    polygon: [
      { x: 0, y: N * P },
      { x: W, y: N * P },
      { x: W, y: N * P + 1.2 },
      { x: 0, y: N * P + 1.2 },
    ],
    z: s.topZ,
  };
  return { ...s, steps: [...s.steps, landing] };
}

describe('sólidos de escada (3D, decisão 0011 §1)', () => {
  it('monolítico: volume = Σ degraus (área × profundidade estrutural) + espelhos (área × espessura × altura)', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: MONO });
    const expected = (N - 1) * W * P * MONO.structuralDepth + N * W * MONO.riserThickness * H;
    expect(Math.abs(total(buildStairSolids([s])) - expected)).toBeLessThan(1e-9);
  });

  it('montado: volume = Σ degraus (área × espessura do piso) + espelhos (área × espessura do espelho × altura)', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: ASSEMBLED });
    const expected = (N - 1) * W * P * ASSEMBLED.treadThickness + N * W * ASSEMBLED.riserThickness * H;
    expect(Math.abs(total(buildStairSolids([s])) - expected)).toBeLessThan(1e-9);
  });

  it('patamar entra nos dois estilos com a espessura do patamar', () => {
    const extra = W * 1.2 * DEFAULT_STAIR_TYPES[0]!.landingThickness;
    const mono = straightStair({ risers: N, tread: P, riserH: H, width: W, type: MONO });
    const monoBase = (N - 1) * W * P * MONO.structuralDepth + N * W * MONO.riserThickness * H;
    expect(Math.abs(total(buildStairSolids([withLanding(mono)])) - (monoBase + extra))).toBeLessThan(1e-9);
    const asm = straightStair({ risers: N, tread: P, riserH: H, width: W, type: ASSEMBLED });
    const asmBase = (N - 1) * W * P * ASSEMBLED.treadThickness + N * W * ASSEMBLED.riserThickness * H;
    expect(Math.abs(total(buildStairSolids([withLanding(asm)])) - (asmBase + extra))).toBeLessThan(1e-9);
  });

  it('montado: o espelho fica atrás da linha (para o lado do degrau anterior), de y = p − t até y = N·p', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: ASSEMBLED });
    const [b] = buildStairSolids([s]);
    const ys = b!.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(P - ASSEMBLED.riserThickness, 9);
    expect(Math.max(...ys)).toBeCloseTo(N * P, 9);
  });

  it('o espelho de trás não invade o degrau de baixo: sua seção fica acima de z0 e atrás da linha', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: ASSEMBLED });
    const slab = riserSlab(s, s.risers[4]!, 0.02);
    const ys = slab.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(5 * P - 0.02, 9);
    expect(Math.max(...ys)).toBeCloseTo(5 * P, 9);
  });

  it('agrupa por material do tipo', () => {
    const batches = buildStairSolids([straightStair({ risers: N, tread: P, riserH: H, width: W, type: ASSEMBLED })]);
    expect(batches.map((b) => b.materialId)).toEqual([ASSEMBLED.materialId]);
  });

  it('escada com erro não gera malha', () => {
    const issues = [{ code: 'stair-riser-too-high', severity: 'error' as const, message: 'x', stairId: 'st1' }];
    expect(buildStairSolids([straightStair({ issues })])).toEqual([]);
  });

  it('escada sem degraus não gera malha', () => {
    const empty = { ...straightStair(), steps: [], risers: [] };
    expect(buildStairSolids([empty as ResolvedStair])).toEqual([]);
  });
});
