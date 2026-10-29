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

/** Distância (px) entre dois pontos de tela. */
const gap = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

const within = (rect: ScreenRect, p: Vec2, clearance: number): boolean =>
  p.x >= rect.x - clearance && p.x <= rect.x + rect.w + clearance && p.y >= rect.y - clearance && p.y <= rect.y + rect.h + clearance;

/**
 * Prioridade geral de alvos de clique da sobreposição, do mais forte ao mais fraco:
 * alça de vértice do elemento > alça de referência da cota > valor da cota > botão "I" > canvas. A alça de vértice vence
 * por construção: ponta de cota com uma só referência não ganha alça (ver `viewOfDim`), então nada a cobre.
 * Durante a prévia de uma ferramenta, só o que cobre a ponta viva da cota (a que está sob o cursor) é do canvas: é o ponto
 * onde o usuário clica para fechar o traço. Valor e "I" que não cobrem o cursor são da sobreposição (clicar neles nunca
 * cria geometria); `clearance` 0 exige o cursor dentro do retângulo, folga maior serve às alças (imã).
 * Fora da prévia (seleção), o elemento sempre captura.
 *
 * @param liveEnds pontas da cota em pixels de tela; o clique só passa ao canvas se o cursor estiver junto de uma delas.
 */
export function capturesPointer(rect: ScreenRect, cursor: Vec2 | null, previewing: boolean, liveEnds: ReadonlyArray<Vec2> = [], clearance = CURSOR_CLEARANCE_PX): boolean {
  if (!previewing || !cursor) return true;
  if (!within(rect, cursor, clearance)) return true;
  return !liveEnds.some((end) => gap(end, cursor) <= clearance);
}

/**
 * Só o botão principal é engolido pela sobreposição (clicar na alça, no texto ou no "I"). Botão do meio e direito
 * seguem para o canvas: iniciam o pan e o menu mesmo com o cursor sobre uma cota.
 */
export const swallowsPointerButton = (button: number): boolean => button === 0;

/** Alcance (px) em que o cursor, saído da prévia, ainda está a caminho do valor ou do "I" da última cota. */
export const HOLD_REACH_PX = 80;

/**
 * Mantém a última prévia de cotas enquanto o cursor vai da prévia (ex.: sobre a parede) até um valor ou o "I": ao sair
 * do hospedeiro a ferramenta zera a prévia, e sem isto o "I" sumiria antes do clique.
 */
export function holdsLastPreview(currentCount: number, lastRects: ReadonlyArray<ScreenRect>, cursor: Vec2 | null, reach = HOLD_REACH_PX): boolean {
  if (currentCount > 0 || !cursor) return false;
  return lastRects.some((r) => within(r, cursor, reach));
}
