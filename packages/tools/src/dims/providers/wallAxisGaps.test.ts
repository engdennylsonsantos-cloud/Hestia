import { describe, expect, it } from 'vitest';
import { frameOfWall } from '@hestia/engine';
import { createEmptyProject, makeWall, ProjectStore } from '@hestia/model';
import { axisGaps } from './wallAxisGaps.ts';

function projeto(paredes: Array<[string, [number, number], [number, number]]>, sag = 0) {
  const s = new ProjectStore(createEmptyProject());
  for (const [id, a, b] of paredes) {
    s.exec({ type: 'addWall', wall: { ...makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } }), sag } });
  }
  return s.project;
}

describe('axisGaps', () => {
  it('devolve uma lacuna por ponta, a mais próxima, com o plano voltado para a parede', () => {
    const p = projeto([['h', [0, 0], [4, 0]], ['p', [5, -2], [5, 2]], ['q', [-2, -2], [-2, 2]]]);
    const gaps = axisGaps(p, frameOfWall(p, 'h')!, 'finish');
    expect(gaps.map((g) => g.end).sort()).toEqual(['a', 'b']);
    const b = gaps.find((g) => g.end === 'b')!;
    expect(b.ownerId).toBe('p');
    expect(b.distance).toBeCloseTo(0.908, 9);
    expect(b.targetT).toBeCloseTo(4.908, 9);
    const a = gaps.find((g) => g.end === 'a')!;
    expect(a.targetT).toBeCloseTo(-1.908, 9);
    expect(a.distance).toBeCloseTo(1.908, 9);
  });

  it('ignora paralelas, encostadas na ponta, inclinadas e de outro nível; parede curva não tem lacuna', () => {
    const p = projeto([['h', [0, 0], [4, 0]], ['par', [0, 2], [4, 2]], ['enc', [4, -1], [4, 1]], ['obl', [6, -2], [7, 2]]]);
    expect(axisGaps(p, frameOfWall(p, 'h')!, 'finish')).toEqual([]);
    const curva = projeto([['h', [0, 0], [4, 0]], ['p', [5, -2], [5, 2]]], 0.5);
    expect(axisGaps(curva, frameOfWall(curva, 'h')!, 'finish')).toEqual([]);
  });
});
