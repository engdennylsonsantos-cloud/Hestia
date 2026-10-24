import { dist, type Vec2 } from '@hestia/geom';
import {
  paperMmToPx,
  sectionLabelOf,
  sectionMarkGeometry,
  sectionPoints,
  SECTION_TEXT_MM,
  type Id,
  type Project,
  type SectionMarkStyle,
} from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import type { PlanPaint } from './style.ts';
import type { FillOp, LabelOp, PlanTheme, StrokeOp } from './types.ts';

/** Marca de corte ou elevação. `dashed` é a pré-visualização da ferramenta. */
export interface MarkSpec {
  a: Vec2;
  b: Vec2;
  label?: string;
  dashed?: boolean;
  elevation?: boolean;
  /** Aparência configurada na vista; ausente = padrão. */
  mark?: SectionMarkStyle;
  selected?: boolean;
}

export interface MarkOps {
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
}

export interface MarkLook {
  color: string;
  widthPx: number;
  fontPx: number;
  selectColor: string;
  /** Denominador da escala da vista (1:100 → 100). */
  scale: number;
}

const EMPTY: MarkOps = { fills: [], strokes: [], labels: [] };

/**
 * Linha de corte/elevação em planta: traço-ponto (corte) ou contínua (elevação), com seta curta em cada extremidade
 * apontando para o lado de visão (esquerda de a→b) e o rótulo nas pontas. A geometria nasce em mm de papel
 * (`sectionMarkGeometry`), então a marca tem o mesmo tamanho na tela e na prancha.
 */
export function sectionMarkOps(m: MarkSpec, v: Viewport, theme: PlanTheme, look?: Partial<MarkLook>): MarkOps {
  if (dist(m.a, m.b) < 1e-9) return EMPTY;
  const scale = look?.scale ?? 100;
  const mPerMm = scale / 1000;
  const label = m.dashed ? undefined : m.label;
  const g = sectionMarkGeometry(m.a, m.b, m.elevation ? 'elevation' : 'section', label, mPerMm, m.mark, m.dashed);
  const color = m.dashed ? theme.accent : m.selected ? look?.selectColor ?? theme.select : look?.color ?? theme.ink;
  const widthPx = look?.widthPx ?? (m.dashed ? 1.5 : m.elevation ? 1 : 1.2);
  const fontPx = look?.fontPx ?? paperMmToPx(SECTION_TEXT_MM, v.zoom, scale);
  const out: MarkOps = { fills: [], strokes: [], labels: [] };
  for (const [a, b] of g.segments) out.strokes.push({ pts: [a, b], closed: false, widthPx, color, alpha: m.dashed ? 0.95 : 1 });
  for (const ring of g.arrows) out.fills.push({ polygons: [[ring]], color, alpha: 1 });
  for (const l of g.labels) out.labels.push({ at: l.at, text: l.text, fontPx, rotation: l.rotation, center: true, tone: m.elevation ? 'info' : 'accent' });
  return out;
}

/**
 * Todas as marcas de cortes e elevações do projeto, para a planta. A categoria `annotation` manda na visibilidade,
 * cor e espessura; a vista selecionada sai na cor de seleção.
 */
export function sectionMarksOf(
  p: Pick<Project, 'views' | 'elements'>,
  v: Viewport,
  theme: PlanTheme,
  paint: PlanPaint,
  scale: number,
  selection: Id[] = [],
): MarkOps {
  const out: MarkOps = { fills: [], strokes: [], labels: [] };
  if (!paint.visible) return out;
  for (const view of p.views) {
    if (view.mark?.visible === false) continue;
    const pts = sectionPoints(p, view);
    const m = sectionMarkOps(
      { a: pts.a, b: pts.b, label: sectionLabelOf(view), elevation: view.kind === 'elevation', mark: view.mark, selected: selection.includes(view.id) },
      v,
      theme,
      {
        color: paint.color ?? theme.ink,
        widthPx: paint.cutPx,
        fontPx: paperMmToPx(view.mark?.textMm ?? SECTION_TEXT_MM, v.zoom, scale),
        selectColor: theme.select,
        scale,
      },
    );
    out.fills.push(...m.fills);
    out.strokes.push(...m.strokes);
    out.labels.push(...m.labels);
  }
  return out;
}
