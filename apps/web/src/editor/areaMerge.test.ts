import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { createEmptyProject, makeRoom, makeWall, ProjectStore } from '@hestia/model';
import { areaMergePreview, removesCircuit, roomsToRemove } from './areaMerge.ts';

/** Duas salas de 3 × 5 e 5 × 5 separadas por uma parede interna. */
function duasSalas(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const paredes: Array<[string, Vec2, Vec2]> = [
    ['w0', { x: 0, y: 0 }, { x: 8, y: 0 }],
    ['w1', { x: 8, y: 0 }, { x: 8, y: 5 }],
    ['w2', { x: 8, y: 5 }, { x: 0, y: 5 }],
    ['w3', { x: 0, y: 5 }, { x: 0, y: 0 }],
    ['wmid', { x: 3, y: 0 }, { x: 3, y: 5 }],
  ];
  for (const [id, a, b] of paredes) s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Depósito', number: '101', point: { x: 1.5, y: 2.5 } }) });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r2', levelId: 'lv_0', name: 'Sala', number: '102', point: { x: 5.5, y: 2.5 } }) });
  return s;
}

describe('regra de fusão de áreas', () => {
  it('parede interna: mantém a maior e apaga a menor', () => {
    const s = duasSalas();
    const preview = areaMergePreview(s.project, 'lv_0', [{ type: 'deleteElements', ids: ['wmid'] }], true);
    expect(preview).not.toBeNull();
    expect(preview!.keep.map((r) => r.id)).toEqual(['r2']);
    expect(roomsToRemove(preview!)).toEqual(['r1']);
    expect(preview!.mergedArea).toBeGreaterThan(35);
    expect(preview!.message).toContain('Depósito');
    expect(preview!.message).toContain('Sala');
  });

  it('separador também funde e mantém a maior', () => {
    const s = new ProjectStore(createEmptyProject());
    for (const [id, a, b] of [
      ['w0', { x: 0, y: 0 }, { x: 8, y: 0 }],
      ['w1', { x: 8, y: 0 }, { x: 8, y: 5 }],
      ['w2', { x: 8, y: 5 }, { x: 0, y: 5 }],
      ['w3', { x: 0, y: 5 }, { x: 0, y: 0 }],
    ] as Array<[string, Vec2, Vec2]>) s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
    s.exec({ type: 'addRoomSeparator', levelId: 'lv_0', separator: { id: 'sep', a: { x: 3, y: 0 }, b: { x: 3, y: 5 } } });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Depósito', number: '101', point: { x: 1.5, y: 2.5 } }) });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r2', levelId: 'lv_0', name: 'Sala', number: '102', point: { x: 5.5, y: 2.5 } }) });
    const preview = areaMergePreview(s.project, 'lv_0', [{ type: 'removeRoomSeparator', levelId: 'lv_0', id: 'sep' }], true);
    expect(preview?.keep[0]?.id).toBe('r2');
    expect(roomsToRemove(preview!)).toEqual(['r1']);
    expect(removesCircuit(s.project, 'lv_0', ['sep'])).toBe(true);
  });

  it('sem fusão devolve null', () => {
    const s = duasSalas();
    const preview = areaMergePreview(s.project, 'lv_0', [{ type: 'deleteElements', ids: ['w1'] }], true);
    expect(preview).toBeNull();
  });
});
