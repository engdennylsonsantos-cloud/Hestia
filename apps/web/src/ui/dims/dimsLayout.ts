import type { Vec2 } from '@hestia/geom';
import type { ScreenRect } from './dimsHit.ts';

/** Tamanho (px) do campo do valor da cota e do botão "I". */
export const VALUE_BOX = { w: 62, h: 22 } as const;
export const CONVERT_SIZE = 22;
const GAP = 4;

const overlaps = (a: ScreenRect, b: ScreenRect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Retângulo do campo do valor centrado em `textAt`. */
export const valueRect = (textAt: Vec2): ScreenRect => ({ x: textAt.x - VALUE_BOX.w / 2, y: textAt.y - VALUE_BOX.h / 2, w: VALUE_BOX.w, h: VALUE_BOX.h });

/**
 * Posição do botão "I" ao lado do primeiro valor, fora de qualquer outro campo ou alça: tenta à direita, à esquerda,
 * acima e abaixo; em trechos curtos, onde os campos se encostam, o "I" nunca cobre um valor. Sem lugar livre, sobe
 * até achar (nunca fica sobre um campo).
 */
export function placeConvertButton(anchor: ScreenRect, avoid: ReadonlyArray<ScreenRect>): ScreenRect {
  const s = CONVERT_SIZE;
  const centerY = anchor.y + anchor.h / 2 - s / 2;
  const candidates: ScreenRect[] = [
    { x: anchor.x + anchor.w + GAP, y: centerY, w: s, h: s },
    { x: anchor.x - GAP - s, y: centerY, w: s, h: s },
    { x: anchor.x + anchor.w / 2 - s / 2, y: anchor.y - GAP - s, w: s, h: s },
    { x: anchor.x + anchor.w / 2 - s / 2, y: anchor.y + anchor.h + GAP, w: s, h: s },
  ];
  const free = (r: ScreenRect): boolean => !avoid.some((o) => overlaps(r, o));
  const found = candidates.find(free);
  if (found) return found;
  let up = candidates[2]!;
  while (!free(up)) up = { ...up, y: up.y - s - GAP };
  return up;
}
