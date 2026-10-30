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

/** Trecho finito de uma referência de parede (face ou eixo) no projeto atual. */
function wallSegment(project: Project, key: string): [Vec2Like, Vec2Like] {
  const separator = key.indexOf(':');
  const frame = frameOfWall(project, key.slice(0, separator))!;
  const ref = key.slice(separator + 1);
  const s = ref === 'face:hi' ? frame.sHi : ref === 'face:lo' ? frame.sLo : 0;
  return [pointAt(frame, 0, s), pointAt(frame, frame.length, s)];
}

/** Confere que o ponto está sobre o trecho e entre as suas extremidades (não no prolongamento). */
function expectWithinSegment(seg: [Vec2Like, Vec2Like], p: Vec2Like): void {
  const d = { x: seg[1].x - seg[0].x, y: seg[1].y - seg[0].y };
  const l2 = d.x * d.x + d.y * d.y;
  const rel = { x: p.x - seg[0].x, y: p.y - seg[0].y };
  const cross = (rel.x * d.y - rel.y * d.x) / Math.sqrt(l2);
  const t = (rel.x * d.x + rel.y * d.y) / l2;
  expect(Math.abs(cross)).toBeLessThan(1e-6);
  expect(t).toBeGreaterThanOrEqual(-1e-6);
  expect(t).toBeLessThanOrEqual(1 + 1e-6);
}

describe('Cota angular: o arco nunca passa das referências', () => {
  it.each([
    { side: 'interno', cursor: { x: 1, y: 1 } },
    { side: 'externo', cursor: { x: -1, y: -1 } },
  ])('referências curtas que não se encontram: pontas dentro dos trechos ($side)', ({ cursor }) => {
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
    const g = angularDimensionGeometry(dims[0]!)!;
    expectWithinSegment(wallSegment(store.project, dims[0]!.angular!.refA), g.start);
    expectWithinSegment(wallSegment(store.project, dims[0]!.angular!.refB), g.end);
  });

  it('referências sem nenhum raio comum não criam cota', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 1, y: 0 }, b: { x: 4, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 5 }, b: { x: 0, y: 9 } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    clickAt(tool, 2.5, 0.01);
    clickAt(tool, 0.01, 7);
    clickAt(tool, 1, 1);
    expect(levelDimensions(store.project, 'lv_0')).toHaveLength(0);
  });

  it.each([
    { side: 'interno', cursorAngle: 195 * deg },
    { side: 'externo', cursorAngle: 15 * deg },
  ])('faces em 30° continuam dentro dos trechos depois que a parede se move ($side)', ({ cursorAngle }) => {
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
    expectWithinSegment(wallSegment(moved, resolved.angular!.refA), g.start);
    expectWithinSegment(wallSegment(moved, resolved.angular!.refB), g.end);
  });

  it('grades: pontas dentro dos trechos das grades', () => {
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
    expectWithinSegment([{ x: 1, y: 0 }, { x: 6, y: 0 }], g.start);
    expectWithinSegment([{ x: 0, y: 1 }, { x: 0, y: 6 }], g.end);
  });

  it.each([
    { label: 'perto', radius: 1.5 },
    { label: 'longe', radius: 6 },
  ])('lado externo: o arco não entra no corpo das paredes de referência ($label)', ({ radius }) => {
    const store = new ProjectStore(createEmptyProject());
    const angle = 30 * deg;
    // Paredes que começam no encontro (L): o lado externo não passa pelas direções das paredes.
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wa', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wb', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4 * Math.cos(angle), y: 4 * Math.sin(angle) } }) });
    const { env } = makeEnv(store);
    const tool = createTool('angularDimension', env);
    tool.start();
    const fa = frameOfWall(store.project, 'wa')!;
    const fb = frameOfWall(store.project, 'wb')!;
    clickAt(tool, pointAt(fa, 2, fa.sLo).x, pointAt(fa, 2, fa.sLo).y);
    clickAt(tool, pointAt(fb, 2, fb.sLo).x, pointAt(fb, 2, fb.sLo).y);
    clickAt(tool, Math.cos(200 * deg) * radius, Math.sin(200 * deg) * radius);
    const dims = levelDimensions(store.project, 'lv_0');
    expect(dims).toHaveLength(1);
    const g = angularDimensionGeometry(dims[0]!)!;
    expect(dims[0]!.angular!.side).toBe('reflex');
    for (const p of g.arc) {
      expect(insideWallBody(store.project, 'wa', p)).toBe(false);
      expect(insideWallBody(store.project, 'wb', p)).toBe(false);
    }
  });
});

/** Ponto dentro do corpo da parede (entre as faces e entre as extremidades). */
function insideWallBody(project: Project, wallId: string, p: Vec2Like): boolean {
  const f = frameOfWall(project, wallId)!;
  const o = pointAt(f, 0, 0);
  const t = tangentAt(f, f.length / 2);
  const rel = { x: p.x - o.x, y: p.y - o.y };
  const across = Math.abs(rel.x * t.y - rel.y * t.x);
  const along = rel.x * t.x + rel.y * t.y;
  const half = Math.abs(f.sHi - f.sLo) / 2;
  return across < half - 1e-6 && along > 1e-6 && along < f.length - 1e-6;
}
