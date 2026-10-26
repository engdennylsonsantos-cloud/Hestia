import { dockPanels, normalizeDock, type DockLayout, type DockPanel, type DockSide, type OpenPanels } from '../editor/dockLayout.ts';

/**
 * Lógica pura do arraste de painéis (sem DOM): onde o cursor cai e o que muda na disposição quando o painel é solto.
 * `left`/`right` levam o painel para aquele dock; `above-other`/`below-other` empilham no dock do outro painel.
 */
export type DropZone = 'left' | 'right' | 'above-other' | 'below-other';

/** Retângulo no formato de DOMRect (left, top, width, height). */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Fração da largura do workspace que cada faixa lateral ocupa. */
export const DROP_BAND = 0.25;

const inside = (p: { x: number; y: number }, r: Rect): boolean =>
  p.x >= r.left && p.x < r.left + r.width && p.y >= r.top && p.y < r.top + r.height;

/**
 * Zona de soltura sob o ponto, ou null (fora do workspace ou no meio da área de trabalho). Sobre o outro painel, vale a
 * metade de cima ou de baixo dele; senão, as faixas da esquerda e da direita do workspace.
 */
export function dropZoneAt(point: { x: number; y: number }, ws: Rect, other: Rect | null): DropZone | null {
  if (ws.width <= 0 || !inside(point, ws)) return null;
  if (other && inside(point, other)) return point.y < other.top + other.height / 2 ? 'above-other' : 'below-other';
  const f = (point.x - ws.left) / ws.width;
  if (f < DROP_BAND) return 'left';
  if (f >= 1 - DROP_BAND) return 'right';
  return null;
}

/**
 * Nova disposição depois de soltar `panel` na zona `zone`. Já estando no lado de destino, a ordem não muda (soltar no mesmo
 * lugar não altera nada). Entrando num dock que já tem o outro painel, o que foi arrastado vai para cima, salvo quando solto
 * abaixo do outro.
 */
export function applyDrop(d: DockLayout, panel: DockPanel, zone: DropZone): DockLayout {
  const other: DockPanel = panel === 'props' ? 'browser' : 'props';
  let dock: DockSide;
  let first: DockPanel;
  if (zone === 'left' || zone === 'right') {
    dock = zone;
    first = d.sides[panel] === dock ? d.first : panel;
  } else {
    dock = d.sides[other];
    first = zone === 'above-other' ? panel : other;
  }
  return normalizeDock({ ...d, sides: { ...d.sides, [panel]: dock }, first });
}

/**
 * Retângulo exato que o painel ocupará na tela depois de soltar na zona: é o que a prévia desenha, para que o realce nunca
 * seja maior (nem menor) que a área real. Simula a disposição resultante (`applyDrop`) com a largura do dock e a divisória.
 */
export function previewRect(d: DockLayout, panel: DockPanel, zone: DropZone, open: OpenPanels, ws: Rect): Rect {
  const next = applyDrop(d, panel, zone);
  const side = next.sides[panel];
  const list = dockPanels(next, side, { ...open, [panel]: true });
  const width = side === 'left' ? next.leftW : next.rightW;
  const left = side === 'left' ? ws.left : ws.left + ws.width - width;
  if (list.length < 2) return { left, top: ws.top, width, height: ws.height };
  const topH = ws.height * next.split;
  return list[0] === panel
    ? { left, top: ws.top, width, height: topH }
    : { left, top: ws.top + topH, width, height: ws.height - topH };
}
