import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, defaultStairTypeId, makeStair, type StairCurve, type StairRun } from '@hestia/model';
import { stairIssueList } from './stairChecks.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/**
 * Lance reto com espelhos em `xs`; o espelho k é inclinado por `slant[k]` (x ± s·y), para testar espelhos não paralelos.
 * Limites em y = ±0,6, estendidos 0,3 m além dos espelhos extremos.
 */
function run(xs: number[], slant: number[] = []): StairRun {
  const a = xs[0]! - 0.3;
  const b = xs[xs.length - 1]! + 0.3;
  return {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(a, 0.6, b, 0.6)],
    boundaryRight: [ln(a, -0.6, b, -0.6)],
    risers: xs.map((x, k) => ln(x - (slant[k] ?? 0), -1, x + (slant[k] ?? 0), 1)),
    path: [],
  };
}

function unevenOf(components: StairRun[]) {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components }) });
  return stairIssueList(s.project).filter((i) => i.code === 'stair-uneven');
}

/** Espelhos com piso uniforme de 0,28 m. */
const EVEN = [0, 0.28, 0.56, 0.84, 1.12, 1.4];
/** Último piso 0,02 m maior que os demais. */
const UNEVEN = [0, 0.28, 0.56, 0.84, 1.14, 1.42];
/** Variação de 4 mm: dentro da tolerância de 5 mm. */
const WITHIN = [0, 0.28, 0.564, 0.844, 1.124, 1.404];
const SLANT = [0, 0.05, 0, 0.05, 0, 0.05];

describe('degraus iguais (stair-uneven)', () => {
  it('espelhos paralelos com piso uniforme: sem aviso', () => {
    expect(unevenOf([run(EVEN)])).toHaveLength(0);
  });

  it('espelhos paralelos com piso variando 20 mm: aviso no lance', () => {
    const list = unevenOf([run(UNEVEN)]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ severity: 'warning', componentIndex: 0 });
    expect(list[0]!.message).toContain('2,0 cm');
  });

  it('variação de 4 mm fica dentro da tolerância de 5 mm: sem aviso', () => {
    expect(unevenOf([run(WITHIN)])).toHaveLength(0);
  });

  it('espelhos não paralelos (leque): a variação do piso é esperada e não avisa', () => {
    expect(unevenOf([run(UNEVEN, SLANT)])).toHaveLength(0);
  });
});
