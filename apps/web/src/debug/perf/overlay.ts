import type { SnapshotPerf } from '@hestia/render';

export interface OverlayPerf {
  elemento: HTMLElement;
  atualizar(): void;
  remover(): void;
}

/** Estilo fixo (não entra no fluxo do layout) e discreto; `pointer-events: none` para não roubar cliques. */
const CSS =
  'position:fixed;left:8px;bottom:8px;z-index:2147483000;pointer-events:none;user-select:none;' +
  'padding:6px 8px;border-radius:4px;background:rgba(12,14,18,0.78);color:#e6e6e6;' +
  'font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums;' +
  'white-space:pre;box-shadow:0 1px 4px rgba(0,0,0,0.35)';

const ms = (x: number | null | undefined): string => (x === null || x === undefined ? '—' : x.toFixed(1));

/** 1234 → 1.2k, 1234567 → 1.2M: o overlay é estreito. */
export function compacto(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Texto do overlay a partir de um snapshot. Puro (testável sem DOM). */
export function formatarSnapshot(s: SnapshotPerf): string {
  const q = s.quadro;
  const fps = s.ocioso ? 'ocioso' : s.fps === null ? '—' : `${s.fps.toFixed(1)} fps`;
  const gpu = s.gpu.timer === 'disponivel' ? `${ms(s.gpu.ms)} ms` : '—';
  return [
    `hestia perf · ${s.backend ?? '—'} · ${fps}`,
    `frame ${ms(q?.ms)} ms (p95 ${ms(s.janela.frameMs?.p95)}) · gpu ${gpu}`,
    `draw ${q?.drawCalls ?? 0} (p95 ${ms(s.janela.drawCalls?.p95)}) · tri ${compacto(q?.triangulos ?? 0)}`,
    `upload ${q?.uploads ?? 0} · ${compacto(s.total.uploadBytes)} B · rebuild ${q?.rebuilds ?? 0}`,
    `camadas g${s.camadas.geometria}/s${s.camadas.sobreposicao}/gr${s.camadas.grade} · commits ${s.total.commitsReact}`,
  ].join('\n');
}

/** Cria o overlay no corpo do documento e o atualiza num intervalo fixo (não agenda rAF nem re-renderiza o React). */
export function criarOverlay(obter: () => SnapshotPerf, intervaloMs = 250): OverlayPerf {
  document.getElementById('hestia-perf')?.remove();
  const el = document.createElement('div');
  el.id = 'hestia-perf';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = CSS;
  document.body.appendChild(el);
  const atualizar = (): void => {
    el.textContent = formatarSnapshot(obter());
  };
  atualizar();
  const timer = setInterval(atualizar, intervaloMs);
  return {
    elemento: el,
    atualizar,
    remover() {
      clearInterval(timer);
      el.remove();
    },
  };
}
