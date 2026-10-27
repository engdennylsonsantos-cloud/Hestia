/**
 * Quantos itens da faixa cabem numa linha de largura `available`. Se algum fica de fora, reserva `moreWidth` para o
 * botão de "mais". Recolhe pelo fim: os últimos saem primeiro, como o Revit recolhe painéis e abas. Função pura.
 */
export function fitCount(widths: readonly number[], available: number, moreWidth: number): number {
  const total = widths.reduce((a, w) => a + w, 0);
  if (total <= available) return widths.length;
  let sum = 0;
  let best = 0;
  for (let n = 1; n <= widths.length; n++) {
    sum += widths[n - 1]!;
    if (sum + moreWidth > available) break;
    best = n;
  }
  return best;
}
