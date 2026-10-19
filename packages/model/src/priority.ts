import type { Layer, LayerFunction } from './types.ts';

/**
 * Prioridade de junção por função (menor número vence). docs/05 §1: estrutura 1 … acabamento 2 = 5,
 * conforme a fonte consultada; a membrana não tem espessura e fica entre térmica e acabamento 1.
 * Decisão 0002: valores centralizados aqui para ajuste futuro sem mexer no motor.
 */
export const FUNCTION_PRIORITY: Record<LayerFunction, number> = {
  structure: 1,
  substrate: 2,
  thermal: 3,
  membrane: 3,
  finish1: 4,
  finish2: 5,
};

export const FUNCTION_LABEL: Record<LayerFunction, string> = {
  structure: 'Estrutura',
  substrate: 'Substrato',
  thermal: 'Isolamento',
  membrane: 'Membrana',
  finish1: 'Acabamento 1',
  finish2: 'Acabamento 2',
};

export const layerPriority = (l: Layer): number => l.priority ?? FUNCTION_PRIORITY[l.function];
