import { describe, expect, it } from 'vitest';
import { frameOfWall } from '@hestia/engine';
import { createEmptyProject, makeWall, ProjectStore } from '@hestia/model';
import { wallLateralGaps } from './wallLateral.ts';

function cena(refs: Array<[string, [number, number], [number, number]]>) {
  const s = new ProjectStore(createEmptyProject());
  for (const [id, a, b] of refs) s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } }) });
  return s.project;
}

describe('vãos laterais da parede', () => {
  it('eixo a eixo e face a face na mesma cena', () => {
    const p = cena([['h', [0, 0], [4, 0]], ['v', [0, 3], [4, 3]]]);
    const f = frameOfWall(p, 'h')!;
    expect(wallLateralGaps(p, f, 'axis')[0]!.distance).toBeCloseTo(3, 9);
    expect(wallLateralGaps(p, f, 'finish')[0]!.distance).toBeCloseTo(3 - 0.184, 9);
  });

  it('perpendicular não gera vão lateral', () => {
    const p = cena([['h', [0, 0], [4, 0]], ['p', [2, 1], [2, 4]]]);
    expect(wallLateralGaps(p, frameOfWall(p, 'h')!, 'axis')).toEqual([]);
  });
});
