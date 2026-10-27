import { describe, expect, it } from 'vitest';
import { fitCount } from './fitCount.ts';

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
