/** Texto com ";", aspas ou quebra de linha vai entre aspas; texto que começa com =, +, -, @ ganha apóstrofo (evita fórmula no Excel). */
export const csvText = (s: string): string => {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Documento CSV de tabelas: uma linha por lista de células, separador ';', CRLF e BOM UTF-8. */
export function csvDocument(lines: string[][]): string {
  return `\uFEFF${lines.map((cells) => cells.join(';')).join('\r\n')}\r\n`;
}

/** Número decimal com vírgula (CSV pt-BR); não finito vira célula vazia. */
export const formatDecimal = (v: number, decimals = 2): string =>
  Number.isFinite(v) ? v.toFixed(decimals).replace('.', ',') : '';
