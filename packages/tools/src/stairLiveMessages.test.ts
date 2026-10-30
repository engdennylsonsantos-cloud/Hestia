import { describe, expect, it } from 'vitest';
import type { StairRemaining } from '@hestia/engine';
import { TEXTO_ALCANCADO, estadoDoRestante, rotuloEscadaLivre, textoFaltaEspelhos, textoPassouEspelhos } from './stairLiveMessages.ts';

const restante = (r: Partial<StairRemaining>): StairRemaining => ({
  status: 'falta',
  placed: 0,
  falta: 0,
  faltaLength: 0,
  excess: 0,
  closeAt: null,
  ...r,
});

describe('mensagens da escada livre', () => {
  it('falta de espelhos, no plural e no singular, com o comprimento em 1 casa', () => {
    expect(textoFaltaEspelhos(5, 1.4)).toBe('faltam 5 espelhos (≈ 1,4 m)');
    expect(textoFaltaEspelhos(1, 0.28)).toBe('falta 1 espelho (≈ 0,3 m)');
  });

  it('espelhos a mais, no plural e no singular', () => {
    expect(textoPassouEspelhos(2)).toBe('passou 2 espelhos: a escada termina antes do cursor');
    expect(textoPassouEspelhos(1)).toBe('passou 1 espelho: a escada termina antes do cursor');
  });

  it('rótulo completo com o caso do contrato', () => {
    expect(rotuloEscadaLivre(16, 0.175, 0.28, textoFaltaEspelhos(5, 1.4))).toBe(
      '16 espelhos · 17,5 cm · piso 28,0 cm · faltam 5 espelhos (≈ 1,4 m)',
    );
    expect(rotuloEscadaLivre(17, 2.8 / 17, 0.3125, TEXTO_ALCANCADO)).toBe('17 espelhos · 16,5 cm · piso 31,3 cm · nível de topo alcançado');
  });

  it('estado do restante nos três status', () => {
    expect(estadoDoRestante(restante({ status: 'falta', falta: 5, faltaLength: 1.4 }))).toBe('faltam 5 espelhos (≈ 1,4 m)');
    expect(estadoDoRestante(restante({ status: 'alcancado' }))).toBe(TEXTO_ALCANCADO);
    expect(estadoDoRestante(restante({ status: 'passou', excess: 2 }))).toBe('passou 2 espelhos: a escada termina antes do cursor');
  });
});
