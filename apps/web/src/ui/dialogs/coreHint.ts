import { coreRange, coreSpan, type Layer } from '@hestia/model';

export interface CoreHint {
  /** Nota para embaixo da tabela de camadas. */
  text: string;
  /** true quando o tipo não tem camada Estrutura (o núcleo é o elemento inteiro). */
  semEstrutura: boolean;
}

const cm = (m: number): string => (m * 100).toFixed(1).replace('.', ',');

/** Texto do núcleo para o editor de piso e de laje, medida a partir da face indicada. */
export function coreHint(type: { layers: readonly Layer[] }, face = 'face de cima'): CoreHint {
  if (type.layers.length === 0) return { text: 'Sem camadas: não há núcleo.', semEstrutura: true };
  if (!type.layers.some((l) => l.function === 'structure')) {
    return { text: 'Sem camada Estrutura: o núcleo é o elemento inteiro.', semEstrutura: true };
  }
  const { first, last } = coreRange(type);
  const span = coreSpan(type);
  return {
    text: `Núcleo: camadas ${first + 1} a ${last + 1}, de ${cm(span.from)} a ${cm(span.to)} cm da ${face}.`,
    semEstrutura: false,
  };
}
