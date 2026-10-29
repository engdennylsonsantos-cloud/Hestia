import { describe, expect, it } from 'vitest';
import { defaultUnits, resolveUnits, type Layer, type LayerFunction } from '@hestia/model';
import { coreHint } from './coreHint.ts';

const camada = (func: LayerFunction, thickness: number): Layer => ({ function: func, materialId: 'mat_x', thickness, wraps: false });
const units = defaultUnits();

describe('coreHint', () => {
  it('descreve o núcleo quando há camada Estrutura', () => {
    const t = { layers: [camada('substrate', 0.02), camada('structure', 0.15)] };
    expect(coreHint(t, units)).toEqual({ text: 'Núcleo: camadas 2 a 2, de 2,0 a 17,0 cm da face de cima.', semEstrutura: false });
  });

  it('ignora membrana de espessura zero antes da Estrutura', () => {
    const t = { layers: [camada('finish1', 0.03), camada('membrane', 0), camada('structure', 0.1)] };
    expect(coreHint(t, units)).toEqual({ text: 'Núcleo: camadas 3 a 3, de 3,0 a 13,0 cm da face de cima.', semEstrutura: false });
  });

  it('avisa quando não há camada Estrutura', () => {
    const t = { layers: [camada('finish1', 0.01), camada('substrate', 0.03)] };
    expect(coreHint(t, units)).toEqual({ text: 'Sem camada Estrutura: o núcleo é o elemento inteiro.', semEstrutura: true });
  });

  it('usa a face indicada na medida', () => {
    const t = { layers: [camada('finish1', 0.01), camada('substrate', 0.02), camada('structure', 0.19)] };
    expect(coreHint(t, units, 'face externa')).toEqual({ text: 'Núcleo: camadas 3 a 3, de 3,0 a 22,0 cm da face externa.', semEstrutura: false });
  });

  it('avisa quando não há camadas', () => {
    expect(coreHint({ layers: [] }, units)).toEqual({ text: 'Sem camadas: não há núcleo.', semEstrutura: true });
  });

  it('acompanha unidades não padrão (milímetros)', () => {
    const t = { layers: [camada('substrate', 0.02), camada('structure', 0.15)] };
    const mm = resolveUnits({ smallLength: { unit: 'mm', decimals: 0 } });
    expect(coreHint(t, mm).text).toBe('Núcleo: camadas 2 a 2, de 20 a 170 mm da face de cima.');
  });
});
