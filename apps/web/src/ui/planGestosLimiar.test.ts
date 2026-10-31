import { describe, expect, it } from 'vitest';
import { LIMIAR_ARRASTO_PX, decidirArrasto, eventosDeSolta, passouDoLimiar } from './planGestos.ts';

describe('limiar de arrasto do ponteiro', () => {
  it('é 6 px, usado em todos os gestos', () => {
    expect(LIMIAR_ARRASTO_PX).toBe(6);
  });

  it('até 6 px ainda é clique; acima disso é arrasto', () => {
    expect(decidirArrasto(0)).toBe('click');
    expect(decidirArrasto(4)).toBe('click');
    expect(decidirArrasto(6)).toBe('click');
    expect(decidirArrasto(8)).toBe('drag');
    expect(passouDoLimiar(4)).toBe(false);
    expect(passouDoLimiar(6)).toBe(false);
    expect(passouDoLimiar(7)).toBe(true);
  });

  it('um tremor de 4 px entrega move e depois up + click à ferramenta', () => {
    const arrastou = decidirArrasto(4) === 'drag';
    expect(arrastou).toBe(false);
    // O movimento abaixo do limiar não vira 'drag' (o ViewportCanvas manda `move`), e a solta emite clique.
    expect(eventosDeSolta(arrastou)).toEqual(['up', 'click']);
  });

  it('um arrasto de 8 px emite só up, sem click', () => {
    expect(eventosDeSolta(decidirArrasto(8) === 'drag')).toEqual(['up']);
  });

  it('uma vez arrastado, o gesto continua arrasto mesmo que o ponteiro volte ao início', () => {
    expect(eventosDeSolta(true)).toEqual(['up']);
  });
});
