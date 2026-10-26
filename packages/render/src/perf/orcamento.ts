import type { SnapshotPerf } from './contadores.ts';

/**
 * Orçamento de um cenário (metas da v3 §3). Os limites são os do plano: pan/zoom da planta ≤8 ms de CPU por quadro,
 * 3D ≤16 ms, ≤500 draw calls no WebGL2 e ≤3 M triângulos. `rebuildsMax` existe para provar zero rebuild em câmera.
 * Nada aqui falha sozinho: o teste/medição chama `violacoesOrcamento` e decide.
 */
export interface OrcamentoPerf {
  /** Mediana do tempo de CPU do quadro (ms). */
  frameMsMax?: number;
  /** Mediana de draw calls por quadro. */
  drawCallsMax?: number;
  /** Mediana de triângulos por quadro. */
  triangulosMax?: number;
  /** Máximo de rebuilds em qualquer quadro da janela (0 prova que a câmera não refez camada). */
  rebuildsMax?: number;
  /** FPS mínimo; ignorado quando a vista está ociosa (`fps` nulo). */
  fpsMin?: number;
}

export interface ViolacaoOrcamento {
  metrica: 'frameMs' | 'drawCalls' | 'triangulos' | 'rebuilds' | 'fps';
  valor: number;
  limite: number;
}

/** Metas do plano v3 para a planta (pan/zoom) e para a 3D; o chamador escolhe o cenário. */
export const ORCAMENTO_PLANTA: OrcamentoPerf = { frameMsMax: 8, drawCallsMax: 500, triangulosMax: 3_000_000, rebuildsMax: 0 };
export const ORCAMENTO_3D: OrcamentoPerf = { frameMsMax: 16, drawCallsMax: 500, triangulosMax: 3_000_000 };

const medianaOuNada = (e: { mediana: number } | null): number | null => (e ? e.mediana : null);

/** Lista o que passou do orçamento; usa a mediana da janela (e o máximo em rebuilds) para não reagir a um pico isolado. */
export function violacoesOrcamento(s: SnapshotPerf, o: OrcamentoPerf): ViolacaoOrcamento[] {
  const out: ViolacaoOrcamento[] = [];
  const comparar = (metrica: ViolacaoOrcamento['metrica'], valor: number | null, limite: number | undefined): void => {
    if (limite === undefined || valor === null) return;
    if (valor > limite) out.push({ metrica, valor, limite });
  };
  comparar('frameMs', medianaOuNada(s.janela.frameMs), o.frameMsMax);
  comparar('drawCalls', medianaOuNada(s.janela.drawCalls), o.drawCallsMax);
  comparar('triangulos', medianaOuNada(s.janela.triangulos), o.triangulosMax);
  comparar('rebuilds', s.janela.rebuilds ? s.janela.rebuilds.max : null, o.rebuildsMax);
  if (o.fpsMin !== undefined && s.fps !== null && s.fps < o.fpsMin) out.push({ metrica: 'fps', valor: s.fps, limite: o.fpsMin });
  return out;
}
