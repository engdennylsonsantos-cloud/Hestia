import type { Viewport } from '../viewport.ts';
import { visibleBounds } from '../viewport.ts';
import type { PlanTheme, StrokeOp } from './types.ts';

const STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];

/** Passo da grade menor visível (≥ ~14 px entre linhas). */
export function visibleGridStep(zoom: number): number {
  return STEPS.find((s) => s * zoom >= 14) ?? 100;
}

/**
 * Linhas da grade, na ordem: verticais (menores, depois maiores), horizontais (menores, depois maiores) e os eixos.
 * Linhas de uma mesma direção não se sobrepõem (estão a pelo menos `step` px de distância, com 1 px de espessura), então
 * agrupá-las por cor não muda a imagem. A ordem entre as direções fica: as horizontais desenham por cima das verticais
 * nos cruzamentos, e os eixos, por último. Assim a grade vira 5 lotes (um por cor e direção, mais os eixos), e não uma
 * malha por troca de cor.
 */
export function gridStrokes(v: Viewport, theme: PlanTheme): StrokeOp[] {
  const step = visibleGridStep(v.zoom);
  const b = visibleBounds(v);
  const major = step * 5;
  const x0 = Math.floor(b.minX / step) * step;
  const y0 = Math.floor(b.minY / step) * step;
  const count = (b.maxX - b.minX) / step + (b.maxY - b.minY) / step;
  if (count > 600) return [];
  const verticaisMenores: StrokeOp[] = [];
  const verticaisMaiores: StrokeOp[] = [];
  const horizontaisMenores: StrokeOp[] = [];
  const horizontaisMaiores: StrokeOp[] = [];
  for (let x = x0; x <= b.maxX; x += step) {
    const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6;
    const linha: StrokeOp = { pts: [{ x, y: b.minY }, { x, y: b.maxY }], closed: false, widthPx: 1, color: isMajor ? theme.gridMajor : theme.gridMinor, alpha: 1 };
    (isMajor ? verticaisMaiores : verticaisMenores).push(linha);
  }
  for (let y = y0; y <= b.maxY; y += step) {
    const isMajor = Math.abs(y / major - Math.round(y / major)) < 1e-6;
    const linha: StrokeOp = { pts: [{ x: b.minX, y }, { x: b.maxX, y }], closed: false, widthPx: 1, color: isMajor ? theme.gridMajor : theme.gridMinor, alpha: 1 };
    (isMajor ? horizontaisMaiores : horizontaisMenores).push(linha);
  }
  // Eixos de origem.
  const eixos: StrokeOp[] = [
    { pts: [{ x: 0, y: b.minY }, { x: 0, y: b.maxY }], closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.5 },
    { pts: [{ x: b.minX, y: 0 }, { x: b.maxX, y: 0 }], closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.5 },
  ];
  return [...verticaisMenores, ...verticaisMaiores, ...horizontaisMenores, ...horizontaisMaiores, ...eixos];
}

/** Área de mundo coberta por uma grade. */
export interface GridCover {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GridLayer {
  strokes: StrokeOp[];
  /** Área que as linhas cobrem: enquanto a vista couber nela, a grade não precisa ser refeita. */
  cover: GridCover;
}

/**
 * Grade da vista com folga de uma tela para cada lado (a mesma `gridStrokes`, sobre uma vista três vezes maior). Se a
 * grade cheia passa do limite de linhas, sai sem folga; se a folga passa e a vista sozinha cabe, sai a da vista.
 */
export function gridLayer(v: Viewport, theme: PlanTheme): GridLayer {
  const exact = gridStrokes(v, theme);
  if (exact.length === 0) return { strokes: [], cover: visibleBounds(v) };
  const wide = { ...v, width: v.width * 3, height: v.height * 3 };
  const padded = gridStrokes(wide, theme);
  if (padded.length > 0) return { strokes: padded, cover: visibleBounds(wide) };
  return { strokes: exact, cover: visibleBounds(v) };
}

/** A vista inteira está dentro da área coberta pela grade (o zoom e o tema são conferidos por quem chama). */
export function gridCovers(layer: GridLayer, v: Viewport): boolean {
  const b = visibleBounds(v);
  const c = layer.cover;
  return b.minX >= c.minX && b.minY >= c.minY && b.maxX <= c.maxX && b.maxY <= c.maxY;
}
