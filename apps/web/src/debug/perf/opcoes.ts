/**
 * Opções do `?perf` lidas da URL. Puro (sem DOM) para poder ser testado em Node.
 *
 * - sem `perf` → desligado (nenhuma medição, nenhum overlay);
 * - `?perf=1` (ou `?perf`) → medição ligada e overlay visível;
 * - `?perf=0` → desligado (a API `__hestiaPerf` ainda responde com zeros);
 * - `?perf=1&overlay=0` → mede sem desenhar o overlay.
 */
export interface OpcoesPerf {
  ativo: boolean;
  overlay: boolean;
}

export function lerOpcoesPerf(params: URLSearchParams): OpcoesPerf {
  const bruto = params.get('perf');
  const desligado = bruto === null || bruto === '0' || bruto.toLowerCase() === 'false' || bruto.toLowerCase() === 'off';
  return { ativo: !desligado, overlay: !desligado && params.get('overlay') !== '0' };
}
