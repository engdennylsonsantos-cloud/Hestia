import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import {
  ProjectStore,
  createEmptyProject,
  defaultStairTypeId,
  makeStair,
  validateProject,
  type Project,
  type Stair,
  type StairCurve,
  type StairRun,
} from '@hestia/model';
import { resolveStairs } from './stairs.ts';
import { stairIssueList, stairValidationIssues } from './stairChecks.ts';

/**
 * Topo não acima da base (decisão 0011 §3, `stair-top-not-above`). A regra e a mensagem são do modelo (`validateProject`);
 * aqui se confere que o motor não gera degraus, espelhos nem números inválidos para essas escadas, e que não repete o erro.
 */

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance de quatro espelhos (N = 4) entre dois limites horizontais. */
const run: StairRun = {
  id: 'run',
  kind: 'run',
  boundaryLeft: [ln(-0.3, 0.6, 1.2, 0.6)],
  boundaryRight: [ln(-0.3, -0.6, 1.2, -0.6)],
  risers: [0, 0.28, 0.56, 0.84].map((x) => ln(x, -1, x, 1)),
  path: [],
};

/** Projeto padrão: térreo (lv_0, 0 m) e pavimento 2 (lv_1, 3 m). A escada recebe `o` por cima do padrão. */
function projectWith(o: Partial<Stair>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [run], ...o }) });
  return s.project;
}

/** Confere que a escada não tem degrau, espelho nem número inválido, e que o erro vem uma vez só do modelo. */
function expectNoGeometry(p: Project): void {
  const rs = resolveStairs(p);
  expect(rs).toHaveLength(1);
  const r = rs[0]!;
  expect(r.riserHeight).toBe(0);
  expect(r.steps.filter((s) => s.kind === 'tread')).toEqual([]);
  expect(r.risers).toEqual([]);
  for (const n of [r.baseZ, r.topZ, r.riserHeight]) expect(Number.isFinite(n)).toBe(true);
  for (const st of r.steps) expect(Number.isFinite(st.z)).toBe(true);
  expect(stairIssueList(p)).toBeDefined();
  expect(stairValidationIssues(p).filter((i) => i.code === 'stair-top-not-above')).toEqual([]);
  const model = validateProject(p).filter((i) => i.code === 'stair-top-not-above');
  expect(model).toEqual([
    { severity: 'error', code: 'stair-top-not-above', message: 'O nível de topo deve estar acima do nível da escada.', elementId: 'st1' },
  ]);
}

describe('escada com topo não acima da base', () => {
  it('1. topo explícito no mesmo nível da escada: altura zero, sem degraus', () => {
    expectNoGeometry(projectWith({ levelId: 'lv_0', topLevelId: 'lv_0', topOffset: 0 }));
  });

  it('2. topo explícito em nível abaixo: altura negativa, sem degraus', () => {
    expectNoGeometry(projectWith({ levelId: 'lv_1', topLevelId: 'lv_0', topOffset: 0 }));
  });

  it('3. offsets que zeram ou invertem a altura: sem degraus', () => {
    // Topo (3 m + topOffset) igual à base (0 m + baseOffset).
    expectNoGeometry(projectWith({ levelId: 'lv_0', topLevelId: 'lv_1', baseOffset: 0, topOffset: -3 }));
    // Base (0 m + 3,5 m de baseOffset) acima do topo (3 m): altura negativa.
    expectNoGeometry(projectWith({ levelId: 'lv_0', topLevelId: 'lv_1', baseOffset: 3.5, topOffset: 0 }));
  });

  it('4. altura zero ou negativa sem nível de topo (height): sem degraus', () => {
    // lv_1 é o nível mais alto: sem nível acima, vale `height`.
    expectNoGeometry(projectWith({ levelId: 'lv_1', height: 0 }));
    expectNoGeometry(projectWith({ levelId: 'lv_1', height: -1 }));
  });

  it('o caso sem topLevelId usa levelAbove/height e não ganha o erro quando a altura é positiva', () => {
    const p = projectWith({ levelId: 'lv_0', topLevelId: null });
    expect(resolveStairs(p)[0]!.topZ).toBe(3);
    expect(validateProject(p).some((i) => i.code === 'stair-top-not-above')).toBe(false);
    expect(resolveStairs(p)[0]!.riserHeight).toBeCloseTo(3 / 4, 12);
  });
});
