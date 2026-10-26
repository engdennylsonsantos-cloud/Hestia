import { describe, expect, it } from 'vitest';
import type { MultiPolygon } from '@hestia/geom';
import { defaultPaint } from './style.ts';
import { LIGHT } from './types.ts';
import { holeMarkOps } from './holeMarks.ts';

const v = (x: number, y: number) => ({ x, y });
/** Piso 4 × 4 com um furo quadrado 1 × 1 entre (1,1) e (2,2). */
const quadHole: MultiPolygon = [
  [
    [v(0, 0), v(4, 0), v(4, 4), v(0, 4)],
    [v(1, 1), v(2, 1), v(2, 2), v(1, 2)],
  ],
];
const paint = defaultPaint('floor', 1);

describe('holeMarkOps (X do furo de piso e laje)', () => {
  it('furo quadrangular: duas diagonais ligando os vértices opostos (a→c e b→d)', () => {
    const ops = holeMarkOps(quadHole, LIGHT, paint, 'fine');
    expect(ops).toHaveLength(2);
    expect(ops[0]!.pts).toEqual([v(1, 1), v(2, 2)]);
    expect(ops[1]!.pts).toEqual([v(2, 1), v(1, 2)]);
    expect(ops.every((o) => !o.closed && o.dash === undefined)).toBe(true);
  });

  it('o ponto de fechamento repetido do anel não muda o X', () => {
    const closed: MultiPolygon = [
      [
        [v(0, 0), v(4, 0), v(4, 4), v(0, 4)],
        [v(1, 1), v(2, 1), v(2, 2), v(1, 2), v(1, 1)],
      ],
    ];
    expect(holeMarkOps(closed, LIGHT, paint, 'medium')).toEqual(holeMarkOps(quadHole, LIGHT, paint, 'medium'));
  });

  it('furo com cinco vértices não leva X (a diagonal oposta só é definida em quadrilátero)', () => {
    const pentagon: MultiPolygon = [
      [
        [v(0, 0), v(4, 0), v(4, 4), v(0, 4)],
        [v(1, 1), v(2, 1), v(2.5, 1.5), v(2, 2), v(1, 2)],
      ],
    ];
    expect(holeMarkOps(pentagon, LIGHT, paint, 'fine')).toEqual([]);
  });

  it('piso sem furo não tem X', () => {
    expect(holeMarkOps([[[v(0, 0), v(4, 0), v(4, 4), v(0, 4)]]], LIGHT, paint, 'fine')).toEqual([]);
  });

  it('no grosseiro o X não sai', () => {
    expect(holeMarkOps(quadHole, LIGHT, paint, 'coarse')).toEqual([]);
  });

  it('o X usa a largura de projeção da categoria e a cor secundária', () => {
    const ops = holeMarkOps(quadHole, LIGHT, { ...paint, proj: { widthPx: 0.7 } }, 'fine');
    expect(ops.every((o) => o.widthPx === 0.7 && o.color === LIGHT.inkSoft)).toBe(true);
  });
});
