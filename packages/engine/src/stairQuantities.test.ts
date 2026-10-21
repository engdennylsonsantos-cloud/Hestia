import { describe, expect, it } from 'vitest';
import { type Vec2 } from '@hestia/geom';
import { DEFAULT_STAIR_TYPES, ProjectStore, createEmptyProject, makeStair, type Project, type StairCurve, type StairLanding, type StairRun } from '@hestia/model';
import { resolveStairs, stairQuantities, type ResolvedStair } from './index.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance reto em +x: `n` espelhos a cada `spacing`; limites em y = ±w/2; espelhos passam dos limites e são aparados. */
function straight(n: number, spacing: number, width = 1.2, x0 = 0): StairRun {
  const b = x0 + (n - 1) * spacing + 0.5;
  return {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(x0 - 0.5, width / 2, b, width / 2)],
    boundaryRight: [ln(x0 - 0.5, -width / 2, b, -width / 2)],
    risers: Array.from({ length: n }, (_, k) => ln(x0 + k * spacing, -1, x0 + k * spacing, 1)),
    path: [],
  };
}

/** Patamar retangular de x0 a x1, largura w. */
function rect(x0: number, x1: number, w: number): StairLanding {
  const h = w / 2;
  return { id: 'landing', kind: 'landing', boundary: [ln(x0, -h, x1, -h), ln(x1, -h, x1, h), ln(x1, h, x0, h), ln(x0, h, x0, -h)] };
};

function project(components: Array<StairRun | StairLanding>, typeId: string): Project {
  const s = new ProjectStore(createEmptyProject());
  // Pavimento 2 a 3,00 m com deslocamento de topo −0,20 m: topo em 2,80 m (H = 2,80 m).
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId, levelId: 'lv_0', components, topOffset: -0.2 }) });
  return s.project;
}

const only = (p: Project): ResolvedStair => {
  const list = resolveStairs(p);
  expect(list).toHaveLength(1);
  return list[0]!;
};

const MONO = 'stt_monolitica';
const ASSEMBLED = 'stt_piso_espelho';

/*
 * Escada reta de referência: 16 espelhos a cada 0,28 m, largura 1,20 m, H = 2,80 m.
 *   N = 16 espelhos, h = 2,80 ÷ 16 = 0,175 m; 15 degraus de 0,28 × 1,20 = 0,336 m² cada.
 *   Área dos degraus = 15 × 0,336 = 5,04 m² (= área em planta). Comprimento dos espelhos = 16 × 1,20 = 19,20 m.
 *   Monolítico (profundidade 0,20 m): 5,04 × 0,20 = 1,008 m³.
 *   Piso e espelho: 5,04 × 0,03 = 0,1512 m³ de pisos; 19,20 × 0,175 × 0,02 = 0,0672 m³ de espelhos; total 0,2184 m³.
 */
describe('quantitativos da escada reta de referência', () => {
  it('monolítica: contagens, geometria e volume 1,008 m³', () => {
    const q = stairQuantities(only(project([straight(16, 0.28)], MONO)));
    expect(q).toMatchObject({ runStyle: 'monolithic', riserCount: 16, treadCount: 15, landingArea: 0 });
    expect(q.width).toBeCloseTo(1.2, 9);
    expect(q.riserHeight).toBeCloseTo(0.175, 9);
    expect(q.treadMean).toBeCloseTo(0.28, 9);
    expect(q.planArea).toBeCloseTo(5.04, 9);
    expect(q.treadArea).toBeCloseTo(5.04, 9);
    expect(q.riserLength).toBeCloseTo(19.2, 9);
    expect(q.volumeRun).toBeCloseTo(1.008, 9);
    expect(q.volumeRisers).toBe(0);
    expect(q.volumeLandings).toBe(0);
    expect(q.volume).toBeCloseTo(1.008, 9);
  });

  it('piso e espelho: volume 0,2184 m³ (pisos 0,1512 + espelhos 0,0672)', () => {
    const q = stairQuantities(only(project([straight(16, 0.28)], ASSEMBLED)));
    expect(q.runStyle).toBe('assembled');
    expect(q.volumeRun).toBeCloseTo(0.1512, 9);
    expect(q.volumeRisers).toBeCloseTo(0.0672, 9);
    expect(q.volume).toBeCloseTo(0.2184, 9);
  });

  it('um lance: uma linha de lance com 15 degraus e piso 0,28 m', () => {
    const q = stairQuantities(only(project([straight(16, 0.28)], MONO)));
    expect(q.runs).toHaveLength(1);
    expect(q.runs[0]).toMatchObject({ componentIndex: 0, treadCount: 15 });
    expect(q.runs[0]!.width).toBeCloseTo(1.2, 9);
    expect(q.runs[0]!.treadMean).toBeCloseTo(0.28, 9);
    expect(q.runs[0]!.treadArea).toBeCloseTo(5.04, 9);
  });
});

describe('quantitativos com patamar', () => {
  // Dois lances de 8 espelhos (7 degraus cada) ligados por um patamar de 1,20 × 1,20 m a 1,40 m (8 × 0,175 m).
  const twoRuns = [straight(8, 0.28), rect(2.46, 3.66, 1.2), straight(8, 0.28, 1.2, 3.66)];

  it('área dos degraus de 14 × 0,336 m²; patamar de 1,44 m² entra no volume pela espessura de 0,15 m', () => {
    const q = stairQuantities(only(project(twoRuns, MONO)));
    expect(q.riserCount).toBe(16);
    expect(q.treadCount).toBe(14);
    expect(q.treadArea).toBeCloseTo(14 * 0.336, 9);
    expect(q.landingArea).toBeCloseTo(1.44, 9);
    expect(q.planArea).toBeCloseTo(14 * 0.336 + 1.44, 9);
    expect(q.volumeLandings).toBeCloseTo(1.44 * 0.15, 9);
    expect(q.volume).toBeCloseTo(14 * 0.336 * 0.2 + 1.44 * 0.15, 9);
  });

  it('por lance: dois lances com 7 degraus cada e piso médio de 0,28 m', () => {
    const q = stairQuantities(only(project(twoRuns, MONO)));
    expect(q.runs.map((r) => [r.componentIndex, r.treadCount])).toEqual([
      [0, 7],
      [2, 7],
    ]);
    expect(q.runs.every((r) => Math.abs(r.treadMean - 0.28) < 1e-9)).toBe(true);
    expect(q.treadMean).toBeCloseTo(0.28, 9);
  });
});

describe('escada sem geometria', () => {
  it('sem degraus, espelhos nem área, tudo zero (não quebra)', () => {
    const empty: ResolvedStair = {
      id: 'e',
      levelId: 'lv_0',
      topLevelId: null,
      typeId: MONO,
      type: DEFAULT_STAIR_TYPES[0]!,
      baseZ: 0,
      topZ: 2.8,
      riserCount: 0,
      riserHeight: 0,
      steps: [],
      risers: [],
      footprint: [],
      issues: [],
    };
    const q = stairQuantities(empty);
    expect(q).toMatchObject({ treadCount: 0, treadMean: 0, width: 0, planArea: 0, treadArea: 0, volume: 0, runs: [] });
  });
});
