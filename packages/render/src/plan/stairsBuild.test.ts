import { describe, expect, it } from 'vitest';
import { resolveLevel, pieceVolume, resolveStairs, resolveStairsOnLevel, stairBody } from '@hestia/engine';
import { ProjectStore, createEmptyProject, defaultStairTypeId, makeStair, type Project, type StairRun } from '@hestia/model';
import { buildStairSolids } from '../model3d/stairSolids.ts';
import { buildPlanDrawList, type PlanInput } from './build.ts';
import { LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';

const N = 17;
const P = 0.28;
const W = 1;

/** Volume por teorema da divergência (malha fechada e bem orientada), como em solids.test.ts. */
function meshVolume(b: { positions: number[]; indices: number[] }): number {
  let v = 0;
  const p = (k: number) => [b.positions[k * 3]!, b.positions[k * 3 + 1]!, b.positions[k * 3 + 2]!] as const;
  for (let i = 0; i < b.indices.length; i += 3) {
    const [p0, p1, p2] = [p(b.indices[i]!), p(b.indices[i + 1]!), p(b.indices[i + 2]!)];
    v += (p0[0] * (p1[1] * p2[2] - p1[2] * p2[1]) - p0[1] * (p1[0] * p2[2] - p1[2] * p2[0]) + p0[2] * (p1[0] * p2[1] - p1[1] * p2[0])) / 6;
  }
  return Math.abs(v);
}

/** Lance reto de N espelhos subindo em +x (croqui do motor): limites em y = ±W/2, espelhos verticais em x = k·P. */
function run(): StairRun {
  const ln = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, sag: 0 });
  const x1 = (N + 1) * P;
  return {
    id: 'r1',
    kind: 'run',
    boundaryLeft: [ln(0, W / 2, x1, W / 2)],
    boundaryRight: [ln(0, -W / 2, x1, -W / 2)],
    risers: Array.from({ length: N }, (_, i) => ln((i + 1) * P, -1, (i + 1) * P, 1)),
    path: [],
    generatedBy: 'straight',
  };
}

function project(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [run()] }) });
  return s.project;
}

const VIEW: Viewport = { cx: 2, cy: 0, zoom: 100, width: 800, height: 600 };

function draw(p: Project, levelId: string, opts: Partial<PlanInput> = {}) {
  const input: PlanInput = {
    project: p,
    levelId,
    resolved: resolveLevel(p, levelId, new Map()),
    below: null,
    viewport: VIEW,
    theme: LIGHT,
    dark: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: false,
    ...opts,
  };
  return buildPlanDrawList(input);
}

describe('escadas do projeto na planta e no 3D (integração com o motor)', () => {
  it('o motor resolve a escada com N espelhos e N−1 degraus, sem erro de geometria', () => {
    const [st] = resolveStairsOnLevel(project(), 'lv_0');
    expect(st!.riserCount).toBe(N);
    expect(st!.risers).toHaveLength(N);
    expect(st!.steps.filter((s) => s.kind === 'tread')).toHaveLength(N - 1);
    expect(st!.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('a planta do nível da escada traz a seta SOBE, o corte e os espelhos; degraus acima de 1,20 m tracejados', () => {
    // A escada sobe até ~2,98 m, acima do topo padrão (2,30 m): com o topo subido, todos os espelhos entram na vista.
    const s = new ProjectStore(project());
    s.exec({ type: 'setLevelViewRange', levelId: 'lv_0', patch: { top: 3.5 } });
    const dl = draw(s.project, 'lv_0');
    expect(dl.labels.map((l) => l.text)).toContain('SOBE');
    const lines = dl.strokes.filter((s) => !s.closed && s.pts.length === 2 && !s.dash && s.widthPx === 1.4);
    expect(lines.length).toBeGreaterThanOrEqual(N);
    expect(dl.strokes.some((s) => s.closed && s.dash)).toBe(true);
  });

  it('o nível de cima mostra a escada do nível de baixo esmaecida, sem seta nem rótulo', () => {
    const p = project();
    const below = resolveLevel(p, 'lv_0', new Map());
    const up = draw(p, 'lv_1', { below });
    const alphas = up.fills.map((f) => f.alpha);
    expect(alphas).toContain(0.22);
    expect(up.labels.map((l) => l.text)).not.toContain('SOBE');
    expect(draw(p, 'lv_1').labels.map((l) => l.text)).not.toContain('SOBE');
  });

  it('seleção da escada: destaque azul sobre a pegada', () => {
    const dl = draw(project(), 'lv_0', { selection: ['st1'] });
    expect(dl.fills.some((f) => f.color === LIGHT.select && f.alpha === 0.26)).toBe(true);
  });

  it('a malha 3D sai por material do tipo (concreto, no monolítico padrão), sem escada com erro', () => {
    const p = project();
    const batches = buildStairSolids(resolveStairs(p));
    expect(batches.map((b) => b.materialId)).toEqual(['mat_concreto']);
    expect(batches[0]!.indices.length).toBeGreaterThan(0);
  });

  it('volume da malha monolítica do motor = Σ volumes das peças de stairBody (decisão 0012)', () => {
    const [st] = resolveStairs(project());
    const piecesSum = stairBody(st!, { slabThickness: 0.15 }).pieces.reduce((s, piece) => s + pieceVolume(piece), 0);
    const [b] = buildStairSolids([st!]);
    expect(Math.abs(meshVolume(b!) - piecesSum)).toBeLessThan(1e-9);
  });
});
