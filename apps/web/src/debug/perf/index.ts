import { useEffect } from 'react';
import { contadores, type SnapshotPerf } from '@hestia/render';
import { criarOverlay, type OverlayPerf } from './overlay.ts';
import { lerOpcoesPerf } from './opcoes.ts';

/** API pública de depuração: `window.__hestiaPerf.snapshot()` e `.reset()` (ver docs/desempenho). */
export interface ApiPerf {
  readonly ativo: boolean;
  readonly overlay: boolean;
  snapshot(): SnapshotPerf;
  reset(): void;
}

interface Instalacao {
  api: ApiPerf;
  remover(): void;
}

let instalacao: Instalacao | null = null;

function publicar(api: ApiPerf | null): void {
  const w = window as unknown as { __hestiaPerf?: ApiPerf };
  if (api) w.__hestiaPerf = api;
  else delete w.__hestiaPerf;
}

function apiDesligada(): ApiPerf {
  return { ativo: false, overlay: false, snapshot: () => contadores.snapshot(), reset: () => contadores.reset() };
}

/**
 * Liga a instrumentação conforme a URL (`?perf=1`). Idempotente: chamadas repetidas devolvem a mesma API.
 * Sem o parâmetro `perf`, não cria overlay, não liga contadores e devolve `null`.
 */
export function instalarPerfDaUrl(url: URL = new URL(location.href)): ApiPerf | null {
  if (!url.searchParams.has('perf')) {
    desinstalarPerf();
    return null;
  }
  if (instalacao) return instalacao.api;
  const opcoes = lerOpcoesPerf(url.searchParams);
  if (!opcoes.ativo) {
    const api = apiDesligada();
    instalacao = { api, remover: () => publicar(null) };
    publicar(api);
    return api;
  }
  contadores.ativar();
  const overlay: OverlayPerf | null = opcoes.overlay ? criarOverlay(() => contadores.snapshot()) : null;
  const api: ApiPerf = { ativo: true, overlay: overlay !== null, snapshot: () => contadores.snapshot(), reset: () => contadores.reset() };
  publicar(api);
  instalacao = {
    api,
    remover() {
      overlay?.remover();
      publicar(null);
    },
  };
  return api;
}

/** Desliga medição e overlay e remove `window.__hestiaPerf` (usado no teardown do `ViewportCanvas`). */
export function desinstalarPerf(): void {
  if (!instalacao) {
    publicar(null);
    return;
  }
  instalacao.remover();
  instalacao = null;
  contadores.desativar();
}

/** Liga a instrumentação conforme a URL no ciclo de vida da tela (`?perf=1`). */
export function usePerfDaUrl(): void {
  useEffect(() => {
    instalarPerfDaUrl();
    return desinstalarPerf;
  }, []);
}

/** Conta um commit React do componente que o chama (sem depender de estado nem de props). */
export function useContarCommitPerf(): void {
  useEffect(() => {
    contadores.contarCommitReact();
  });
}

/** Mede o trabalho de CPU do quadro; com a instrumentação desligada os contadores são no-op. */
export function medirQuadro(desenhar: () => void): void {
  contadores.iniciarQuadro(performance.now());
  try {
    desenhar();
  } finally {
    contadores.encerrarQuadro(performance.now());
  }
}
