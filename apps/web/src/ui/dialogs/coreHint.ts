import { coreRange, coreSpan, formatQuantity, unitSymbol, type Layer, type ResolvedUnits } from '@hestia/model';

export interface CoreHint {
  /** Nota para embaixo da tabela de camadas. */
  text: string;
  /** true quando o tipo não tem camada Estrutura (o núcleo é o elemento inteiro). */
  semEstrutura: boolean;
}

/** Texto do núcleo para o editor de piso e de laje, medida a partir da face indicada. */
export function coreHint(type: { layers: readonly Layer[] }, units: ResolvedUnits, face = 'face de cima'): CoreHint {
  if (type.layers.length === 0) return { text: 'Sem camadas: não há núcleo.', semEstrutura: true };
  if (!type.layers.some((l) => l.function === 'structure')) {
    return { text: 'Sem camada Estrutura: o núcleo é o elemento inteiro.', semEstrutura: true };
  }
  const { first, last } = coreRange(type);
  const span = coreSpan(type);
  const sem = (m: number): string => formatQuantity(units, 'smallLength', m, { withUnit: false });
  return {
    text: `Núcleo: camadas ${first + 1} a ${last + 1}, de ${sem(span.from)} a ${sem(span.to)} ${unitSymbol(units, 'smallLength')} da ${face}.`,
    semEstrutura: false,
  };
}
