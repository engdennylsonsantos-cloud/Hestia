import { add, boxOf, dist, mul, norm, rotate, sub, type Vec2 } from '@hestia/geom';
import type { SlabSlope } from '@hestia/model';
import type { PreviewItem } from './types.ts';

/** Maior inclinação aceita, em módulo (100 % = 45°). */
export const SLOPE_LIMIT = 100;

/** Comprimento da seta do caimento: um quarto da diagonal da caixa da laje, entre 0,5 m e 3 m. */
export function slopeArrowLength(boundary: Vec2[]): number {
  const b = boxOf(boundary);
  return Math.min(3, Math.max(0.5, Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 4));
}

/** Percentual para texto: "5,0 %". */
export const fmtPercent = (v: number): string => `${v.toFixed(1).replace('.', ',')} %`;

/** Erro do percentual (não finito ou acima do limite), ou null quando é aceito. */
export function slopeError(percent: number): string | null {
  if (!Number.isFinite(percent)) return 'Inclinação inválida: digite um número.';
  if (Math.abs(percent) > SLOPE_LIMIT) return `Inclinação acima de ${SLOPE_LIMIT} %: confira o valor.`;
  return null;
}

/** Inclinação com origem em `o` e direção para `d`; null quando os dois pontos coincidem. */
export function slopeFrom(o: Vec2, d: Vec2, percent: number): SlabSlope | null {
  if (dist(o, d) < 1e-6) return null;
  return { origin: o, dir: norm(sub(d, o)), percent };
}

/**
 * Prévia da linha de caimento: seta tracejada a partir da origem, na direção do caimento, com o percentual
 * ao lado da seta. `length` é o comprimento da seta em metros (ajustado à laje pela ferramenta).
 */
export function slopePreview(slope: Pick<SlabSlope, 'origin' | 'dir' | 'percent'>, length: number): PreviewItem[] {
  const a = slope.origin;
  const b = add(a, mul(slope.dir, length));
  const head = length * 0.12;
  const back = mul(slope.dir, -head);
  const wing1 = add(b, rotate(back, 0.5));
  const wing2 = add(b, rotate(back, -0.5));
  const mid = add(a, mul(slope.dir, length / 2));
  return [
    { kind: 'line', a, b, dashed: true },
    { kind: 'line', a: b, b: wing1 },
    { kind: 'line', a: b, b: wing2 },
    { kind: 'label', at: mid, text: fmtPercent(slope.percent) },
  ];
}
