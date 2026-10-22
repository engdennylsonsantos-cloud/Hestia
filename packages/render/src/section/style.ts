import {
  GRAPHICS_CATEGORIES,
  PLAN_VISUAL_STYLES,
  detailOf,
  graphicsOf,
  lineWeightMm,
  paperMmToPx,
  sectionGraphicsOf,
  type CategoryOverride,
  type GraphicsCategory,
  type Project,
  type ProjectGraphics,
  type VisualStyle,
} from '@hestia/model';
import type { PlanPaint, PlanStyle, PlanVisual } from '../plan/style.ts';

/** Gráficos do corte/elevação resolvidos para o desenho (as larguras já em px de tela no zoom corrente). */
export interface SectionStyle extends PlanStyle {
  /** A vista tem `sectionGraphics` salvo: os pesos valem; sem ele, o desenho mantém os traços fixos de antes. */
  saved: boolean;
}

const isPlanVisual = (v: VisualStyle): v is PlanVisual => (PLAN_VISUAL_STYLES as readonly VisualStyle[]).includes(v);

function paintOf(gp: ProjectGraphics, c: GraphicsCategory, ov: CategoryOverride, zoom: number, scale: number, visual: PlanVisual): PlanPaint {
  const base = gp.categories[c];
  const px = (weight: number): number => paperMmToPx(lineWeightMm(gp.lineWeights, weight, scale), zoom, scale);
  return {
    visible: ov.visible,
    visual,
    color: ov.color ?? null,
    halftone: ov.halftone,
    alpha: 1 - ov.transparency,
    cutPx: px(ov.cutWeight ?? base.cutWeight),
    projPx: px(ov.projectionWeight ?? base.projectionWeight),
  };
}

/**
 * Gráficos do corte/elevação: escala, detalhe, estilo visual e substituições por categoria. Como a vista cruza níveis,
 * as configurações ficam em `Project.sectionGraphics` (decisão 0015); sem o campo salvo, o detalhe é o do projeto
 * (`settings.detail`) e o desenho mantém os traços fixos anteriores à decisão.
 */
export function sectionStyleOf(p: Project, zoom: number): SectionStyle {
  const g = sectionGraphicsOf(p);
  const gp = graphicsOf(p);
  const visual: PlanVisual = isPlanVisual(g.style) ? g.style : 'hiddenLine';
  const saved = p.sectionGraphics !== undefined;
  const detail = saved ? detailOf(g, gp) : (p.settings.detail ?? 'medium');
  const paint = {} as Record<GraphicsCategory, PlanPaint>;
  for (const c of GRAPHICS_CATEGORIES) paint[c] = paintOf(gp, c, g.overrides[c], zoom, g.scale, visual);
  return { saved, scale: g.scale, detail, visual, partial: g.partialStructure, paint };
}
