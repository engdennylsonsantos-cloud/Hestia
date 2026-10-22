import { describe, expect, it } from 'vitest';
import { FUNCTION_PRIORITY, layerPriority, temPrioridadeEmpatada } from './priority.ts';
import type { Layer, LayerFunction } from './types.ts';

const L = (fn: LayerFunction, extra: Partial<Layer> = {}): Layer => ({ function: fn, materialId: 'mat_x', thickness: 0.01, ...extra }) as Layer;

describe('prioridade efetiva da camada (0023 §1.1)', () => {
  it('sem campo próprio, vale a prioridade da função', () => {
    expect(layerPriority(L('structure'))).toBe(1);
    expect(layerPriority(L('membrane'))).toBe(3);
    expect(layerPriority(L('finish2'))).toBe(5);
  });

  it('o campo priority da camada sobrescreve a função', () => {
    expect(layerPriority(L('finish1', { priority: 2 }))).toBe(2);
    expect(layerPriority(L('structure', { priority: 5 }))).toBe(5);
  });
});

describe('dica de prioridade empatada', () => {
  it('funções diferentes com a mesma prioridade efetiva disparam a dica', () => {
    expect(temPrioridadeEmpatada([L('thermal'), L('membrane')])).toBe(true);
    expect(temPrioridadeEmpatada([L('finish1', { priority: 2 }), L('substrate')])).toBe(true);
  });

  it('mesma função com mesma prioridade não é empate (ex.: dois substratos)', () => {
    expect(temPrioridadeEmpatada([L('substrate'), L('structure'), L('substrate')])).toBe(false);
  });

  it('prioridades distintas não disparam a dica', () => {
    expect(temPrioridadeEmpatada([L('structure'), L('substrate'), L('finish1')])).toBe(false);
    expect(FUNCTION_PRIORITY.membrane).toBe(FUNCTION_PRIORITY.thermal);
  });
});
