import { arcFromSagitta, arcSample, orientedRect, perp, sub, norm, add, mul, type Vec2 } from '@hestia/geom';
import type { Guide, Inference, PreviewItem, StairTone } from '@hestia/tools';
import { sectionMarkOps } from './sectionMarks.ts';
import type { FillOp, LabelOp, PlanTheme, StrokeOp } from './types.ts';
import type { Viewport } from '../viewport.ts';

export interface Overlay {
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
}

const px = (v: Viewport, n: number): number => n / v.zoom;

function squareAt(c: Vec2, half: number): Vec2[] {
  return [
    { x: c.x - half, y: c.y - half },
    { x: c.x + half, y: c.y - half },
    { x: c.x + half, y: c.y + half },
    { x: c.x - half, y: c.y + half },
  ];
}

/** Marcador de captura: a forma diz qual regra foi usada (extremidade, meio, interseção…). */
export function snapMarker(inf: Inference, v: Viewport, theme: PlanTheme): StrokeOp[] {
  const c = inf.point;
  const h = px(v, 6);
  const mk = (pts: Vec2[], closed: boolean): StrokeOp => ({ pts, closed, widthPx: 2, color: theme.accent, alpha: 1 });
  switch (inf.kind) {
    case 'endpoint':
      return [mk(squareAt(c, h), true)];
    case 'face':
      // Canto de face: quadrado com ponto central (diferencia do extremo do eixo).
      return [mk(squareAt(c, h), true), mk([{ x: c.x - h * 0.2, y: c.y }, { x: c.x + h * 0.2, y: c.y }], false)];
    case 'core':
      return [mk([{ x: c.x, y: c.y - h * 1.2 }, { x: c.x + h * 1.2, y: c.y }, { x: c.x, y: c.y + h * 1.2 }, { x: c.x - h * 1.2, y: c.y }], true)];
    case 'midpoint':
      return [mk([{ x: c.x - h, y: c.y - h }, { x: c.x + h, y: c.y - h }, { x: c.x, y: c.y + h }], true)];
    case 'intersection':
      return [mk([{ x: c.x - h, y: c.y - h }, { x: c.x + h, y: c.y + h }], false), mk([{ x: c.x - h, y: c.y + h }, { x: c.x + h, y: c.y - h }], false)];
    case 'perpendicular':
      return [mk([{ x: c.x - h, y: c.y + h }, { x: c.x - h, y: c.y - h }, { x: c.x + h, y: c.y - h }], false)];
    case 'nearest':
      return [mk([{ x: c.x - h * 0.8, y: c.y - h }, { x: c.x + h * 0.8, y: c.y - h }, { x: c.x - h * 0.8, y: c.y + h }, { x: c.x + h * 0.8, y: c.y + h }], true)];
    case 'alignment':
      return [mk([{ x: c.x - h * 0.7, y: c.y - h * 0.7 }, { x: c.x + h * 0.7, y: c.y + h * 0.7 }], false), mk([{ x: c.x - h * 0.7, y: c.y + h * 0.7 }, { x: c.x + h * 0.7, y: c.y - h * 0.7 }], false)];
    case 'grid':
      return [{ pts: [{ x: c.x - h * 0.6, y: c.y }, { x: c.x + h * 0.6, y: c.y }], closed: false, widthPx: 1.2, color: theme.accent, alpha: 0.9 }, { pts: [{ x: c.x, y: c.y - h * 0.6 }, { x: c.x, y: c.y + h * 0.6 }], closed: false, widthPx: 1.2, color: theme.accent, alpha: 0.9 }];
    default:
      return [];
  }
}

export function guideStrokes(guides: Guide[], theme: PlanTheme): StrokeOp[] {
  return guides.map((g) => ({
    pts: [g.from, g.to],
    closed: false,
    widthPx: 1,
    color: g.kind === 'perpendicular' ? theme.accent : theme.guide,
    alpha: 0.9,
    dash: [6, 4] as [number, number],
  }));
}

function bandRing(a: Vec2, b: Vec2, thickness: number, sMid: number, sag = 0): Vec2[] {
  const arc = arcFromSagitta(a, b, sag);
  if (arc) {
    const lo = arcSample(arc, 0, arc.length, sMid - thickness / 2);
    const hi = arcSample(arc, arc.length, 0, sMid + thickness / 2);
    return [...lo, ...hi];
  }
  const u = norm(sub(b, a));
  const n = perp(u);
  const lo = sMid - thickness / 2;
  const hi = sMid + thickness / 2;
  const p = (base: Vec2, s: number): Vec2 => add(base, mul(n, s));
  return [p(a, lo), p(b, lo), p(b, hi), p(a, hi)];
}

/** Cor de um tom da prévia da escada; sem tom, a cor de destaque da ferramenta. */
export function toneColor(tone: StairTone | undefined, theme: PlanTheme): string {
  switch (tone) {
    case 'boundary':
      return theme.stairBoundary;
    case 'riser':
      return theme.stairRiser;
    case 'path':
      return theme.stairPath;
    case 'landing':
      return theme.stairLanding;
    case 'tread':
      return theme.stairTread;
    default:
      return theme.accent;
  }
}

/** Pré-visualização da ferramenta ativa. Itens com tom (escada) usam a cor do tom; os demais, a de destaque. */
export function previewOverlay(items: PreviewItem[], v: Viewport, theme: PlanTheme, highlight: (ids: string[]) => FillOp[]): Overlay {
  const o: Overlay = { fills: [], strokes: [], labels: [] };
  for (const it of items) {
    switch (it.kind) {
      case 'line':
        o.strokes.push({ pts: [it.a, it.b], closed: false, widthPx: 1.5, color: toneColor(it.tone, theme), alpha: 0.95, dash: it.dashed ? [7, 5] : undefined });
        break;
      case 'polygon':
        if (it.tone === 'tread') {
          // Degraus calculados: preenchimento translúcido e contorno fino, sem competir com os limites e espelhos.
          o.fills.push({ polygons: [[it.ring]], color: theme.stairTread, alpha: 0.2 });
          o.strokes.push({ pts: it.ring, closed: true, widthPx: 1, color: theme.stairTread, alpha: 0.9, dash: it.dashed ? [7, 5] : undefined });
          break;
        }
        o.fills.push({ polygons: [[it.ring]], color: toneColor(it.tone, theme), alpha: 0.14 });
        o.strokes.push({ pts: it.ring, closed: true, widthPx: 1.5, color: toneColor(it.tone, theme), alpha: 0.95, dash: it.dashed ? [7, 5] : undefined });
        break;
      case 'wallBand': {
        const ring = bandRing(it.a, it.b, it.thickness, it.sMid, it.sag);
        const arcAxis = arcFromSagitta(it.a, it.b, it.sag ?? 0);
        const axis = arcAxis ? arcSample(arcAxis, 0, arcAxis.length) : [it.a, it.b];
        o.fills.push({ polygons: [[ring]], color: theme.accent, alpha: 0.18 });
        o.strokes.push({ pts: ring, closed: true, widthPx: 1.5, color: theme.accent, alpha: 0.95 });
        o.strokes.push({ pts: axis, closed: false, widthPx: 1, color: theme.accent, alpha: 0.7, dash: [8, 5] });
        break;
      }
      case 'label':
        o.labels.push({ at: it.at, text: it.text, dx: 10, dy: -14, tone: 'accent' });
        break;
      case 'point':
        o.strokes.push({ pts: squareAt(it.at, px(v, 3)), closed: true, widthPx: 1.5, color: theme.accent, alpha: 1 });
        break;
      case 'highlight':
        o.fills.push(...highlight(it.ids));
        break;
      case 'sectionLine': {
        const m = sectionMarkOps(it, v, theme);
        o.fills.push(...m.fills);
        o.strokes.push(...m.strokes);
        o.labels.push(...m.labels);
        break;
      }
    }
  }
  return o;
}

export { orientedRect };
