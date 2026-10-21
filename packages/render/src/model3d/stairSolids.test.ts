import { describe, expect, it } from 'vitest';
import { generateLShape, pieceVolume, resolveStairsOnLevel, stairBody, type ResolvedStair, type ResolvedStairStep, type StairComponentSketch } from '@hestia/engine';
import { DEFAULT_STAIR_TYPES, ProjectStore, createEmptyProject, defaultStairTypeId, makeStair, type StairLanding, type StairRun } from '@hestia/model';
import { straightStair } from '../stairFixture.helper.ts';
import { buildStairSolids, riserSlab, stairSlabThickness } from './stairSolids.ts';
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

/** Soma dos volumes das peças monolíticas (engine), com a mesma espessura de chegada padrão (0,15 m). */
const piecesVolume = (s: ResolvedStair): number => stairBody(s, { slabThickness: 0.15 }).pieces.reduce((acc, p) => acc + pieceVolume(p), 0);

const N = 10;
const P = 0.28;
const H = 0.175;
const W = 1;
const MONO = { ...DEFAULT_STAIR_TYPES[0]! };
const ASSEMBLED = { ...DEFAULT_STAIR_TYPES[1]! };

/** Degrau de patamar no topo (sem espelho): retângulo de W × 1,2 m na cota final. Só para o estilo piso e espelho. */
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

/** Componentes do croqui (engine) com id, como a escada guarda no modelo. */
function toModel(cs: StairComponentSketch[]): Array<StairRun | StairLanding> {
  return cs.map((c, i) => (c.kind === 'run' ? { id: `r_${i}`, kind: 'run', ...c.run } : { id: `p_${i}`, kind: 'landing', boundary: c.landing.boundary }));
}

/** Escada em L de dois lances de 8 espelhos (N = 16, H = 2,80 m) com patamar quadrado, do tipo padrão (monolítico). */
function lStair(): ResolvedStair {
  const comps = generateLShape({ start: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, width: 1.2, risersFirst: 8, risersSecond: 8, tread: P, turn: 'left' });
  const store = new ProjectStore(createEmptyProject());
  store.exec({
    type: 'addStair',
    stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', topOffset: -0.2, height: 2.8, components: toModel(comps) }),
  });
  const [rs] = resolveStairsOnLevel(store.project, 'lv_0');
  expect(rs).toBeDefined();
  expect(rs!.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return rs!;
}

describe('sólidos de escada (3D, decisões 0011 §1 e 0012)', () => {
  it('monolítico liso: volume da malha = Σ volumes das peças de stairBody', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: MONO });
    expect(Math.abs(total(buildStairSolids([s])) - piecesVolume(s))).toBeLessThan(1e-9);
  });

  it('monolítico escalonado: volume da malha = Σ volumes das peças de stairBody', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: { ...MONO, undersideStyle: 'stepped' } });
    expect(Math.abs(total(buildStairSolids([s])) - piecesVolume(s))).toBeLessThan(1e-9);
  });

  it('monolítico: cada peça tem espessura positiva (volume > 0)', () => {
    for (const undersideStyle of ['smooth', 'stepped'] as const) {
      const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: { ...MONO, undersideStyle } });
      const pieces = stairBody(s, { slabThickness: 0.15 }).pieces;
      expect(pieces.length).toBeGreaterThan(0);
      for (const piece of pieces) expect(pieceVolume(piece)).toBeGreaterThan(0);
    }
  });

  it('monolítico: topo contínuo, nenhum vértice abaixo de baseZ (a escada apoia no piso)', () => {
    const baseZ = 0.3;
    for (const undersideStyle of ['smooth', 'stepped'] as const) {
      const s = straightStair({ risers: N, tread: P, riserH: H, width: W, baseZ, type: { ...MONO, undersideStyle } });
      const [b] = buildStairSolids([s]);
      const zs = b!.positions.filter((_, i) => i % 3 === 2);
      // Tolerância de 1e-6 m: os vértices do corte pelo piso base vêm da divisão do polígono no engine (~3e-8 m de erro).
      expect(Math.min(...zs)).toBeGreaterThanOrEqual(baseZ - 1e-6);
    }
  });

  it('monolítico: os espelhos não geram placas à parte (o volume é só o das peças)', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: { ...MONO, riserThickness: 0.02 } });
    expect(Math.abs(total(buildStairSolids([s])) - piecesVolume(s))).toBeLessThan(1e-9);
  });

  it('L com patamar: a peça de patamar está presente, à cota do patamar, com fundo plano em zTop − (h + T)', () => {
    const s = lStair();
    const pieces = stairBody(s, { slabThickness: 0.15 }).pieces;
    const landing = pieces.find((p) => p.kind === 'landing');
    expect(landing).toBeDefined();
    const landingStep = s.steps.find((st) => st.kind === 'landing')!;
    expect(landing!.zTop).toBeCloseTo(landingStep.z, 9);
    const T = (s.type.structuralDepth * Math.hypot(P, s.riserHeight)) / P;
    expect(landing!.bottom.a).toBeCloseTo(0, 12);
    expect(landing!.bottom.b).toBeCloseTo(0, 12);
    expect(landing!.bottom.c).toBeCloseTo(landing!.zTop - (s.riserHeight + T), 9);
  });

  it('L com patamar: volume da malha = Σ volumes das peças de stairBody', () => {
    const s = lStair();
    expect(Math.abs(total(buildStairSolids([s])) - piecesVolume(s))).toBeLessThan(1e-9);
  });

  it('piso e espelho: volume = Σ degraus (área × espessura do piso) + espelhos (área × espessura do espelho × altura)', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: ASSEMBLED });
    const expected = (N - 1) * W * P * ASSEMBLED.treadThickness + N * W * ASSEMBLED.riserThickness * H;
    expect(Math.abs(total(buildStairSolids([s])) - expected)).toBeLessThan(1e-9);
  });

  it('piso e espelho: patamar entra com a espessura do patamar', () => {
    const extra = W * 1.2 * DEFAULT_STAIR_TYPES[0]!.landingThickness;
    const asm = straightStair({ risers: N, tread: P, riserH: H, width: W, type: ASSEMBLED });
    const asmBase = (N - 1) * W * P * ASSEMBLED.treadThickness + N * W * ASSEMBLED.riserThickness * H;
    expect(Math.abs(total(buildStairSolids([withLanding(asm)])) - (asmBase + extra))).toBeLessThan(1e-9);
  });

  it('piso e espelho: o espelho fica atrás da linha (para o lado do degrau anterior), de y = p − t até y = N·p', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: ASSEMBLED });
    const [b] = buildStairSolids([s]);
    const ys = b!.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(P - ASSEMBLED.riserThickness, 9);
    expect(Math.max(...ys)).toBeCloseTo(N * P, 9);
  });

  it('piso e espelho: o espelho de trás não invade o degrau de baixo: sua seção fica acima de z0 e atrás da linha', () => {
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

  it('a espessura de chegada vem do callback (padrão 0,15 m quando não há laje sobre a escada)', () => {
    const s = straightStair({ risers: N, tread: P, riserH: H, width: W, type: MONO });
    const withDefault = total(buildStairSolids([s]));
    const withSame = total(buildStairSolids([s], () => 0.15));
    expect(Math.abs(withDefault - withSame)).toBeLessThan(1e-12);
    const ph = new ProjectStore(createEmptyProject()).project;
    expect(stairSlabThickness(ph, s)).toBe(0.15);
  });

  it('escada com erro não gera malha', () => {
    const issues = [{ code: 'stair-riser-too-high', severity: 'error' as const, message: 'x', stairId: 'st1' }];
    expect(buildStairSolids([straightStair({ issues })])).toEqual([]);
    expect(buildStairSolids([straightStair({ issues, type: MONO })])).toEqual([]);
  });

  it('escada sem degraus não gera malha', () => {
    const empty = { ...straightStair(), steps: [], risers: [] };
    expect(buildStairSolids([empty as ResolvedStair])).toEqual([]);
  });
});
