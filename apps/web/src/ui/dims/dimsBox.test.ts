import { describe, expect, it } from 'vitest';
import { LARGURA_MINIMA_CAMPO, larguraDoCampo } from './dimsBox.ts';

describe('larguraDoCampo', () => {
  it('mantém a largura mínima para textos curtos', () => {
    expect(larguraDoCampo('6')).toBe(LARGURA_MINIMA_CAMPO);
    expect(larguraDoCampo('120,00')).toBe(LARGURA_MINIMA_CAMPO);
  });

  it('cresce para valores de pés e polegadas longos', () => {
    const largura = larguraDoCampo(`24' 11 3/16"`);
    expect(largura).toBeGreaterThan(LARGURA_MINIMA_CAMPO);
    expect(largura).toBeGreaterThan(80);
  });

  it('nunca encolhe quando o texto cresce', () => {
    expect(larguraDoCampo('1,20')).toBeLessThanOrEqual(larguraDoCampo('1,20 m'));
    expect(larguraDoCampo('1,20 m')).toBeLessThanOrEqual(larguraDoCampo(`1,20 m (24' 11 3/16")`));
  });
});
