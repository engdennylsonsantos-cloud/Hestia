import { describe, expect, it } from 'vitest';
import { multiArea, polygonArea } from '@hestia/geom';
import { totalThickness } from '@hestia/model';
import { enclosedRegionAt, enclosedRooms } from './enclosed.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Quatro paredes de um retângulo 4 × 3 (eixo nas bordas), com a espessura do tipo padrão. */
function rectRoom() {
  const ctx = makeEnv();
  ctx.options.wallShape = 'rect';
  const w = tool('wall', ctx.env);
  clickAt(w, 0, 0);
  clickAt(w, 4, 3);
  const t = totalThickness(ctx.store.project.wallTypes[ctx.options.wallTypeId]!);
  return { ...ctx, t };
}

describe('região fechada pelas paredes (A3)', () => {
  it('retângulo de paredes: uma área, com a face interna das paredes', () => {
    const { store, t } = rectRoom();
    const rooms = enclosedRooms(store.project, 'lv_0');
    expect(rooms).toHaveLength(1);
    expect(multiArea(rooms)).toBeCloseTo((4 - t) * (3 - t), 6);
    expect(rooms[0]!).toHaveLength(1);
  });

  it('o ponto dentro da sala devolve o espaço; o ponto de fora devolve null', () => {
    const { store } = rectRoom();
    expect(enclosedRegionAt(store.project, 'lv_0', { x: 2, y: 1.5 })).not.toBeNull();
    expect(enclosedRegionAt(store.project, 'lv_0', { x: -1, y: 1.5 })).toBeNull();
    expect(enclosedRegionAt(store.project, 'lv_0', { x: 2, y: 9 })).toBeNull();
  });

  it('uma porta na parede não abre a sala (a silhueta ignora os vãos)', () => {
    const { store, env, t } = rectRoom();
    const d = tool('door', env);
    clickAt(d, 2, 0);
    const rooms = enclosedRooms(store.project, 'lv_0');
    expect(rooms).toHaveLength(1);
    expect(multiArea(rooms)).toBeCloseTo((4 - t) * (3 - t), 6);
  });

  it('parede solta dentro da sala vira furo do espaço', () => {
    const { store, env, options, t } = rectRoom();
    options.wallShape = 'line';
    const w = tool('wall', env);
    clickAt(w, 1, 1.5);
    clickAt(w, 3, 1.5);
    w.cancel();
    const rooms = enclosedRooms(store.project, 'lv_0');
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!).toHaveLength(2);
    expect(multiArea(rooms)).toBeCloseTo((4 - t) * (3 - t) - 2 * t, 3);
  });

  it('parede que divide a sala em duas: cada lado é um espaço', () => {
    const { store, env, options, t } = rectRoom();
    options.wallShape = 'line';
    const w = tool('wall', env);
    clickAt(w, 2, 0);
    clickAt(w, 2, 3);
    w.cancel();
    const rooms = enclosedRooms(store.project, 'lv_0');
    expect(rooms).toHaveLength(2);
    const areas = rooms.map((r) => polygonArea(r)).sort((a, b) => a - b);
    // Cada metade vai da face interna da parede do contorno à face do divisor: (2 − t) × (3 − t).
    expect(areas[0]).toBeCloseTo((2 - t) * (3 - t), 6);
    expect(areas[1]).toBeCloseTo((2 - t) * (3 - t), 6);
  });

  it('contorno aberto (sem uma parede) não fecha área: o ponto cai no exterior', () => {
    const ctx = makeEnv();
    const w = tool('wall', ctx.env);
    clickAt(w, 0, 0);
    clickAt(w, 4, 0);
    clickAt(w, 4, 3);
    clickAt(w, 0, 3);
    w.cancel();
    expect(enclosedRegionAt(ctx.store.project, 'lv_0', { x: 2, y: 1.5 })).toBeNull();
  });

  it('nível sem paredes não tem região', () => {
    const { store } = makeEnv();
    expect(enclosedRooms(store.project, 'lv_1')).toEqual([]);
  });
});
