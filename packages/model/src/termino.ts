import type { Layer, LayerTermino } from './types.ts';

/**
 * Término na junção por camada (decisão 0023 §2, P8). Campo opcional e aditivo: sem o campo vale `auto`, então arquivo
 * antigo abre igual. Nenhuma regra usa nome ou material: o término é uma escolha por atributo de camada.
 */

/** Deslocamento máximo, em cm, nos dois sentidos (decisão 0023 §2). */
export const TERMINO_MAX_CM = 30;

/** Término efetivo da camada (padrão `auto` quando ausente). */
export const terminoOf = (l: Pick<Layer, 'termino'>): LayerTermino => l.termino ?? 'auto';

/** Erro de validação do término, ou null quando é válido (deslocamento finito entre −30 e +30 cm). */
export function terminoIssue(l: Pick<Layer, 'termino'>): string | null {
  const t = l.termino;
  if (t === undefined || t === 'auto' || t === 'nucleo' || t === 'face') return null;
  if (typeof t !== 'object' || t === null || typeof t.cm !== 'number' || !Number.isFinite(t.cm)) return 'Término na junção: deslocamento inválido';
  if (Math.abs(t.cm) > TERMINO_MAX_CM) return `Término na junção: deslocamento entre −${TERMINO_MAX_CM} e ${TERMINO_MAX_CM} cm`;
  return null;
}

/** Deslocamento em metros de um término em cm (0 para os valores de nome). */
export const terminoMeters = (t: LayerTermino): number => (typeof t === 'object' ? t.cm / 100 : 0);

/** Tipo de piso ou de laje com as camadas validadas: lança erro na primeira camada com término inválido. */
export function comTerminoValido<T extends { layers: readonly Layer[] }>(tipo: T): T {
  const erro = tipo.layers.map((l) => terminoIssue(l)).find((e) => e !== null);
  if (erro) throw new Error(erro);
  return tipo;
}
