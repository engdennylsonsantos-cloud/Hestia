import { formatQuantity, unitSymbol, type Quantity, type ResolvedUnits } from '@hestia/model';

/** Célula numérica de um quadro exportado: valor SI na unidade do projeto, sem o símbolo (fica no cabeçalho). */
export function scheduleCsvCell(units: ResolvedUnits, q: Quantity, si: number, decimals: number): string {
  return formatQuantity(units, q, si, { decimals, withUnit: false });
}

/** Rótulo de coluna de um quadro exportado, com o símbolo da unidade do projeto. */
export function scheduleCsvHeader(units: ResolvedUnits, label: string, q: Quantity): string {
  return `${label} (${unitSymbol(units, q)})`;
}
