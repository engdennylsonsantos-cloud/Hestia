/**
 * Geometria da seleção de uma vista na prancha: as oito alças de redimensionar (Revit: *Crop Region*), o
 * redimensionamento com tamanho mínimo e o encaixe na área de desenho. Tudo em mm de papel, com y para cima.
 */

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const HANDLES: readonly HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface PaperPoint {
  x: number;
  y: number;
}

export interface PaperBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InnerBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Menor lado aceito ao redimensionar (mm de papel). */
export const MIN_BOX_MM = 5;

/** Ponto de uma alça na caixa (y para cima: `n` é o topo). */
export function handlePoint(b: PaperBox, h: HandleId): PaperPoint {
  const left = b.x;
  const right = b.x + b.w;
  const bottom = b.y;
  const top = b.y + b.h;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (h) {
    case 'nw':
      return { x: left, y: top };
    case 'n':
      return { x: cx, y: top };
    case 'ne':
      return { x: right, y: top };
    case 'e':
      return { x: right, y: cy };
    case 'se':
      return { x: right, y: bottom };
    case 's':
      return { x: cx, y: bottom };
    case 'sw':
      return { x: left, y: bottom };
    case 'w':
      return { x: left, y: cy };
  }
}

/** Alça sob o ponto (com tolerância em mm), ou null. */
export function hitHandle(b: PaperBox, p: PaperPoint, tolMm = 3): HandleId | null {
  for (const h of HANDLES) {
    const q = handlePoint(b, h);
    if (Math.abs(q.x - p.x) <= tolMm && Math.abs(q.y - p.y) <= tolMm) return h;
  }
  return null;
}

/** Cursor do sistema para cada alça. */
export function cursorForHandle(h: HandleId): string {
  if (h === 'nw' || h === 'se') return 'nwse-resize';
  if (h === 'ne' || h === 'sw') return 'nesw-resize';
  if (h === 'n' || h === 's') return 'ns-resize';
  return 'ew-resize';
}

const corner = (h: HandleId): boolean => h === 'nw' || h === 'ne' || h === 'se' || h === 'sw';
const movesLeft = (h: HandleId): boolean => h === 'nw' || h === 'w' || h === 'sw';
const movesRight = (h: HandleId): boolean => h === 'ne' || h === 'e' || h === 'se';
const movesBottom = (h: HandleId): boolean => h === 'sw' || h === 's' || h === 'se';
const movesTop = (h: HandleId): boolean => h === 'nw' || h === 'n' || h === 'ne';

/**
 * Redimensiona a caixa arrastando a alça em `delta` (mm). O lado oposto fica parado, o tamanho mínimo é respeitado e,
 * com `keepAspect`, os cantos mantêm a proporção original (Shift, como no Revit).
 */
export function resizeBox(start: PaperBox, handle: HandleId, delta: PaperPoint, keepAspect = false): PaperBox {
  let x0 = start.x;
  let y0 = start.y;
  let x1 = start.x + start.w;
  let y1 = start.y + start.h;
  if (movesLeft(handle)) x0 += delta.x;
  if (movesRight(handle)) x1 += delta.x;
  if (movesBottom(handle)) y0 += delta.y;
  if (movesTop(handle)) y1 += delta.y;

  const min = MIN_BOX_MM;
  if (x1 - x0 < min) {
    if (movesLeft(handle)) x0 = x1 - min;
    else x1 = x0 + min;
  }
  if (y1 - y0 < min) {
    if (movesBottom(handle)) y0 = y1 - min;
    else y1 = y0 + min;
  }

  if (keepAspect && corner(handle)) {
    const ratio = start.w / Math.max(1e-9, start.h);
    let w = x1 - x0;
    let h = y1 - y0;
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    if (movesLeft(handle)) x0 = x1 - w;
    else x1 = x0 + w;
    if (movesBottom(handle)) y0 = y1 - h;
    else y1 = y0 + h;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Encaixa a caixa inteira na área de desenho, encolhendo se ela for maior que a área. */
export function clampBoxToInner(b: PaperBox, inner: InnerBox, min = MIN_BOX_MM): PaperBox {
  const maxW = Math.max(min, inner.x1 - inner.x0);
  const maxH = Math.max(min, inner.y1 - inner.y0);
  const w = Math.min(Math.max(min, b.w), maxW);
  const h = Math.min(Math.max(min, b.h), maxH);
  const x = Math.min(Math.max(b.x, inner.x0), Math.max(inner.x0, inner.x1 - w));
  const y = Math.min(Math.max(b.y, inner.y0), Math.max(inner.y0, inner.y1 - h));
  return { x, y, w, h };
}

/** Vista sob o ponto: a última da lista (a que está por cima), com tolerância em mm. */
export function hitBox(boxes: readonly { id: string; box: PaperBox }[], p: PaperPoint, padMm = 0): string | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const { id, box } = boxes[i]!;
    if (p.x >= box.x - padMm && p.x <= box.x + box.w + padMm && p.y >= box.y - padMm && p.y <= box.y + box.h + padMm) return id;
  }
  return null;
}

/** A caixa contém o ponto? (sem tolerância) */
export const boxHas = (b: PaperBox, p: PaperPoint): boolean => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
