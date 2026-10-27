import { describe, expect, it } from 'vitest';
import { fitCount, fitMask } from './fitCount.ts';

describe('fitCount', () => {
  it('cabe tudo quando a soma cabe (sem botão de mais)', () => {
    expect(fitCount([100, 100, 100], 300, 30)).toBe(3);
    expect(fitCount([], 0, 30)).toBe(0);
  });

  it('recolhe pelo fim e reserva o botão de mais', () => {
    expect(fitCount([100, 100, 100], 240, 30)).toBe(2);
    expect(fitCount([100, 100, 100], 299, 30)).toBe(2);
  });

  it('nada cabe: zero itens visíveis', () => {
    expect(fitCount([120, 40], 100, 30)).toBe(0);
    expect(fitCount([120], 0, 30)).toBe(0);
  });

  it('para no primeiro que não cabe, mesmo que um menor depois caberia (ordem preservada)', () => {
    expect(fitCount([50, 500, 10], 200, 30)).toBe(1);
  });
});

describe('fitMask', () => {
  it('cabe tudo: todos visíveis', () => {
    expect(fitMask([100, 100], [0, 0], 300, 30)).toEqual([true, true]);
  });

  it('sem prioridades recolhe pelo fim, como fitCount', () => {
    expect(fitMask([100, 100, 100], [0, 0, 0], 240, 30)).toEqual([true, true, false]);
  });

  it('o de maior prioridade fica mesmo estando no fim, e a ordem visual é mantida', () => {
    expect(fitMask([100, 100, 100], [0, 0, 2], 240, 30)).toEqual([true, false, true]);
    expect(fitMask([100, 100, 100], [0, 1, 2], 240, 30)).toEqual([false, true, true]);
  });
});
