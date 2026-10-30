/**
 * Câmera da prancha (zoom e pan da folha na tela). A câmera vive em mm de papel, com y para cima como o modelo; o
 * viewBox do SVG é derivado dela. Estado só de sessão: como no Revit, o zoom da prancha não vai para o arquivo.
 */

export interface SheetCamera {
  /** Centro da tela, em mm de papel (x para a direita, y para cima). */
  cx: number;
  cy: number;
  /** Pixels de tela por mm de papel. */
  zoom: number;
}

export interface SheetSize {
  w: number;
  h: number;
}

export interface SheetPoint {
  x: number;
  y: number;
}

/** Limites do zoom, em px/mm (0,15 ≈ uma A3 inteira em 90 px; 40 ≈ detalhe de milímetro). */
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 40;

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Zoom que enquadra a folha inteira na área disponível, com uma folga em px em volta. */
export function fitCamera(paper: SheetSize, view: SheetSize, padPx = 24): SheetCamera {
  const availW = Math.max(1, view.w - padPx * 2);
  const availH = Math.max(1, view.h - padPx * 2);
  const zoom = clampZoom(Math.min(availW / Math.max(1, paper.w), availH / Math.max(1, paper.h)));
  return { cx: paper.w / 2, cy: paper.h / 2, zoom };
}

/** Aproxima (`factor` > 1) ou afasta mantendo fixo o ponto de papel sob o cursor. */
export function zoomAt(cam: SheetCamera, factor: number, point: SheetPoint): SheetCamera {
  const zoom = clampZoom(cam.zoom * factor);
  const k = zoom / cam.zoom;
  return { cx: point.x - (point.x - cam.cx) / k, cy: point.y - (point.y - cam.cy) / k, zoom };
}

/** Move a câmera pelo deslocamento do ponteiro em px (arrastar a folha). */
export function panBy(cam: SheetCamera, dxPx: number, dyPx: number): SheetCamera {
  return { cx: cam.cx - dxPx / cam.zoom, cy: cam.cy + dyPx / cam.zoom, zoom: cam.zoom };
}

/** Enquadra uma caixa de papel (mm, y para cima) dentro da tela. */
export function zoomToBox(box: { x: number; y: number; w: number; h: number }, view: SheetSize, padPx = 48): SheetCamera {
  const availW = Math.max(1, view.w - padPx * 2);
  const availH = Math.max(1, view.h - padPx * 2);
  const zoom = clampZoom(Math.min(availW / Math.max(0.1, box.w), availH / Math.max(0.1, box.h)));
  return { cx: box.x + box.w / 2, cy: box.y + box.h / 2, zoom };
}

/** viewBox do SVG (y para baixo), a partir da câmera e do tamanho da área de desenho. */
export function viewBoxOf(cam: SheetCamera, paper: SheetSize, view: SheetSize): { x: number; y: number; w: number; h: number } {
  const w = Math.max(1, view.w) / cam.zoom;
  const h = Math.max(1, view.h) / cam.zoom;
  return { x: cam.cx - w / 2, y: paper.h - cam.cy - h / 2, w, h };
}

/** Ponto de tela (px, a partir do canto superior esquerdo da área) para mm de papel (y para cima). */
export function screenToPaper(cam: SheetCamera, view: SheetSize, sx: number, sy: number): SheetPoint {
  return { x: cam.cx + (sx - view.w / 2) / cam.zoom, y: cam.cy - (sy - view.h / 2) / cam.zoom };
}

/** Ponto de papel (mm, y para cima) para tela (px a partir do canto superior esquerdo). */
export function paperToScreen(cam: SheetCamera, view: SheetSize, p: SheetPoint): SheetPoint {
  return { x: view.w / 2 + (p.x - cam.cx) * cam.zoom, y: view.h / 2 - (p.y - cam.cy) * cam.zoom };
}
