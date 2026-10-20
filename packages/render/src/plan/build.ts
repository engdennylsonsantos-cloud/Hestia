import { boxOf, orientedRect, ringArea, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { frameOfWall, openingGeometry, type ResolvedFloor, type ResolvedLevel, type ResolvedRoof, type ResolvedSlab } from '@hestia/engine';
import { isOpening, isWall, openingsOfWall, wallsOnLevel, type Id, type Project } from '@hestia/model';
import type { Inference, PreviewItem } from '@hestia/tools';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { gridStrokes } from './grid.ts';
import { guideStrokes, previewOverlay, snapMarker } from './overlay.ts';
import { sectionMarksOf } from './sectionMarks.ts';
import { openingSymbol } from './symbols.ts';
import { belowFloorOps, floorFills, floorSelectionOps } from './floors.ts';
import { slabFills, slabSelectionOps } from './slabs.ts';
import { roofFills, roofFootprint, roofSelectionOps } from './roofs.ts';
import { joinDebugLabels } from './joinDebug.ts';
import { wallTagLabels } from './tags.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanTheme, StrokeOp } from './types.ts';

export interface PlanInput {
  project: Project;
  levelId: Id;
  resolved: ResolvedLevel;
  below: ResolvedLevel | null;
  /** Pisos do nível abaixo (referência apagada, D4); sem ele, só as paredes do subpavimento aparecem. */
  belowFloors?: ResolvedFloor[];
  /** Lajes do nível abaixo, apagadas como os pisos (D1/D4); o app preenche, sem ele nada aparece. */
  belowSlabs?: ResolvedSlab[];
  /** Telhados do nível abaixo, apagados como as lajes (D4); sem eles, nada aparece. */
  belowRoofs?: ResolvedRoof[];
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

  if (input.below && input.belowFloors) {
    const bf = belowFloorOps(input.belowFloors, theme);
    fills.push(...bf.fills);
    strokes.push(...bf.strokes);
  }
  if (input.below && input.belowSlabs) {
    const bs = belowFloorOps(input.belowSlabs, theme);
    fills.push(...bs.fills);
    strokes.push(...bs.strokes);
  }
  if (input.below && input.belowRoofs) {
    const br = belowFloorOps(
      input.belowRoofs.map((r) => ({ polygon: roofFootprint(r) })),
      theme,
    );
    fills.push(...br.fills);
    strokes.push(...br.strokes);
  }

  // Nível de detalhe (H3): grosseiro = um contorno preenchido por cluster, sem camadas, hachura nem símbolos;
  // médio = como antes; fino = linhas de camada sempre e hachura mesmo em zoom baixo.
  const detail = p.settings.detail ?? 'medium';
  const fine = detail === 'fine';
  // Lajes antes dos pisos (a laje fica por baixo do piso); pisos antes das paredes (decisão 0006).
  const sl = slabFills(p, input.levelId, theme, input.dark, detail, v);
  fills.push(...sl.fills);
  strokes.push(...sl.strokes);
  labels.push(...sl.labels);
  const fl = floorFills(p, input.levelId, theme, input.dark, detail, v);
  fills.push(...fl.fills);
  strokes.push(...fl.strokes);
  labels.push(...fl.labels);
  for (const c of resolved.clusters) {
    if (detail === 'coarse') {
      fills.push({ polygons: c.silhouette, color: mix(theme.inkSoft, fillBase, 0.5), alpha: 1 });
    }
    const regions = detail === 'coarse' ? [] : c.regions;
    for (const r of regions) {
      const m = p.materials[r.materialId];
      const color = mix(m?.color ?? '#999999', fillBase, fillT);
      const polys = r.polygons;
      const thick = Math.max(0, ...polys.map((poly) => thicknessPx(poly, v.zoom)));
      const hatchOn = m && m.hatch !== 'none' && (fine || (thick >= 5 && v.zoom >= 40));
      const hatch = hatchOn ? { kind: m.hatch, color: mix(m.color, input.dark ? '#ffffff' : '#000000', 0.45) } : undefined;
      fills.push({ polygons: polys, color, alpha: 1, hatch });
      // Linhas de interface entre materiais: só onde cabem sem virar mancha (fino: sempre).
      for (const poly of polys) {
        if (!fine && thicknessPx(poly, v.zoom) < 1.6) continue;
        for (const ring of poly) strokes.push({ pts: ring, closed: true, widthPx: 1, color: mix(theme.ink, fillBase, 0.35), alpha: 1 });
      }
    }
    for (const ring of ringsOf(c.silhouette)) strokes.push({ pts: ring, closed: true, widthPx: 2.2, color: theme.ink, alpha: 1 });
  }

  // Membranas (camadas de espessura zero): linha fina tracejada no limite entre camadas (só no fino).
  if (fine) {
    for (const rw of Object.values(resolved.walls)) {
      for (const m of rw.membranes) strokes.push({ pts: m.pts, closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.9, dash: [6, 3] });
    }
  }

  // Pontas com "não unir": marcador laranja discreto, para a junção esquecida desligada não passar despercebida.
  for (const w of wallsOnLevel(p, input.levelId)) {
    for (const [off, pt] of [[w.noJoinStart, w.a], [w.noJoinEnd, w.b]] as const) {
      if (!off) continue;
      const r = 5 / v.zoom;
      const ring: Vec2[] = Array.from({ length: 12 }, (_, i) => ({ x: pt.x + Math.cos((i * Math.PI) / 6) * r, y: pt.y + Math.sin((i * Math.PI) / 6) * r }));
      strokes.push({ pts: ring, closed: true, widthPx: 1.4, color: theme.guide, alpha: 0.95 });
      strokes.push({ pts: [{ x: pt.x - r * 0.7, y: pt.y - r * 0.7 }, { x: pt.x + r * 0.7, y: pt.y + r * 0.7 }], closed: false, widthPx: 1.4, color: theme.guide, alpha: 0.95 });
    }
  }

  // Símbolos das aberturas (fora do grosseiro).
  if (detail !== 'coarse') {
    for (const w of wallsOnLevel(p, input.levelId)) {
      const f = frameOfWall(p, w.id);
      if (!f) continue;
      for (const o of openingsOfWall(p, w.id)) strokes.push(...openingSymbol(openingGeometry(p, o, f), theme));
    }
  }

  // Telhados (D1): por cima das paredes e dos pisos (semitransparentes); as linhas notáveis saem por último.
  const rf = roofFills(p, input.levelId, theme, input.dark, detail, v);
  fills.push(...rf.fills);
  strokes.push(...rf.strokes);
  labels.push(...rf.labels);

  // Linhas de corte e elevação: aparecem em todas as plantas, porque o corte atravessa os níveis.
  const marks = sectionMarksOf(p.views, v, theme);
  fills.push(...marks.fills);
  strokes.push(...marks.strokes);
  labels.push(...marks.labels);

  // Etiquetas de tipo (G4) e depuração de junção (G6), por configuração do projeto.
  if (p.settings.showTags) labels.push(...wallTagLabels(p, input.levelId, v.zoom));
  if (p.settings.debugJoins) labels.push(...joinDebugLabels(p, input.levelId));

  // Hover e seleção (pisos: destaque próprio; paredes e aberturas em elementHighlight).
  const fsel = floorSelectionOps(p, input.levelId, input.selection, input.hover, theme, v);
  fills.push(...fsel.fills);
  strokes.push(...fsel.strokes);
  labels.push(...fsel.labels);
  const lsel = slabSelectionOps(p, input.levelId, input.selection, input.hover, theme, v);
  fills.push(...lsel.fills);
  strokes.push(...lsel.strokes);
  labels.push(...lsel.labels);
  const rsel = roofSelectionOps(p, input.levelId, input.selection, input.hover, theme, v);
  fills.push(...rsel.fills);
  strokes.push(...rsel.strokes);
  labels.push(...rsel.labels);
  if (input.hover && !input.selection.includes(input.hover)) {
    fills.push(...elementHighlight(p, resolved, [input.hover], theme.select, 0.16));
  }
  if (input.selection.length) {
    fills.push(...elementHighlight(p, resolved, input.selection, theme.select, 0.26));
    for (const id of input.selection) {
      const e = p.elements[id];
      if (!isWall(e)) continue;
      for (const ring of ringsOf(wallUnion(resolved, id))) strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      if (input.selection.length === 1) {
        // Cota temporária: comprimento do eixo, como no Revit ao selecionar.
        const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
        labels.push({ at: { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }, text: `${len.toFixed(3).replace('.', ',')} m`, dy: -12, tone: 'info' });
      }
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
