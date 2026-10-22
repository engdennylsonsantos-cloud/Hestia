import { describe, expect, it } from 'vitest';
import { makeRoom, roomsOnLevel, type Project } from '@hestia/model';
import { interiorPoint, nextRoomNumber, roomDraft, roomsForEnclosedCircuits } from './roomCreate.ts';
import { roomRegionAt } from '@hestia/engine';
import { makeEnv, drawWall } from './testEnv.ts';

const square = [[
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
]];

/** Retângulo de paredes 4 × 3 (eixo) mais uma divisória em x = 2: dois circuitos fechados. */
function twoRooms(): Project {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  drawWall(ctx.env, [4, 0], [4, 3]);
  drawWall(ctx.env, [4, 3], [0, 3]);
  drawWall(ctx.env, [0, 3], [0, 0]);
  drawWall(ctx.env, [2, 0], [2, 3]);
  return ctx.store.project;
}

describe('numeração e ponto interior', () => {
  it('nextRoomNumber: 1 sem ambientes, pula números já usados no nível', () => {
    const p = twoRooms();
    expect(nextRoomNumber(p, 'lv_0')).toBe(1);
    const r = roomDraft(p, 'lv_0', { x: 1, y: 1 });
    expect(r.name).toBe('Ambiente 1');
    expect(r.number).toBe('1');
    const withTwo: Project = { ...p, elements: { ...p.elements, x2: { ...makeRoom({ id: 'x2', levelId: 'lv_0', name: 'X', number: '2', point: { x: 1, y: 1 } }), order: 0 } } };
    expect(nextRoomNumber(withTwo, 'lv_0')).toBe(3);
  });

  it('interiorPoint: o centro de um quadrado está dentro; polígono degenerado devolve null', () => {
    const at = interiorPoint(square);
    expect(at).toEqual({ x: 2, y: 1.5 });
    expect(interiorPoint([[{ x: 0, y: 0 }, { x: 1, y: 0 }]])).toBeNull();
  });
});

describe('ambientes em todos os circuitos fechados', () => {
  it('cria um ambiente por circuito, com números sequenciais, e não repete nos já cobertos', () => {
    const p = twoRooms();
    const rooms = roomsForEnclosedCircuits(p, 'lv_0');
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => r.number)).toEqual(['1', '2']);
    expect(rooms.every((r) => roomRegionAt(p, 'lv_0', r.point).polygon !== null)).toBe(true);
    // Depois de gravados, nada mais a criar.
    const next: Project = { ...p, elements: { ...p.elements } };
    for (const r of rooms) next.elements[r.id] = { ...r, order: 0 };
    expect(roomsForEnclosedCircuits(next, 'lv_0')).toHaveLength(0);
    expect(roomsOnLevel(next, 'lv_0')).toHaveLength(2);
  });

  it('sem paredes não cria nada', () => {
    const p = makeEnv().store.project;
    expect(roomsForEnclosedCircuits(p, 'lv_0')).toEqual([]);
  });
});
