import { add, dist, mul, norm, perp, sub, type Vec2 } from '@hestia/geom';
import type { SectionView } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import type { FillOp, LabelOp, PlanTheme, StrokeOp } from './types.ts';

/** Marca de corte ou elevação. `dashed` é a pré-visualização da ferramenta; `elevation` troca o traço-ponto por linha contínua. */
export interface MarkSpec {
  a: Vec2;
  b: Vec2;
  label?: string;
  dashed?: boolean;
  elevation?: boolean;
}

export interface MarkOps {
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
}

/** Traço, vão, ponto, vão (pixels de tela). O renderizador só conhece um padrão de dois valores, então o traço-ponto vira segmentos. */
const DASH_DOT_PX = [14, 3, 1.5, 3];
const MAX_SEGMENTS = 2000;

/** Traço-ponto ao longo de a→b. Devolve null quando o padrão não cabe no limite (a linha sai contínua). */
function dashDotSegments(a: Vec2, b: Vec2, metersPerPx: number): Array<[Vec2, Vec2]> | null {
  const total = dist(a, b);
  const u = norm(sub(b, a));
  const out: Array<[Vec2, Vec2]> = [];
  let t = 0;
  let i = 0;
  while (t < total) {
    if (out.length >= MAX_SEGMENTS) return null;
    const step = DASH_DOT_PX[i % 4]! * metersPerPx;
    const end = Math.min(total, t + step);
    if (i % 4 === 0 || i % 4 === 2) out.push([add(a, mul(u, t)), add(a, mul(u, end))]);
    t += step;
    i++;
  }
  return out;
}

/**
 * Linha de corte/elevação em planta: traço-ponto (corte) ou contínua (elevação), com seta curta em cada extremidade
 * apontando para o lado de visão (esquerda de a→b) e o nome nas duas pontas.
 */
export function sectionMarkOps(m: MarkSpec, v: Viewport, theme: PlanTheme): MarkOps {
  const out: MarkOps = { fills: [], strokes: [], labels: [] };
  if (dist(m.a, m.b) < 1e-9) return out;
  const k = 1 / v.zoom;
  const u = norm(sub(m.b, m.a));
  const n = perp(u);
  const color = m.dashed ? theme.accent : theme.ink;

  if (m.dashed) {
    out.strokes.push({ pts: [m.a, m.b], closed: false, widthPx: 1.5, color, alpha: 0.95, dash: [7, 5] });
  } else if (m.elevation) {
    out.strokes.push({ pts: [m.a, m.b], closed: false, widthPx: 1, color: theme.inkSoft, alpha: 1 });
  } else {
    const segs = dashDotSegments(m.a, m.b, k) ?? [[m.a, m.b] as [Vec2, Vec2]];
    for (const [p, q] of segs) out.strokes.push({ pts: [p, q], closed: false, widthPx: 1.2, color, alpha: 0.9 });
  }

  for (const e of [m.a, m.b]) {
    const stem = add(e, mul(n, 18 * k));
    const tip = add(e, mul(n, 28 * k));
    out.strokes.push({ pts: [e, stem], closed: false, widthPx: 1.2, color, alpha: 1 });
    out.fills.push({ polygons: [[[add(stem, mul(u, 5 * k)), tip, add(stem, mul(u, -5 * k))]]], color, alpha: 1 });
    if (m.label && !m.dashed) out.labels.push({ at: tip, text: m.label, dx: 6, dy: -6, tone: m.elevation ? 'info' : 'accent' });
  }
  return out;
}

/** Todas as marcas de cortes e elevações do projeto, para a planta. */
export function sectionMarksOf(views: SectionView[], v: Viewport, theme: PlanTheme): MarkOps {
  const out: MarkOps = { fills: [], strokes: [], labels: [] };
  for (const view of views) {
    const m = sectionMarkOps({ a: view.a, b: view.b, label: view.name, elevation: view.kind === 'elevation' }, v, theme);
    out.fills.push(...m.fills);
    out.strokes.push(...m.strokes);
    out.labels.push(...m.labels);
  }
  return out;
}
