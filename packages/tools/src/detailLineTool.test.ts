import { describe, expect, it } from 'vitest';
import { P, clickAt, makeEnv, tool } from './testEnv.ts';

describe('ferramenta Linha de detalhe: cota da prévia', () => {
  it('cota o comprimento do traço em desenho e limpa ao concluir', () => {
    const { env } = makeEnv();
    const t = tool('detailLine', env);
    expect(t.tempDims!()).toEqual([]);
    clickAt(t, 0, 0);
    t.move(P(3, 4));
    const [dim] = t.tempDims!();
    expect(dim?.value).toBeCloseTo(5, 9);
    clickAt(t, 3, 4);
    expect(t.tempDims!()).toEqual([]);
  });
});
