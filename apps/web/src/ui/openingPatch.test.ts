import { describe, expect, it } from 'vitest';
import { movedOpeningsMessage } from './openingPatch.ts';

describe('movedOpeningsMessage (aviso de abertura deslocada para caber)', () => {
  it('uma abertura deslocada: mostra a posição pedida e a que ficou', () => {
    expect(movedOpeningsMessage([{ before: 3, after: 2.8 }])).toBe('A abertura foi deslocada para caber: 3,00 → 2,80 m.');
  });

  it('sem deslocamento, sem aviso', () => {
    expect(movedOpeningsMessage([{ before: 2, after: 2 }])).toBeNull();
    expect(movedOpeningsMessage([])).toBeNull();
  });

  it('várias aberturas deslocadas: conta, sem listar', () => {
    expect(movedOpeningsMessage([{ before: 3, after: 2.8 }, { before: 1, after: 1 }, { before: 0.5, after: 0.8 }])).toBe('2 aberturas foram deslocadas para caber na parede.');
  });
});
