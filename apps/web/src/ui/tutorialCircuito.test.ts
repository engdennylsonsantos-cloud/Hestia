import { describe, expect, it } from 'vitest';
import { makeWall, type Wall } from '@hestia/model';
import { temCircuito } from './Tutorial.tsx';

const parede = (id: string, a: [number, number], b: [number, number]): Wall =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } }) as Wall;

describe('passo 1 do tutorial: circuito de paredes fechado', () => {
  it('quatro paredes ligadas em anel fecham o circuito', () => {
    const anel = [parede('w1', [0, 0], [4, 0]), parede('w2', [4, 0], [4, 3]), parede('w3', [4, 3], [0, 3]), parede('w4', [0, 3], [0, 0])];
    expect(temCircuito(anel)).toBe(true);
  });

  it('quatro paredes em cadeia aberta (U) não fecham o circuito', () => {
    const u = [parede('w1', [0, 0], [4, 0]), parede('w2', [4, 0], [4, 3]), parede('w3', [4, 3], [0, 3]), parede('w4', [0, 3], [0, 1])];
    expect(temCircuito(u)).toBe(false);
  });

  it('paredes soltas, mesmo em quantidade, não contam', () => {
    const soltas = [parede('w1', [0, 0], [1, 0]), parede('w2', [5, 0], [6, 0]), parede('w3', [9, 0], [10, 0]), parede('w4', [12, 0], [13, 0])];
    expect(temCircuito(soltas)).toBe(false);
  });

  it('menos de quatro paredes nunca conta', () => {
    expect(temCircuito([parede('w1', [0, 0], [4, 0]), parede('w2', [4, 0], [0, 0])])).toBe(false);
  });
});
