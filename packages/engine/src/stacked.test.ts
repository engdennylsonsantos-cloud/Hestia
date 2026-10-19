import { describe, expect, it } from 'vitest';
import { multiArea, union } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import { quantifyLevel, resolveLevel } from './index.ts';

const area = (s: ProjectStore, lv: string): number => multiArea(union(...resolveLevel(s.project, lv).clusters.map((c) => c.silhouette)));

describe('C15 · parede empilhada sobre outra (níveis diferentes)', () => {
  const store = (): ProjectStore => {
    const s = new ProjectStore(createEmptyProject());
    for (const lv of ['lv_0', 'lv_1']) {
      s.exec({ type: 'addWall', wall: makeWall({ id: `a${lv}`, typeId: 'wt_alv14', levelId: lv, a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
      s.exec({ type: 'addWall', wall: makeWall({ id: `b${lv}`, typeId: 'wt_alv14', levelId: lv, a: { x: 4, y: 0 }, b: { x: 4, y: 3 }, height: 3 }) });
    }
    return s;
  };

  it('cada nível resolve sozinho: a parede de cima não corta nem soma à de baixo', () => {
    const s = store();
    expect(area(s, 'lv_0')).toBeCloseTo(area(s, 'lv_1'), 9);
    const single = new ProjectStore(createEmptyProject());
    single.exec({ type: 'addWall', wall: makeWall({ id: 'x', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
    single.exec({ type: 'addWall', wall: makeWall({ id: 'y', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 3 }, height: 3 }) });
    expect(area(s, 'lv_0')).toBeCloseTo(area(single, 'lv_0'), 9);
  });

  it('a base da parede de cima fica na cota do nível e o volume total é o dobro', () => {
    const s = store();
    const up = resolveLevel(s.project, 'lv_1');
    expect(Object.values(up.walls).every((w) => Math.abs(w.baseZ - 3) < 1e-9)).toBe(true);
    const v0 = quantifyLevel(s.project, resolveLevel(s.project, 'lv_0')).walls.reduce((t, w) => t + w.volume, 0);
    const v1 = quantifyLevel(s.project, up).walls.reduce((t, w) => t + w.volume, 0);
    expect(v1).toBeCloseTo(v0, 9);
  });
});
