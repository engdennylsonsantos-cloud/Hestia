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

/**
 * Quais itens ficam visíveis quando há prioridades: os de maior prioridade permanecem e os de menor saem primeiro
 * (empate: o mais à direita sai antes). A ordem visual é preservada. Sem prioridades, equivale a `fitCount`. Função pura.
 */
export function fitMask(widths: readonly number[], priorities: readonly number[], available: number, moreWidth: number): boolean[] {
  const total = widths.reduce((a, w) => a + w, 0);
  if (total <= available) return widths.map(() => true);
  const order = widths.map((_, i) => i).sort((a, b) => (priorities[b] ?? 0) - (priorities[a] ?? 0) || a - b);
  const mask = widths.map(() => false);
  let sum = moreWidth;
  for (const i of order) {
    if (sum + widths[i]! > available) break;
    sum += widths[i]!;
    mask[i] = true;
  }
  return mask;
}
