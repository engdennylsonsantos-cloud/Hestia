import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeCeiling, makeRoom, makeWall, ceilingsOnLevel } from '@hestia/model';
import { ceilingsForAllRooms } from './ceilingRoom.ts';

/** Paredes de um retângulo 4 × 5 m, em volta de dois ambientes (esquerdo e direito) separados por uma parede no meio. */
function twoRooms(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 0 }];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'wm', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 5 }, locationLine: 'finishInterior' }) });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r2', levelId: 'lv_0', name: 'Quarto', number: '102', point: { x: 6, y: 2.5 } }) });
  return s;
}

describe('ceilingsForAllRooms (E6: forro em todos os ambientes do nível)', () => {
  it('um lote com um forro por ambiente, num só comando', () => {
    const s = twoRooms();
    const cmd = ceilingsForAllRooms(s.project, 'lv_0', 'ct_gesso');
    expect(cmd?.type).toBe('addCeilings');
    expect(cmd?.ceilings.map((c) => c.roomId).sort()).toEqual(['r1', 'r2']);
    expect(cmd?.ceilings.every((c) => c.typeId === 'ct_gesso')).toBe(true);
    s.exec(cmd!);
    expect(ceilingsOnLevel(s.project, 'lv_0')).toHaveLength(2);
    s.undo();
    expect(ceilingsOnLevel(s.project, 'lv_0')).toHaveLength(0);
  });

  it('ambiente que já tem forro no nível fica de fora', () => {
    const s = twoRooms();
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', roomId: 'r1', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 5 }, { x: 0, y: 5 }] }) });
    const cmd = ceilingsForAllRooms(s.project, 'lv_0', 'ct_gesso');
    expect(cmd?.ceilings.map((c) => c.roomId)).toEqual(['r2']);
  });

  it('nada a criar devolve null; tipo preferido ausente cai no primeiro tipo do projeto', () => {
    const s = twoRooms();
    expect(ceilingsForAllRooms(s.project, 'lv_1', 'ct_gesso')).toBeNull();
    const cmd = ceilingsForAllRooms(s.project, 'lv_0', 'nao_existe');
    expect(cmd?.ceilings[0]?.typeId).toBe(Object.keys(s.project.ceilingTypes)[0]);
  });
});
