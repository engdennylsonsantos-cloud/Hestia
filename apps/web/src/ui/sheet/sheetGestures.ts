import { snapMove, type SnapGuide, type SnapLine } from './sheetSnap.ts';
import { clampBoxToInner, resizeBox, type HandleId, type InnerBox, type PaperBox, type PaperPoint } from './sheetSelection.ts';

/**
 * Gestos do palco da prancha em mm de papel. O mesmo cálculo (`resolveGesture`) vale para a prévia durante o
 * `pointermove` e para o commit no `pointerup`: assim o que aparece na tela é exatamente o que é gravado — sem o "pulo"
 * de ler um estado do React que ainda não renderizou.
 */

export type SheetGesture =
  | { kind: 'pan'; last: { x: number; y: number } }
  | { kind: 'move'; ids: string[]; start: Record<string, PaperBox>; grab: PaperPoint; box: PaperBox; clicked: string; guides: SnapGuide[] }
  | { kind: 'resize'; id: string; handle: HandleId; grab: PaperPoint; start: PaperBox; box: PaperBox }
  | { kind: 'content'; id: string; grab: PaperPoint; start: PaperPoint; offset: PaperPoint };

export interface GestureContext {
  inner: InnerBox;
  /** Caixas das vistas que NÃO estão no gesto (alvos de encaixe). */
  others: readonly PaperBox[];
  /** Linhas do desenho (faces/eixos) para o encaixe. */
  lines?: readonly SnapLine[];
  snapOn: boolean;
  /** Passo da grade em mm (só quando a grade está ligada). */
  gridStep?: number;
  /** Px de tela por mm de papel: converte a tolerância de 6 px. */
  zoom: number;
  shift: boolean;
}

/** Próximo estado do gesto a partir do ponto do ponteiro. `pan` não muda aqui (usa coordenadas de tela). */
export function resolveGesture(g: SheetGesture, pt: PaperPoint, ctx: GestureContext): SheetGesture {
  if (g.kind === 'pan') return g;
  if (g.kind === 'move') {
    const first = g.start[g.ids[0]!];
    if (!first) return g;
    const raw = { ...first, x: first.x + (pt.x - g.grab.x), y: first.y + (pt.y - g.grab.y) };
    const sn =
      ctx.snapOn && g.ids.length === 1
        ? snapMove(raw, { boxes: ctx.others, inner: ctx.inner, step: ctx.gridStep, ...(ctx.lines?.length ? { lines: ctx.lines } : {}) }, { tolMm: 6 / Math.max(1e-9, ctx.zoom) })
        : { box: raw, guides: [] as SnapGuide[] };
    return { ...g, box: clampBoxToInner(sn.box, ctx.inner), guides: sn.guides };
  }
  if (g.kind === 'resize') {
    const next = resizeBox(g.start, g.handle, { x: pt.x - g.grab.x, y: pt.y - g.grab.y }, ctx.shift);
    return { ...g, box: clampBoxToInner(next, ctx.inner) };
  }
  return { ...g, offset: { x: g.start.x + (pt.x - g.grab.x), y: g.start.y + (pt.y - g.grab.y) } };
}

/** Caixas de destino de um gesto de mover (a primeira é a que recebeu o encaixe; as demais seguem o mesmo delta). */
export function movedBoxes(g: Extract<SheetGesture, { kind: 'move' }>): Record<string, PaperBox> {
  const first = g.start[g.ids[0]!];
  const out: Record<string, PaperBox> = {};
  if (!first) return out;
  const dx = g.box.x - first.x;
  const dy = g.box.y - first.y;
  for (const id of g.ids) {
    const st = g.start[id];
    if (st) out[id] = { ...st, x: st.x + dx, y: st.y + dy };
  }
  return out;
}
