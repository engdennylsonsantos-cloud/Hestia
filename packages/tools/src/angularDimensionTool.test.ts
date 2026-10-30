import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, levelDimensions, angularDimensionGeometry, type Wall } from '@hestia/model';
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

  const deg = Math.PI / 180;
  const crossing = () => {
    const store = new ProjectStore(createEmptyProject());
    const c = Math.cos(72.7 * deg);
    const s = Math.sin(72.7 * deg);
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -3, y: 0 }, b: { x: 3, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -3 * c, y: -3 * s }, b: { x: 3 * c, y: 3 * s } }) });
    const made = makeEnv(store);
    made.options.alignPrefer = 'eixos';
    return made;
  };

  it('escolhe o lado pelo cursor: interno = menor, externo = maior, sem seletor', () => {
    const { store, env } = crossing();
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0);
    clickAt(tool, 1.2 * Math.cos(72.7 * deg), 1.2 * Math.sin(72.7 * deg));
    // Cursor fora do setor de 72,7°: o lado externo é o maior (107,3°).
    clickAt(tool, 0, 1.5);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    const a = dims[0]!.angular!;
    expect(a.side).toBe('major');
    expect(a.value).toBeCloseTo(107.3 * deg, 4);
    const g = angularDimensionGeometry(dims[0]!)!;
    expect(g.value).toBeCloseTo(107.3 * deg, 4);
    expect(store.project.elements['w1']).toBeDefined();
    expect(store.project.elements['w2']).toBeDefined();
  });

  it('mantém o arco alinhado às linhas mesmo quando a referência se move', () => {
    const { store, env } = crossing();
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0);
    clickAt(tool, 1.2 * Math.cos(72.7 * deg), 1.2 * Math.sin(72.7 * deg));
    clickAt(tool, 1.2, 1.2);
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    const w2 = store.project.elements['w2'] as Wall;
    const moved = { ...store.project, elements: { ...store.project.elements, w2: { ...w2, a: { x: -3 * Math.cos(60 * deg), y: -3 * Math.sin(60 * deg) }, b: { x: 3 * Math.cos(60 * deg), y: 3 * Math.sin(60 * deg) } } } };
    const resolved = resolveAngularDimension(moved, 'lv_0', dim);
    expect(resolved.angular!.side).toBe('minor');
    expect(angularDimensionGeometry(resolved)!.value).toBeCloseTo(resolved.angular!.value, 6);
  });

  it('aceita grades como referências de linha', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addGrid', grid: { id: 'g1', name: '1', typeId: 'gt_6mm', points: [{ x: -3, y: 0 }, { x: 3, y: 0 }], sag: 0, bubbleStart: true, bubbleEnd: true } });
    store.exec({ type: 'addGrid', grid: { id: 'g2', name: '2', typeId: 'gt_6mm', points: [{ x: 0, y: -3 }, { x: 0, y: 3 }], sag: 0, bubbleStart: true, bubbleEnd: true } });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0);
    clickAt(tool, 0, 1.2);
    clickAt(tool, 1, 1);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    expect(dims[0]!.angular!.refA).toContain(':grade:');
    expect(dims[0]!.angular!.refB).toContain(':grade:');
    expect(dims[0]!.angular!.value).toBeCloseTo(Math.PI / 2, 3);
  });

  it('Tab e o cursor continuam funcionando no modo automático', () => {
    const { store, env } = crossing();
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0);
    tool.move(P(1.2 * Math.cos(72.7 * deg), 1.2 * Math.sin(72.7 * deg)));
    tool.tab();
    clickAt(tool, 1.2 * Math.cos(72.7 * deg), 1.2 * Math.sin(72.7 * deg));
    clickAt(tool, 0.3, 0.2);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    expect(dims[0]!.angular!.side).toBe('minor');
    expect(dims[0]!.angular!.value).toBeCloseTo(72.7 * deg, 4);
  });
});
