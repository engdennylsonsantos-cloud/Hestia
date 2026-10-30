import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, levelDimensions, angularDimensionGeometry, type Wall } from '@hestia/model';
import { frameOfWall, pointAt, resolveAngularDimension, tangentAt } from '@hestia/engine';
import { makeEnv, P } from './testEnv.ts';
import { createTool } from './registry.ts';

const clickAt = (tool: ReturnType<typeof createTool>, x: number, y: number): void => {
  tool.move(P(x, y));
  tool.click(P(x, y));
};

function expectOnWallReference(project: ReturnType<typeof createEmptyProject>, key: string, point: { x: number; y: number }): void {
  const separator = key.indexOf(':');
  const wallId = key.slice(0, separator);
  const ref = key.slice(separator + 1);
  const frame = frameOfWall(project, wallId!);
  expect(frame).toBeDefined();
  const s = ref === 'face:hi' ? frame!.sHi : ref === 'face:lo' ? frame!.sLo : 0;
  const origin = pointAt(frame!, frame!.length / 2, s);
  const direction = tangentAt(frame!, frame!.length / 2);
  const delta = { x: point.x - origin.x, y: point.y - origin.y };
  expect(delta.x * direction.y - delta.y * direction.x).toBeCloseTo(0, 7);
}

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
    const geometry = angularDimensionGeometry(resolved)!;
    expectOnWallReference(moved, dim.angular!.refA, geometry.start);
    expectOnWallReference(moved, dim.angular!.refB, geometry.end);
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

  it('escolhe o lado pelo cursor: interno = menor, externo = volta >180°, sem seletor', () => {
    const { store, env } = crossing();
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0);
    clickAt(tool, 1.2 * Math.cos(72.7 * deg), 1.2 * Math.sin(72.7 * deg));
    // Cursor fora do setor de 72,7°: a volta externa complementa o ângulo menor.
    clickAt(tool, 0, 1.5);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    const a = dims[0]!.angular!;
    expect(a.side).toBe('reflex');
    expect(a.base ?? 'minor').toBe('minor');
    expect(a.value).toBeCloseTo(287.3 * deg, 4);
    const g = angularDimensionGeometry(dims[0]!)!;
    expect(g.value).toBeGreaterThan(Math.PI);
    expect(g.value).toBeCloseTo(287.3 * deg, 4);
    // As pontas do arco ficam sobre os dois eixos selecionados.
    const u = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
    expect(u({ x: g.start.x - g.center.x, y: g.start.y - g.center.y })).toBeCloseTo(a.radius, 6);
    expect(u({ x: g.end.x - g.center.x, y: g.end.y - g.center.y })).toBeCloseTo(a.radius, 6);
    const cross = (v: { x: number; y: number }, axis: { x: number; y: number }) => v.x * axis.y - v.y * axis.x;
    expect(cross({ x: g.start.x - g.center.x, y: g.start.y - g.center.y }, a.from)).toBeCloseTo(0, 7);
    expect(cross({ x: g.end.x - g.center.x, y: g.end.y - g.center.y }, a.to)).toBeCloseTo(0, 7);
    expect(store.project.elements['w1']).toBeDefined();
    expect(store.project.elements['w2']).toBeDefined();
  });

  it('mede o exterior como 330° quando o ângulo interno é 30°', () => {
    const store = new ProjectStore(createEmptyProject());
    const radians = 30 * deg;
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -3, y: 0 }, b: { x: 3, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: -3 * Math.cos(radians), y: -3 * Math.sin(radians) }, b: { x: 3 * Math.cos(radians), y: 3 * Math.sin(radians) } }) });
    const { env, options } = makeEnv(store);
    options.alignPrefer = 'eixos';
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 1.2, 0);
    clickAt(tool, 1.2 * Math.cos(radians), 1.2 * Math.sin(radians));
    clickAt(tool, 0, -1.5);
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    expect(dim.angular!.value / deg).toBeCloseTo(330, 4);
    expect(angularDimensionGeometry(dim)!.value / deg).toBeCloseTo(330, 4);
  });

  it.each([
    { side: 'interno', cursorAngle: 195 * deg, expectedSide: 'minor' as const },
    { side: 'externo', cursorAngle: 15 * deg, expectedSide: 'reflex' as const },
  ])('mantém as pontas do arco $side sobre as duas faces clicadas', ({ cursorAngle, expectedSide }) => {
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
    clickAt(tool, 2 * Math.cos(cursorAngle), 2 * Math.sin(cursorAngle));
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    expect(dim.angular!.refA).toContain(':face:');
    expect(dim.angular!.refB).toContain(':face:');
    const resolved = resolveAngularDimension(store.project, 'lv_0', dim);
    const geometry = angularDimensionGeometry(resolved)!;
    expectOnWallReference(store.project, dim.angular!.refA, geometry.start);
    expectOnWallReference(store.project, dim.angular!.refB, geometry.end);
    expect(geometry.extensions).toHaveLength(0);
    expect(dim.angular!.side).toBe(expectedSide);
    const towardA = { x: pickA.x - geometry.center.x, y: pickA.y - geometry.center.y };
    const towardB = { x: pickB.x - geometry.center.x, y: pickB.y - geometry.center.y };
    expect((geometry.start.x - geometry.center.x) * towardA.x + (geometry.start.y - geometry.center.y) * towardA.y).toBeGreaterThan(0);
    expect((geometry.end.x - geometry.center.x) * towardB.x + (geometry.end.y - geometry.center.y) * towardB.y).toBeGreaterThan(0);
  });

  it('usa as faces escolhidas no encontro de paredes conectadas pelas extremidades', () => {
    const store = new ProjectStore(createEmptyProject());
    const angle = 30 * deg;
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 0, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4 * Math.cos(angle), y: 4 * Math.sin(angle) } }) });
    const { env } = makeEnv(store);
    const fa = frameOfWall(store.project, 'wa')!;
    const fb = frameOfWall(store.project, 'wb')!;
    // Uma face externa e uma interna: cada ponto fica a 1 m do encontro, no trecho visível da face.
    const pickA = pointAt(fa, fa.length - 1, fa.sHi);
    const pickB = pointAt(fb, 1, fb.sLo);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, pickA.x, pickA.y);
    clickAt(tool, pickB.x, pickB.y);
    clickAt(tool, -2, -1);
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    const g = angularDimensionGeometry(resolveAngularDimension(store.project, 'lv_0', dim))!;
    expect(dim.angular!.refA).toBe('wa:face:hi');
    expect(dim.angular!.refB).toBe('wb:face:lo');
    expectOnWallReference(store.project, dim.angular!.refA, g.start);
    expectOnWallReference(store.project, dim.angular!.refB, g.end);
  });

  it('mantém o arco alinhado quando o clique cai junto do encontro', () => {
    const store = new ProjectStore(createEmptyProject());
    const angle = 30 * deg;
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 0, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4 * Math.cos(angle), y: 4 * Math.sin(angle) } }) });
    const { env } = makeEnv(store);
    const fa = frameOfWall(store.project, 'wa')!;
    const fb = frameOfWall(store.project, 'wb')!;
    const pickA = pointAt(fa, fa.length - 0.02, fa.sHi);
    const pickB = pointAt(fb, 0.02, fb.sHi);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, pickA.x, pickA.y);
    clickAt(tool, pickB.x, pickB.y);
    clickAt(tool, -2, -1);
    const dim = levelDimensions(store.project, 'lv_0')[0]!;
    const g = angularDimensionGeometry(resolveAngularDimension(store.project, 'lv_0', dim))!;
    expectOnWallReference(store.project, dim.angular!.refA, g.start);
    expectOnWallReference(store.project, dim.angular!.refB, g.end);
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
