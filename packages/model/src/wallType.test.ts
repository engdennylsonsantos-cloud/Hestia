import { describe, expect, it } from 'vitest';
import { coreRange, coreSpan, layerSpans, totalThickness } from './wallType.ts';
import type { Layer, LayerFunction } from './types.ts';

const camada = (func: LayerFunction, thickness: number): Layer => ({ function: func, materialId: 'mat_x', thickness, wraps: false });

describe('núcleo e espessura de qualquer tipo com camadas', () => {
  it('núcleo no meio das camadas da parede', () => {
    const estrutura = camada('structure', 0.19);
    const t = {
      layers: [
        camada('finish1', 0.01),
        camada('substrate', 0.02),
        estrutura,
        camada('substrate', 0.02),
        camada('finish2', 0.002),
      ],
    };
    expect(totalThickness(t)).toBeCloseTo(0.242, 12);
    expect(coreRange(t)).toEqual({ first: 2, last: 2 });
    expect(coreSpan(t)).toEqual({ from: 0.03, to: 0.22 });
    expect(layerSpans(t)[2]).toEqual({ index: 2, layer: estrutura, from: 0.03, to: 0.22 });
  });

  it('duas camadas de estrutura com acabamento no meio formam o núcleo inteiro', () => {
    const t = {
      layers: [camada('structure', 0.12), camada('substrate', 0.02), camada('structure', 0.05)],
    };
    expect(coreRange(t)).toEqual({ first: 0, last: 2 });
    expect(coreSpan(t)).toEqual({ from: 0, to: 0.19 });
  });

  it('piso de acabamento sem estrutura tem o elemento inteiro como núcleo', () => {
    const t = { layers: [camada('finish1', 0.01), camada('substrate', 0.03)] };
    expect(coreRange(t)).toEqual({ first: 0, last: 1 });
    expect(coreSpan(t)).toEqual({ from: 0, to: 0.04 });
  });

  it('lista vazia devolve núcleo zerado e nenhuma faixa', () => {
    const t = { layers: [] };
    expect(coreRange(t)).toEqual({ first: 0, last: 0 });
    expect(layerSpans(t)).toEqual([]);
    expect(coreSpan(t)).toEqual({ from: 0, to: 0 });
    expect(totalThickness(t)).toBeCloseTo(0, 12);
  });

  it('núcleo que começa na primeira camada', () => {
    const t = { layers: [camada('structure', 0.1), camada('substrate', 0.02)] };
    expect(coreRange(t)).toEqual({ first: 0, last: 0 });
    expect(coreSpan(t)).toEqual({ from: 0, to: 0.1 });
  });
});
