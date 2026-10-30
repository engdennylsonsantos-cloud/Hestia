import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, levelDimensions, angularDimensionGeometry, type Project, type Wall } from '@hestia/model';
import { frameOfWall, pointAt, resolveAngularDimension, tangentAt } from '@hestia/engine';
import type { Vec2 as Vec2Like } from '@hestia/geom';
import { makeEnv, P } from './testEnv.ts';
import { createTool } from './registry.ts';

const deg = Math.PI / 180;

const clickAt = (tool: ReturnType<typeof createTool>, x: number, y: number): void => {
  tool.move(P(x, y));
  tool.click(P(x, y));
};

/** Reta de referência de parede (face ou eixo) no projeto atual: ponto e direção. */
function wallLine(project: Project, key: string): { p: Vec2Like; d: Vec2Like } {
  const separator = key.indexOf(':');
  const frame = frameOfWall(project, key.slice(0, separator))!;
  const ref = key.slice(separator + 1);
  const s = ref === 'face:hi' ? frame.sHi : ref === 'face:lo' ? frame.sLo : 0;
  return { p: pointAt(frame, frame.length / 2, s), d: tangentAt(frame, frame.length / 2) };
}

/** Confere que o ponto está sobre a reta (prolongada), sem limite de trecho. */
function expectOnLine(line: { p: Vec2Like; d: Vec2Like }, point: Vec2Like): void {
  const rel = { x: point.x - line.p.x, y: point.y - line.p.y };
  expect(Math.abs(rel.x * line.d.y - rel.y * line.d.x)).toBeLessThan(1e-6);
}

describe('Cota angular: arco sobre as retas de referência (modelo Revit)', () => {
  it.each([
    { side: 'interno', cursor: { x: 6, y: 6 } },
    { side: 'externo', cursor: { x: -6, y: -6 } },
  ])('referências curtas: pontas sobre as retas e linha de chamada até a ponta ($side)', ({ cursor }) => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 1, y: 0 }, b: { x: 4, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 0, y: 4 } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 2.5, 0.01);
    clickAt(tool, 0.01, 2);
    clickAt(tool, cursor.x, cursor.y);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    const dim = dims[0]!;
    const g = angularDimensionGeometry(dim)!;
    expectOnLine(wallLine(store.project, dim.angular!.refA), g.start);
    expectOnLine(wallLine(store.project, dim.angular!.refB), g.end);
    expect(dim.angular!.links?.length ?? 0).toBeGreaterThan(0);
    for (const [, tip] of dim.angular!.links!) {
      expect(Math.hypot(tip.x - g.start.x, tip.y - g.start.y) < 1e-6 || Math.hypot(tip.x - g.end.x, tip.y - g.end.y) < 1e-6).toBe(true);
    }
  });

  it('referências que não se encontram no trecho ainda criam a cota', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 1, y: 0 }, b: { x: 4, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 5 }, b: { x: 0, y: 9 } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 2.5, 0.01);
    clickAt(tool, 0.01, 7);
    clickAt(tool, 1, 1);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    const g = angularDimensionGeometry(dims[0]!)!;
    expectOnLine(wallLine(store.project, dims[0]!.angular!.refA), g.start);
    expectOnLine(wallLine(store.project, dims[0]!.angular!.refB), g.end);
  });

  it.each([
    { side: 'interno', cursorAngle: 195 * deg },
    { side: 'externo', cursorAngle: 15 * deg },
  ])('faces em 30° continuam sobre as retas depois que a parede se move ($side)', ({ cursorAngle }) => {
    const store = new ProjectStore(createEmptyProject());
    const angle = 30 * deg;
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -4, y: 0 }, b: { x: 4, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -4 * Math.cos(angle), y: -4 * Math.sin(angle) }, b: { x: 4 * Math.cos(angle), y: 4 * Math.sin(angle) } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    const fa = frameOfWall(store.project, 'wa')!;
    const fb = frameOfWall(store.project, 'wb')!;
    const pickA = pointAt(fa, 2, fa.sHi);
    const pickB = pointAt(fb, 2, fb.sHi);
    clickAt(tool, pickA.x, pickA.y);
    clickAt(tool, pickB.x, pickB.y);
    clickAt(tool, Math.cos(cursorAngle) * 2, Math.sin(cursorAngle) * 2);
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    const w2 = store.project.elements['wb'] as Wall;
    const moved: Project = { ...store.project, elements: { ...store.project.elements, wb: { ...w2, a: { x: -4 * Math.cos(angle) + 1, y: -4 * Math.sin(angle) }, b: { x: 4 * Math.cos(angle) + 1, y: 4 * Math.sin(angle) } } } };
    const resolved = resolveAngularDimension(moved, 'lv_0', dim);
    const g = angularDimensionGeometry(resolved)!;
    expectOnLine(wallLine(moved, resolved.angular!.refA), g.start);
    expectOnLine(wallLine(moved, resolved.angular!.refB), g.end);
  });

  it('marcas nas pontas são "/" a 45° da linha de referência, centradas na ponta', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 0, y: 4 } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 2, 0.01);
    clickAt(tool, 0.01, 2);
    clickAt(tool, 1, 1);
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    const g = angularDimensionGeometry(dim)!;
    const [startTick, endTick] = g.ticks;
    const dirOf = ([p, q]: [Vec2Like, Vec2Like]) => ({ x: (q.x - p.x) / Math.hypot(q.x - p.x, q.y - p.y), y: (q.y - p.y) / Math.hypot(q.x - p.x, q.y - p.y) });
    const cosStart = Math.abs(dirOf(startTick).x * dim.angular!.from.x + dirOf(startTick).y * dim.angular!.from.y);
    const cosEnd = Math.abs(dirOf(endTick).x * dim.angular!.to.x + dirOf(endTick).y * dim.angular!.to.y);
    expect(cosStart).toBeCloseTo(Math.SQRT1_2, 3);
    expect(cosEnd).toBeCloseTo(Math.SQRT1_2, 3);
    const mid = { x: (startTick[0].x + startTick[1].x) / 2, y: (startTick[0].y + startTick[1].y) / 2 };
    expect(Math.hypot(mid.x - g.start.x, mid.y - g.start.y)).toBeLessThan(1e-9);
  });

  it('grades: pontas sobre as retas das grades', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addGrid', grid: { id: 'g1', name: '1', typeId: 'gt_6mm', points: [{ x: 1, y: 0 }, { x: 6, y: 0 }], sag: 0, bubbleStart: true, bubbleEnd: true } });
    store.exec({ type: 'addGrid', grid: { id: 'g2', name: '2', typeId: 'gt_6mm', points: [{ x: 0, y: 1 }, { x: 0, y: 6 }], sag: 0, bubbleStart: true, bubbleEnd: true } });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 3, 0.01);
    clickAt(tool, 0.01, 3);
    clickAt(tool, 1, 1);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    const g = angularDimensionGeometry(dims[0]!)!;
    expectOnLine({ p: { x: 0, y: 0 }, d: { x: 1, y: 0 } }, g.start);
    expectOnLine({ p: { x: 0, y: 0 }, d: { x: 0, y: 1 } }, g.end);
  });

  it('lado externo com raio maior que o trecho: arco sobre as retas e linhas de chamada até as pontas', () => {
    const store = new ProjectStore(createEmptyProject());
    const angle = 30 * deg;
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4 * Math.cos(angle), y: 4 * Math.sin(angle) } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    const fa = frameOfWall(store.project, 'wa')!;
    const fb = frameOfWall(store.project, 'wb')!;
    clickAt(tool, pointAt(fa, 2, fa.sLo).x, pointAt(fa, 2, fa.sLo).y);
    clickAt(tool, pointAt(fb, 2, fb.sLo).x, pointAt(fb, 2, fb.sLo).y);
    clickAt(tool, Math.cos(200 * deg) * 6, Math.sin(200 * deg) * 6);
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    expect(dim.angular!.side).toBe('reflex');
    const g = angularDimensionGeometry(dim)!;
    expect(g.arc.length).toBeGreaterThan(2);
    expect(dim.angular!.links).toHaveLength(2);
    expect(g.extensions).toHaveLength(2);
    expectOnLine(wallLine(store.project, dim.angular!.refA), g.start);
    expectOnLine(wallLine(store.project, dim.angular!.refB), g.end);
  });
});
