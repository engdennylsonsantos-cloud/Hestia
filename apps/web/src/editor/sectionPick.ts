import { pickSection, screenToWorld, type SectionPick } from '@hestia/render';
import { editor } from './controller.ts';
import { useUi } from './state.ts';

/** Tolerância de clique no corte e na elevação, em pixels de tela (decisão 0016). */
const TOLERANCE_PX = 4;

/** Ponto em pixels, relativo ao canvas. */
export interface ScreenPt {
  x: number;
  y: number;
}

/**
 * Elemento sob o ponto da tela na vista de corte ou elevação aberta (decisão 0016). A tolerância de 4 px vira unidades
 * do desenho (metros) pelo zoom. Null fora do desenho ou no vazio.
 */
export function sectionPickAt(s: ScreenPt): SectionPick | null {
  const v = editor.viewport();
  const result = editor.sectionOf(useUi.getState().sectionId);
  if (!v || !result) return null;
  return pickSection(result, screenToWorld(v, s), TOLERANCE_PX / v.zoom);
}

let frame = 0;
let last: ScreenPt | null = null;

/** Realce ao passar o cursor sobre o corte: um pick por quadro de animação (o último ponto ganha), como no 3D. */
export function hoverSectionAt(s: ScreenPt): void {
  last = s;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (!last || useUi.getState().view !== 'section') return;
    const id = sectionPickAt(last)?.id ?? null;
    if (useUi.getState().hover !== id) useUi.setState({ hover: id });
  });
}
