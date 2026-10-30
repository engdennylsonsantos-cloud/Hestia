import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, levelDimensions, type Wall } from '@hestia/model';
import { resolveAngularDimension } from '@hestia/engine';
import { makeEnv, P } from './testEnv.ts';
import { createTool } from './registry.ts';

const clickAt = (tool: ReturnType<typeof createTool>, x: number, y: number): void => {
  tool.move(P(x, y));
  tool.click(P(x, y));
};

describe('Cota angular', () => {
  it('mede o encontro de duas faces e grava sem mover paredes', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -3, y: 0 }, b: { x: 3, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: -3 }, b: { x: 0, y: 3 } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0.01);
    clickAt(tool, 0.01, 1.2);
    clickAt(tool, 1, 1);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    expect(dims[0]!.angular).toBeDefined();
    expect(dims[0]!.angular!.value).toBeCloseTo(Math.PI / 2, 2);
    expect(store.project.elements['w1']).toBeDefined();
    expect(store.project.elements['w2']).toBeDefined();
  });

  it('recalcula a geometria quando a parede de referência se move', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -3, y: 0 }, b: { x: 3, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: -3 }, b: { x: 0, y: 3 } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0.01);
    clickAt(tool, 0.01, 1.2);
    clickAt(tool, 1, 1);
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    expect(dim.angular?.refA).toContain('w1');
    const w2 = store.project.elements['w2'] as Wall;
    const moved = { ...store.project, elements: { ...store.project.elements, w2: { ...w2, a: { x: 1, y: -3 }, b: { x: 1, y: 3 } } } };
    const resolved = resolveAngularDimension(moved, 'lv_0', dim);
    expect(resolved.angular!.center.x).toBeGreaterThan(0.9);
    expect(resolved.angular!.center.x).toBeLessThan(1.2);
  });

  it('recusa referências paralelas e não cria cota', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -3, y: 0 }, b: { x: 3, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -3, y: 2 }, b: { x: 3, y: 2 } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0.01);
    clickAt(tool, 1.2, 2.01);
    expect(levelDimensions(store.project, 'lv_0')).toHaveLength(0);
  });
});
