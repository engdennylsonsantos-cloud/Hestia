import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import { roomRegionAt } from '@hestia/engine';
import { roomsForEnclosedCircuits } from './roomCreate.ts';

const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));

function rectWalls(locationLine: 'finishInterior' | 'wallCenter' = 'finishInterior'): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts = ring([[0, 0], [0, 5], [4, 5], [4, 0]]);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine }) });
  });
  return s;
}

describe('ambientes em todos os circuitos (fonte única)', () => {
  it('cria ambiente com paredes na face interna (antes não criava)', () => {
    const s = rectWalls('finishInterior');
    const rooms = roomsForEnclosedCircuits(s.project, 'lv_0');
    expect(rooms).toHaveLength(1);
    expect(roomRegionAt(s.project, 'lv_0', rooms[0]!.point).polygon).not.toBeNull();
  });

  it('com separador no meio cria um ambiente de cada lado', () => {
    const s = rectWalls();
    s.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 'sep', a: { x: 0, y: 2.5 }, b: { x: 4, y: 2.5 } } });
    const rooms = roomsForEnclosedCircuits(s.project, 'lv_0');
    expect(rooms).toHaveLength(2);
    for (const r of rooms) expect(roomRegionAt(s.project, 'lv_0', r.point).polygon).not.toBeNull();
  });

  it('com pilar interno o ambiente nasce dentro do circuito, não no pilar', () => {
    const s = rectWalls();
    const pil = ring([[1.8, 2.3], [1.8, 2.7], [2.2, 2.7], [2.2, 2.3]]);
    pil.forEach((a, i) => {
      const b = pil[(i + 1) % pil.length]!;
      s.exec({ type: 'addWall', wall: makeWall({ id: `p${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
    });
    const rooms = roomsForEnclosedCircuits(s.project, 'lv_0');
    expect(rooms).toHaveLength(1);
    expect(roomRegionAt(s.project, 'lv_0', rooms[0]!.point).polygon).not.toBeNull();
  });
});
