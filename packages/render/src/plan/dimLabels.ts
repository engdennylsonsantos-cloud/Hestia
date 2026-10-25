import { add, mul, norm, perp, sub, type Vec2 } from '@hestia/geom';
import { DIM_GAP_MM, DIM_TEXT_MM, type DimensionGeometry } from '@hestia/model';
import { noteLabel } from './tags.ts';
import type { LabelOp, StrokeOp } from './types.ts';

/** Largura aproximada do valor em px de tela: cerca de 0,6 em por caractere (dígitos, vírgula, espaço e "m"). */
export const valueWidthPx = (text: string, fontPx: number): number => text.length * fontPx * 0.6;

/**
 * Distância do centro do rótulo até a linha de cota, em alturas do texto, para os rótulos afastados. Trechos
 * vizinhos que não cabem alternam entre as duas alturas, então um não cobre o outro.
 */
const LANE_HEIGHTS = [1.6, 3] as const;

export interface DimensionLabelOps {
  labels: LabelOp[];
  strokes: StrokeOp[];
  /** O valor não coube no trecho: o rótulo foi afastado com linha de chamada. */
  short: boolean;
}

/**
 * Rótulo do valor de uma cota. Se o texto cabe no trecho (comprimento em tela `segPx`), sai centrado acima da linha,
 * como antes. Se não cabe, sai afastado da linha, com uma linha de chamada curta do meio da cota até o texto.
 * `lane` é a ordem entre os trechos curtos do nível (alterna as alturas); `zoom` é px por metro.
 */
export function dimensionLabelOps(g: DimensionGeometry, offset: number, text: string, fontPx: number, zoom: number, mPerMm: number, lane: number, color: string, widthPx: number): DimensionLabelOps {
  const segPx = g.length * zoom;
  if (valueWidthPx(text, fontPx) <= segPx) return { labels: [noteLabel(g.textAt, text, fontPx, g.textRotation)], strokes: [], short: false };
  // Lado de fora: a linha de cota fica deslocada dos pontos medidos pelo `offset`, então o rótulo vai para esse mesmo lado.
  const [ta, tb] = g.line;
  const u = norm(sub(tb, ta));
  const out: Vec2 = mul(perp(u), offset >= 0 ? 1 : -1);
  const gap = DIM_GAP_MM * mPerMm;
  const th = DIM_TEXT_MM * mPerMm;
  const mid = mul(add(ta, tb), 0.5);
  const dist = gap + th * LANE_HEIGHTS[lane % LANE_HEIGHTS.length]!;
  const at = add(mid, mul(out, dist));
  const leader = add(mid, mul(out, dist - th / 2));
  return {
    labels: [noteLabel(at, text, fontPx, g.textRotation)],
    strokes: [{ pts: [mid, leader], closed: false, widthPx, color, alpha: 1 }],
    short: true,
  };
}
