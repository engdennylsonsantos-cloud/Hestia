import { describe, expect, it } from 'vitest';
import { changesWallEnds, openingOffsetAfterEnds, wallEndsPatchOf } from './hostedOffset.ts';
import { makeWall } from './wall.ts';
import type { Wall } from './types.ts';

function wall(over: Partial<Wall> = {}): Wall {
  return { ...makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 8, y: 0 } }), order: 0, ...over };
}

describe('openingOffsetAfterEnds', () => {
  it('sem mudança de pontas mantém o offset', () => {
    expect(openingOffsetAfterEnds(wall(), 2, {})).toBe(2);
    expect(openingOffsetAfterEnds(wall(), 2, { a: { x: 0, y: 0 }, b: { x: 8, y: 0 } })).toBe(2);
  });

  it('só b mudou mantém a distância à ponta a', () => {
    expect(openingOffsetAfterEnds(wall(), 2, { b: { x: 10, y: 0 } })).toBe(2);
    expect(openingOffsetAfterEnds(wall(), 2, { b: { x: 6, y: 0 } })).toBe(2);
  });

  it('só a mudou acompanha o comprimento para preservar a distância a b', () => {
    expect(openingOffsetAfterEnds(wall(), 2, { a: { x: -2, y: 0 } })).toBeCloseTo(4, 9);
    expect(openingOffsetAfterEnds(wall(), 2, { a: { x: 1, y: 0 } })).toBeCloseTo(1, 9);
  });

  it('as duas pontas na mesma direção preservam a posição projetada', () => {
    expect(openingOffsetAfterEnds(wall(), 2, { a: { x: -2, y: 0 }, b: { x: 10, y: 0 } })).toBeCloseTo(4, 9);
  });

  it('as duas pontas com direção diferente acompanham o giro (offset fica)', () => {
    expect(openingOffsetAfterEnds(wall(), 2, { a: { x: 1, y: 1 }, b: { x: 4, y: 5 } })).toBe(2);
  });

  it('mudar só a flecha mantém a distância à ponta a', () => {
    expect(openingOffsetAfterEnds(wall(), 2, { sag: 0.5 })).toBe(2);
  });

  it('parede degenerada não tenta compensar', () => {
    expect(openingOffsetAfterEnds(wall({ a: { x: 2, y: 2 }, b: { x: 2, y: 2 } }), 1, { b: { x: 3, y: 2 } })).toBe(1);
  });
});

describe('leitura do patch de parede', () => {
  it('wallEndsPatchOf copia só pontas e flecha', () => {
    expect(wallEndsPatchOf({ height: 3, a: { x: 1, y: 2 }, b: { x: 3, y: 4 }, sag: 0.2 })).toEqual({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 }, sag: 0.2 });
  });

  it('changesWallEnds ignora propriedades que não mexem no eixo', () => {
    expect(changesWallEnds({ height: 3 })).toBe(false);
    expect(changesWallEnds({ a: { x: 1, y: 2 } })).toBe(true);
    expect(changesWallEnds({ sag: 0 })).toBe(true);
  });
});
