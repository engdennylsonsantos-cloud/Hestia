import { boxOf, orientedRect, ringArea, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { frameOfWall, openingGeometry, type ResolvedLevel } from '@hestia/engine';
import { isOpening, isWall, openingsOfWall, wallsOnLevel, type Id, type Project } from '@hestia/model';
import type { Inference, PreviewItem } from '@hestia/tools';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { gridStrokes } from './grid.ts';
import { guideStrokes, previewOverlay, snapMarker } from './overlay.ts';
import { openingSymbol } from './symbols.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanTheme, StrokeOp } from './types.ts';

export interface PlanInput {
  project: Project;
  levelId: Id;
  resolved: ResolvedLevel;
  below: ResolvedLevel | null;
  viewport: Viewport;
  theme: PlanTheme;
  dark: boolean;
  selection: Id[];
  hover: Id | null;
  preview: PreviewItem[];
  inference: Inference | null;
  showGrid: boolean;
}

const ringsOf = (m: MultiPolygon): Ring[] => m.flatMap((p) => p);

/** Espessura equivalente (2·área/perímetro) em pixels: decide quanto detalhe vale a pena desenhar. */
function thicknessPx(poly: Ring[], zoom: number): number {
  const outer = poly[0];
  if (!outer) return 0;
  let per = 0;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % outer.length]!;
    per += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return per > 0 ? ((2 * Math.abs(ringArea(outer))) / per) * zoom : 0;
}

function wallUnion(resolved: ResolvedLevel, id: Id): MultiPolygon {
  const rw = resolved.walls[id];
  return rw ? union(...rw.layers.map((l) => l.cut)) : [];
}

function elementHighlight(p: Project, resolved: ResolvedLevel, ids: Id[], color: string, alpha: number): FillOp[] {
  const out: FillOp[] = [];
  for (const id of ids) {
    const e = p.elements[id];
    if (isWall(e)) out.push({ polygons: wallUnion(resolved, id), color, alpha });
    else if (isOpening(e)) {
      const f = frameOfWall(p, e.hostId);
      if (!f) continue;
      const g = openingGeometry(p, e, f);
      out.push({ polygons: [[orientedRect(g.center.x, g.center.y, g.u.x, g.u.y, g.width / 2, g.thickness / 2 + 0.02)]], color, alpha });
    }
  }
  return out;
}

export function buildPlanDrawList(input: PlanInput): PlanDrawList {
  const { project: p, resolved, viewport: v, theme } = input;
  const fills: FillOp[] = [];
  const strokes: StrokeOp[] = [];
  const labels: LabelOp[] = [];
  const fillBase = input.dark ? theme.bg : '#ffffff';
  const fillT = input.dark ? 0.5 : 0.58;

  if (input.showGrid) strokes.push(...gridStrokes(v, theme));

  // Pavimento abaixo como subpiso apagado (underlay).
  if (input.below) {
    for (const c of input.below.clusters) {
      fills.push({ polygons: c.silhouette, color: theme.underlay, alpha: 0.22 });
      for (const r of ringsOf(c.silhouette)) strokes.push({ pts: r, closed: true, widthPx: 1, color: theme.underlay, alpha: 0.7 });
    }
  }

  for (const c of resolved.clusters) {
    for (const r of c.regions) {
      const m = p.materials[r.materialId];
      const color = mix(m?.color ?? '#999999', fillBase, fillT);
      const polys = r.polygons;
      const thick = Math.max(0, ...polys.map((poly) => thicknessPx(poly, v.zoom)));
      const hatch = m && m.hatch !== 'none' && thick >= 5 && v.zoom >= 40 ? { kind: m.hatch, color: mix(m.color, input.dark ? '#ffffff' : '#000000', 0.45) } : undefined;
      fills.push({ polygons: polys, color, alpha: 1, hatch });
      // Linhas de interface entre materiais: só onde cabem sem virar mancha.
      for (const poly of polys) {
        if (thicknessPx(poly, v.zoom) < 1.6) continue;
        for (const ring of poly) strokes.push({ pts: ring, closed: true, widthPx: 1, color: mix(theme.ink, fillBase, 0.35), alpha: 1 });
      }
    }
    for (const ring of ringsOf(c.silhouette)) strokes.push({ pts: ring, closed: true, widthPx: 2.2, color: theme.ink, alpha: 1 });
  }

  // Símbolos das aberturas.
  for (const w of wallsOnLevel(p, input.levelId)) {
    const f = frameOfWall(p, w.id);
    if (!f) continue;
    for (const o of openingsOfWall(p, w.id)) strokes.push(...openingSymbol(openingGeometry(p, o, f), theme));
  }

  // Hover e seleção.
  if (input.hover && !input.selection.includes(input.hover)) {
    fills.push(...elementHighlight(p, resolved, [input.hover], theme.select, 0.16));
  }
  if (input.selection.length) {
    fills.push(...elementHighlight(p, resolved, input.selection, theme.select, 0.26));
    for (const id of input.selection) {
      const e = p.elements[id];
      if (!isWall(e)) continue;
      for (const ring of ringsOf(wallUnion(resolved, id))) strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      const half = 4.5 / v.zoom;
      for (const pt of [e.a, e.b]) {
        const sq: Vec2[] = [
          { x: pt.x - half, y: pt.y - half },
          { x: pt.x + half, y: pt.y - half },
          { x: pt.x + half, y: pt.y + half },
          { x: pt.x - half, y: pt.y + half },
        ];
        fills.push({ polygons: [[sq]], color: '#ffffff', alpha: 1 });
        strokes.push({ pts: sq, closed: true, widthPx: 1.6, color: theme.select, alpha: 1 });
      }
    }
  }

  // Pré-visualização, guias e marcador de captura.
  const ov = previewOverlay(input.preview, v, theme, (ids) => elementHighlight(p, resolved, ids, theme.accent, 0.2));
  fills.push(...ov.fills);
  strokes.push(...ov.strokes);
  labels.push(...ov.labels);
  if (input.inference) {
    strokes.push(...guideStrokes(input.inference.guides, theme));
    strokes.push(...snapMarker(input.inference, v, theme));
  }
  return { background: theme.bg, fills, strokes, labels };
}

/** Caixa de todas as paredes do nível, para "enquadrar tudo". */
export function levelBox(p: Project, levelId: Id): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pts = wallsOnLevel(p, levelId).flatMap((w) => [w.a, w.b]);
  if (!pts.length) return null;
  const b = boxOf(pts);
  const pad = 0.5;
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}
