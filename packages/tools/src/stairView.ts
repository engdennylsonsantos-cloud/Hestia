import type { Vec2 } from '@hestia/geom';
import { chainItems, curveItems, partsPreview } from './stairPreview.ts';
import { counterText, type DraftReport, type StairSubmode, type StairTone } from './stairSketchState.ts';
import { strokePreview } from './stairStroke.ts';
import type { DrawState } from './stairDraw.ts';
import type { PreviewItem } from './types.ts';

/** Cor/tom da prévia do traçado em curso, pelo sub-modo. */
export function activeTone(sub: StairSubmode): StairTone {
  if (sub === 'espelhos') return 'riser';
  if (sub === 'caminhada') return 'path';
  if (sub === 'patamar') return 'landing';
  return 'boundary';
}

/**
 * Prévia da ferramenta: componentes (cada camada com o seu tom), degraus calculados, o traçado em curso (tracejado)
 * e o contador ao cursor (em Espelhos, ou quando já há espelhos).
 */
export function buildItems(st: DrawState, q: Vec2, treads: PreviewItem[], rep: DraftReport): PreviewItem[] {
  const tone = activeTone(st.submode);
  const items: PreviewItem[] = [...partsPreview(st.parts), ...treads];
  items.push(...chainItems(st.stroke.chain, tone, true));
  for (const c of strokePreview(st.stroke, q)) items.push(...curveItems(c, tone, true));
  if (st.submode === 'espelhos' || rep.created > 0) items.push({ kind: 'label', at: q, text: counterText(rep) });
  return items;
}

/** Dica do sub-modo (o que fazer agora), com o contador em Espelhos. */
export function hintText(st: Pick<DrawState, 'submode' | 'phase'>, rep: DraftReport): string {
  switch (st.submode) {
    case 'limites':
      return st.phase === 'left' ? 'Limite esquerdo: clique os pontos; Enter fecha e passa ao direito.' : 'Limite direito: clique os pontos; Enter fecha e passa a Espelhos.';
    case 'espelhos':
      return `Espelhos: clique o início e o fim de cada espelho. ${counterText(rep)}.`;
    case 'caminhada':
      return 'Caminhada: clique do primeiro ao último espelho; Enter fecha.';
    case 'patamar':
      return 'Patamar: desenhe um laço fechado (feche no ponto inicial).';
    default:
      return 'Concluir: grava a escada.';
  }
}

/** Primeiro aviso do croqui (não bloqueia Concluir), para a mensagem de gravação. */
export function warningText(rep: DraftReport): string {
  const w = rep.issues.find((i) => i.severity === 'warning');
  return w ? `Aviso: ${w.message} ` : '';
}
