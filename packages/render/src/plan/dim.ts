import { hexToRgb, mix, rgbToHex } from './color.ts';
import type { FillOp, LabelOp, PlanOps, StrokeOp } from './types.ts';

/** Quanto da cor some no fundo: 0 = cor original, 1 = só o fundo. O resto do desenho fica num cinza bem claro. */
export const DIM_AMOUNT = 0.88;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Cor em cinza (luminância) misturada com o fundo; cores que não são hexadecimais passam sem mudança. */
export function dimColor(color: string, bg: string): string {
  if (!HEX.test(color) || !HEX.test(bg)) return color;
  const [r, g, b] = hexToRgb(color);
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return mix(rgbToHex(y, y, y), bg, DIM_AMOUNT);
}

const dimFill = (f: FillOp, bg: string): FillOp => ({ ...f, color: dimColor(f.color, bg), ...(f.hatch ? { hatch: { ...f.hatch, color: dimColor(f.hatch.color, bg) } } : {}) });
const dimStroke = (s: StrokeOp, bg: string): StrokeOp => ({ ...s, color: dimColor(s.color, bg) });
const dimLabel = (l: LabelOp): LabelOp => ({ ...l, tone: 'soft' });

/**
 * Desenho da planta em tom cinza bem claro, como o Revit faz enquanto se desenha o perímetro: o esboço (que não passa
 * por aqui) fica em cor cheia e se destaca. Só as cores mudam; a geometria e os limiares de zoom ficam como estão.
 */
export function dimPlanOps(o: PlanOps, bg: string): PlanOps {
  return { ...o, fills: o.fills.map((f) => dimFill(f, bg)), strokes: o.strokes.map((s) => dimStroke(s, bg)), labels: o.labels.map(dimLabel) };
}
