import type { Vec2 } from '@hestia/geom';

/** Retângulo de tela (pixels) de um elemento da sobreposição de cotas. */
export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Folga em volta do elemento: cobre a distância entre o cursor e o ponto com imã (snap) que a cota segue. */
export const CURSOR_CLEARANCE_PX = 12;

/** Quadrado de lado `size` centrado em `at` (alças e botões). */
export const rectAround = (at: Vec2, size: number): ScreenRect => ({ x: at.x - size / 2, y: at.y - size / 2, w: size, h: size });

/**
 * O elemento da sobreposição captura o ponteiro? Durante a prévia de uma ferramenta, a cota segue o cursor: as alças
 * da ponta viva e o texto ficam debaixo dele e engoliam o clique que fecha a parede. Então, enquanto o cursor está
 * sobre o elemento (com folga), o clique é do canvas. Fora da prévia (seleção), o elemento sempre captura.
 */
export function capturesPointer(rect: ScreenRect, cursor: Vec2 | null, previewing: boolean, clearance = CURSOR_CLEARANCE_PX): boolean {
  if (!previewing || !cursor) return true;
  const inside = cursor.x >= rect.x - clearance && cursor.x <= rect.x + rect.w + clearance && cursor.y >= rect.y - clearance && cursor.y <= rect.y + rect.h + clearance;
  return !inside;
}

/**
 * Só o botão principal é engolido pela sobreposição (clicar na alça, no texto ou no "I"). Botão do meio e direito
 * seguem para o canvas: iniciam o pan e o menu mesmo com o cursor sobre uma cota.
 */
export const swallowsPointerButton = (button: number): boolean => button === 0;
