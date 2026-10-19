import type { Viewport } from '../viewport.ts';
import { visibleBounds } from '../viewport.ts';
import type { PlanTheme, StrokeOp } from './types.ts';

const STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];

/** Passo da grade menor visível (≥ ~14 px entre linhas). */
export function visibleGridStep(zoom: number): number {
  return STEPS.find((s) => s * zoom >= 14) ?? 100;
}

export function gridStrokes(v: Viewport, theme: PlanTheme): StrokeOp[] {
  const step = visibleGridStep(v.zoom);
  const b = visibleBounds(v);
  const out: StrokeOp[] = [];
  const major = step * 5;
  const x0 = Math.floor(b.minX / step) * step;
  const y0 = Math.floor(b.minY / step) * step;
  const count = (b.maxX - b.minX) / step + (b.maxY - b.minY) / step;
  if (count > 600) return out;
  for (let x = x0; x <= b.maxX; x += step) {
    const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6;
    out.push({ pts: [{ x, y: b.minY }, { x, y: b.maxY }], closed: false, widthPx: 1, color: isMajor ? theme.gridMajor : theme.gridMinor, alpha: 1 });
  }
  for (let y = y0; y <= b.maxY; y += step) {
    const isMajor = Math.abs(y / major - Math.round(y / major)) < 1e-6;
    out.push({ pts: [{ x: b.minX, y }, { x: b.maxX, y }], closed: false, widthPx: 1, color: isMajor ? theme.gridMajor : theme.gridMinor, alpha: 1 });
  }
  // Eixos de origem.
  out.push({ pts: [{ x: 0, y: b.minY }, { x: 0, y: b.maxY }], closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.5 });
  out.push({ pts: [{ x: b.minX, y: 0 }, { x: b.maxX, y: 0 }], closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.5 });
  return out;
}
