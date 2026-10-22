import type { Layer, LayerFunction } from './types.ts';

/**
 * Prioridade de junção por função (menor número vence, decisão 0023 §1.1): estrutura 1, substrato 2, térmica 3,
 * membrana 3 (aprovada em P-1, `MEMBRANE_PRIORITY`), acabamento 1 = 4 e acabamento 2 = 5. Valores centralizados aqui
 * para ajuste sem mexer no motor (decisão 0002). O `priority` da camada, quando existe, sobrescreve a função.
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

/** Prioridade efetiva da camada: `priority` quando definido, senão a da função. Vale para parede, piso e laje. */
export const layerPriority = (l: Layer): number => l.priority ?? FUNCTION_PRIORITY[l.function];

/**
 * Dica (não bloqueia, decisão 0023 §7): há duas camadas de funções diferentes com a mesma prioridade efetiva. Elas não
 * se cortam e deixam linha de fronteira; o usuário pode querer números distintos.
 */
export const temPrioridadeEmpatada = (layers: readonly Layer[]): boolean =>
  layers.some((a, i) => layers.some((b, j) => j > i && a.function !== b.function && layerPriority(a) === layerPriority(b)));
