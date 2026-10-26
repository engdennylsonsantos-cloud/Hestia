import { hexToRgb, mix, rgbToHex } from './color.ts';
import type { FillOp, LabelOp, PlanOps, StrokeOp } from './types.ts';

/**
 * Quanto da cor some no fundo: 0 = cor original, 1 = só o fundo. O resto do desenho fica num cinza claro, ainda legível
 * como referência (era 0,88, claro demais).
 */
export const DIM_AMOUNT = 0.65;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Valor efetivo do esmaecimento, num só ponto. Os testes de navegador (`?debug=1`) podem definir
 * `window.__hestiaDimAmount` para comparar valores numa mesma construção; fora disso vale `DIM_AMOUNT`.
 */
export function dimAmount(): number {
  const v = (globalThis as unknown as { __hestiaDimAmount?: unknown }).__hestiaDimAmount;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : DIM_AMOUNT;
}

/** Cor em cinza (luminância) misturada com o fundo; cores que não são hexadecimais passam sem mudança. */
export function dimColor(color: string, bg: string, amount: number = dimAmount()): string {
  if (!HEX.test(color) || !HEX.test(bg)) return color;
  const [r, g, b] = hexToRgb(color);
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return mix(rgbToHex(y, y, y), bg, amount);
}

const dimFill = (f: FillOp, bg: string, amount: number): FillOp => ({ ...f, color: dimColor(f.color, bg, amount), ...(f.hatch ? { hatch: { ...f.hatch, color: dimColor(f.hatch.color, bg, amount) } } : {}) });
const dimStroke = (s: StrokeOp, bg: string, amount: number): StrokeOp => ({ ...s, color: dimColor(s.color, bg, amount) });
const dimLabel = (l: LabelOp): LabelOp => ({ ...l, tone: 'soft' });

/**
 * Desenho da planta em tom cinza bem claro, como o Revit faz enquanto se desenha o perímetro: o esboço (que não passa
 * por aqui) fica em cor cheia e se destaca. Só as cores mudam; a geometria e os limiares de zoom ficam como estão.
 */
export function dimPlanOps(o: PlanOps, bg: string, amount: number = dimAmount()): PlanOps {
  return { ...o, fills: o.fills.map((f) => dimFill(f, bg, amount)), strokes: o.strokes.map((s) => dimStroke(s, bg, amount)), labels: o.labels.map(dimLabel) };
}
