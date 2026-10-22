import { describe, expect, it } from 'vitest';
import { isMembraneLayer, MEMBRANE_PRIORITY } from './membrane.ts';
import type { Layer } from './types.ts';

const layer = (over: Partial<Layer>): Layer => ({ function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false, ...over });

describe('isMembraneLayer', () => {
  it('função Membrana é membrana, mesmo com espessura', () => {
    expect(isMembraneLayer(layer({ function: 'membrane', thickness: 0.002 }))).toBe(true);
  });

  it('espessura zero é membrana, qualquer que seja a função', () => {
    expect(isMembraneLayer(layer({ function: 'finish1', thickness: 0 }))).toBe(true);
    expect(isMembraneLayer(layer({ function: 'structure', thickness: 1e-7 }))).toBe(true);
  });

  it('camada comum não é membrana, mesmo com o nome do material parecido', () => {
    expect(isMembraneLayer(layer({ function: 'finish1', materialId: 'mat_membrana', thickness: 0.02 }))).toBe(false);
  });
});

describe('MEMBRANE_PRIORITY', () => {
  it('é 3, a prioridade aprovada para a membrana (decisão 0023, P-1)', () => {
    expect(MEMBRANE_PRIORITY).toBe(3);
  });
});
