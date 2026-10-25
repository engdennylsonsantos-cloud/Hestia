import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoom, makeWall } from '@hestia/model';
import { resolveRooms } from './index.ts';

const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));

/** Sala 4 × 5 fechada por paredes (face interna = contorno), com ambientes em `points`. */
function sala(points: Vec2[]): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts = ring([[0, 0], [0, 5], [4, 5], [4, 0]]);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w_${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  });
  points.forEach((point, i) => s.exec({ type: 'addRoom', room: makeRoom({ id: `r${i}`, levelId: 'lv_0', name: 'Sala', number: `10${i}`, point }) }));
  return s;
}

const areas = (s: ProjectStore): number[] => resolveRooms(s.project, 'lv_0').map((r) => r.area).sort((a, b) => a - b);

describe('linha de separação de ambiente (decisão 0031 §3)', () => {
  it('sem linha, a sala tem 20 m²', () => {
    const s = sala([{ x: 2, y: 2.5 }]);
    expect(areas(s)[0]).toBeCloseTo(20, 6);
  });

  it('linha de parede a parede divide a sala em duas de 10 m²', () => {
    const s = sala([{ x: 1, y: 2.5 }, { x: 3, y: 2.5 }]);
    s.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 's1', a: { x: 2, y: -0.5 }, b: { x: 2, y: 5.5 } } });
    const [a, b] = areas(s);
    expect(a).toBeCloseTo(10, 1);
    expect(b).toBeCloseTo(10, 1);
  });

  it('linha que não chega à parede não divide a sala', () => {
    const s = sala([{ x: 1, y: 2.5 }]);
    s.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 's1', a: { x: 2, y: 1 }, b: { x: 2, y: 4 } } });
    expect(areas(s)[0]).toBeCloseTo(20, 6);
  });

  it('remover a linha restaura a sala inteira', () => {
    const s = sala([{ x: 1, y: 2.5 }]);
    s.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 's1', a: { x: 2, y: -0.5 }, b: { x: 2, y: 5.5 } } });
    s.exec({ type: 'removeRoomSeparator', levelId: 'lv_0', id: 's1' });
    expect(areas(s)[0]).toBeCloseTo(20, 6);
  });

  it('linha curta demais é recusada', () => {
    const s = sala([{ x: 1, y: 2.5 }]);
    expect(() => s.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 's1', a: { x: 2, y: 1 }, b: { x: 2, y: 1.01 } } })).toThrow();
  });
});
