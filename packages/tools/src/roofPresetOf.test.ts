import { describe, expect, it } from 'vitest';
import type { Roof } from '@hestia/model';
import { presetEdgeSlopes, roofPresetOf } from './roofEdges.ts';

const RECT = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];
const DIR = { x: 1, y: 0 };

/** Telhado mínimo com as inclinações por aresta dadas (a forma guardada é 'edges', como na criação). */
const roofWith = (boundary: typeof RECT, edgeSlopes: Array<number | null>, slopePercent = 30): Roof => ({ boundary, dir: DIR, slopePercent, edgeSlopes, shape: 'edges' }) as unknown as Roof;

describe('telhado: forma da predefinição que o telhado reproduz (defeito 5)', () => {
  it('duas águas num retângulo é reconhecida: a Propriedades mostra a mesma forma da barra', () => {
    const r = roofWith(RECT, presetEdgeSlopes(RECT, 'gable', DIR, 30));
    expect(roofPresetOf(r)).toBe('gable');
  });

  it('quatro águas e uma água são reconhecidas', () => {
    expect(roofPresetOf(roofWith(RECT, presetEdgeSlopes(RECT, 'hip', DIR, 30)))).toBe('hip');
    expect(roofPresetOf(roofWith(RECT, presetEdgeSlopes(RECT, 'shed', DIR, 30)))).toBe('shed');
  });

  it('inclinação editada por aresta não corresponde a predefinição: continua "por arestas"', () => {
    expect(roofPresetOf(roofWith(RECT, [30, null, 20, null]))).toBeNull();
  });
});
