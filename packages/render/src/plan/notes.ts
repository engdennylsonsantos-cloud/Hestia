import { dimensionGeometry, dimensionPoints, dimensionValue, DIM_TEXT_MM, formatDimensionValue, levelDimensions, levelRoomSeparators, levelTexts, paperMmToPx, type Id, type Project } from '@hestia/model';
import { noteLabel } from './tags.ts';
import type { PlanPaint } from './style.ts';
import type { LabelOp, StrokeOp } from './types.ts';

/** Cores e seleção para desenhar as anotações. */
export interface NoteLook {
  ink: string;
  select: string;
  selection: Id[];
}

/** Espessura relativa das linhas de separação selecionadas (um pouco maior que a normal, traço mantido). */
const SEPARATOR_SELECTED_WIDTH = 1.5;

export interface NoteOps {
  strokes: StrokeOp[];
  labels: LabelOp[];
}

/**
 * Cotas e textos do nível na planta (decisão 0019). Só desenha com a categoria 'annotation' visível; a espessura é a de
 * corte dela. O texto do valor sai centrado acima da linha de cota, com o tamanho de `DIM_TEXT_MM` em papel.
 */
export function noteOps(p: Project, levelId: Id, pt: PlanPaint, look: NoteLook, zoom: number, scale: number): NoteOps {
  const out: NoteOps = { strokes: [], labels: [] };
  if (!pt.visible) return out;
  const color = pt.color ?? look.ink;
  const picked = (id: Id): boolean => look.selection.includes(id);
  const mPerMm = scale / 1000;
  const fontPx = paperMmToPx(DIM_TEXT_MM, zoom, scale);
  for (const d of levelDimensions(p, levelId)) {
    const { a, b } = dimensionPoints(p, d);
    const g = dimensionGeometry(a, b, d.offset, mPerMm);
    const c = picked(d.id) ? look.select : color;
    for (const seg of [g.line, ...g.extensions, ...g.ticks]) out.strokes.push({ pts: [...seg], closed: false, widthPx: pt.cutPx, color: c, alpha: 1 });
    out.labels.push(noteLabel(g.textAt, formatDimensionValue(dimensionValue(p, d)), fontPx, g.textRotation));
  }
  for (const t of levelTexts(p, levelId)) out.labels.push(noteLabel(t.at, t.text, paperMmToPx(t.height, zoom, scale), t.rotation));
  out.strokes.push(...roomSeparatorStrokes(p, levelId, pt, color, new Set(look.selection), look.select));
  return out;
}

/**
 * Linhas de separação de ambiente do nível (tracejadas e finas, como o Revit). Usam a cor e a espessura de projeção da
 * categoria 'anotação' e o traço das membranas. Só o nível pedido: a planta de outro nível não as recebe.
 */
export function roomSeparatorStrokes(p: Project, levelId: Id, pt: PlanPaint, color: string, selected: ReadonlySet<Id> = new Set(), select: string = color): StrokeOp[] {
  if (!pt.visible) return [];
  return levelRoomSeparators(p, levelId).map((r) => {
    const picked = selected.has(r.id);
    return { pts: [r.a, r.b], closed: false, widthPx: picked ? pt.projPx * SEPARATOR_SELECTED_WIDTH : pt.projPx, color: picked ? select : color, alpha: 1, dash: [6, 3] as [number, number] };
  });
}
