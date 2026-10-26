import { setDock } from '../editor/dockActions.ts';
import type { DockPanel, OpenPanels } from '../editor/dockLayout.ts';
import { useUi } from '../editor/state.ts';
import { applyDrop, dropZoneAt, previewRect, type DropZone, type Rect } from './dockDrag.ts';

/**
 * Sessão de arrasto de um painel acoplado. Tudo é imperativo (DOM direto, sem estado do React): o fantasma segue o cursor
 * por `transform`, no máximo um quadro por vez, e a prévia só muda de lugar quando a zona de soltura muda. Os retângulos
 * são medidos uma vez, no início. A disposição só é gravada ao soltar.
 */

const NAME: Record<DockPanel, string> = { props: 'Propriedades', browser: 'Navegador de projeto' };
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

const rectOf = (el: Element | null): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

function div(cls: string, parent: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.className = cls;
  parent.appendChild(el);
  return el;
}

let active = false;

export interface DragStart {
  panel: DockPanel;
  pointerId: number;
  /** Cabeçalho que recebeu o clique: guarda o ponteiro até soltar. */
  head: HTMLElement;
  /** Posição do ponteiro dentro do cabeçalho: o fantasma mantém essa pegada. */
  grab: { dx: number; dy: number };
  x: number;
  y: number;
}

/** Começa o arrasto (uma sessão por vez). Devolve false se não houver workspace para soltar. */
export function startDockDrag(s: DragStart): boolean {
  const ws = rectOf(document.querySelector('.workspace'));
  if (active || !ws) return false;
  active = true;
  const other: DockPanel = s.panel === 'props' ? 'browser' : 'props';
  const otherRect = rectOf(document.querySelector(`[data-dock-panel="${other}"]`));
  const srcEl = document.querySelector<HTMLElement>(`[data-dock-panel="${s.panel}"]`);
  const src = rectOf(srcEl) ?? { left: s.x, top: s.y, width: 280, height: 320 };
  const open = (): OpenPanels => ({ props: useUi.getState().propsOpen, browser: useUi.getState().browserOpen });

  // Camada única, acima de tudo e sem interceptar o ponteiro.
  const root = div('dd-root', document.body);
  const edgeL = div('dd-edge left', root);
  const edgeR = div('dd-edge right', root);
  edgeL.style.cssText = `left:${ws.left}px;top:${ws.top}px;height:${ws.height}px`;
  edgeR.style.cssText = `left:${ws.left + ws.width - 3}px;top:${ws.top}px;height:${ws.height}px`;
  const preview = div('dd-preview', root);
  const previewLabel = div('dd-preview-label', preview);
  previewLabel.textContent = NAME[s.panel];
  const ghost = div('dd-ghost', root);
  const gw = clamp(src.width, 220, 340);
  const gh = clamp(src.height * 0.6, 120, 260);
  ghost.style.width = `${gw}px`;
  ghost.style.height = `${gh}px`;
  const title = div('dd-ghost-title', ghost);
  title.textContent = NAME[s.panel];
  div('dd-ghost-body', ghost);
  document.body.classList.add('dock-dragging');
  srcEl?.classList.add('dd-source');

  let zone: DropZone | null = null;
  let px = s.x;
  let py = s.y;
  let raf = 0;

  const showPreview = (z: DropZone | null): void => {
    if (!z) {
      preview.classList.remove('on');
      return;
    }
    const r = previewRect(useUi.getState().dock, s.panel, z, open(), ws);
    // Primeira aparição: posiciona sem animar (senão a prévia "voa" da última posição); depois as trocas deslizam.
    const first = !preview.classList.contains('on');
    if (first) preview.style.transition = 'none';
    preview.style.left = `${r.left}px`;
    preview.style.top = `${r.top}px`;
    preview.style.width = `${r.width}px`;
    preview.style.height = `${r.height}px`;
    if (first) {
      void preview.offsetWidth;
      preview.style.transition = '';
    }
    preview.classList.add('on');
  };

  const frame = (): void => {
    raf = 0;
    ghost.style.transform = `translate3d(${px - s.grab.dx}px, ${py - s.grab.dy}px, 0)`;
    const z = dropZoneAt({ x: px, y: py }, ws, otherRect);
    if (z !== zone) {
      zone = z;
      showPreview(z);
      ghost.classList.toggle('no-drop', z === null);
    }
  };
  const schedule = (): void => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== s.pointerId) return;
    px = e.clientX;
    py = e.clientY;
    schedule();
  };
  const finish = (apply: boolean): void => {
    if (!active) return;
    active = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', onCancel);
    try {
      s.head.releasePointerCapture(s.pointerId);
    } catch {
      // O cabeçalho pode já ter sido desmontado: nada a soltar.
    }
    root.remove();
    srcEl?.classList.remove('dd-source');
    document.body.classList.remove('dock-dragging');
    if (apply && zone) setDock(applyDrop(useUi.getState().dock, s.panel, zone));
  };
  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== s.pointerId) return;
    px = e.clientX;
    py = e.clientY;
    // Última posição: a zona vale a do ponto onde soltou, mesmo sem quadro pendente.
    zone = dropZoneAt({ x: px, y: py }, ws, otherRect);
    finish(true);
  };
  const onCancel = (): void => finish(false);
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    finish(false);
  };

  try {
    s.head.setPointerCapture(s.pointerId);
  } catch {
    // Sem captura, os ouvintes da janela ainda recebem o movimento enquanto o ponteiro está dentro dela.
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', onCancel);
  frame();
  return true;
}
