import { lerp, norm, sub, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { formatRampSlope, unitsOf, type DetailLevel, type Id, type Project } from '@hestia/model';
import type { ResolvedRamp, ResolvedRampFlight } from '@hestia/engine';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { labelPoint, outlineSelectionOps, type FloorOps } from './floors.ts';
import { climbArrow, STAIR_DASH, type StairView } from './stairs.ts';
import { defaultPaint, espessuraDeCorte, espessuraDeProjecao, surfaceColor, type PlanPaint } from './style.ts';
import type { Espessura, PapelRotulo, PlanTheme, StrokeOp } from './types.ts';

/**
 * Cota de corte padrão, em m acima da base da rampa (1,20 m, como o corte padrão do intervalo de vista). A planta usa a
 * cota absoluta da vista (`RampView`); sem ela, vale esta, relativa à base de cada rampa.
 */
export const RAMP_CUT_HEIGHT = 1.2;

/** Rótulos da rampa em mm de papel, no mesmo padrão das anotações. */
const RAMP_TEXT_MM = 1.6;
const RAMP_TAG_MM = 1.6;
const RAMP_OFFSET_MM = 2.35;

const EPS = 1e-9;

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

/** Pegada da rampa em planta: a união de lances e patamares (a mesma da seleção e do fantasma). */
export function rampFootprint(r: ResolvedRamp): MultiPolygon {
  return r.footprint;
}

/** Texto da inclinação em % e em `1:X`: `8,33 % (1:12)`. */
export const rampSlopeText: (slope: number) => string = formatRampSlope;

/** Desloca a etiqueta `mm` de papel para um lado da seta (perpendicular ao eixo), para não cruzar a linha. */
const beside = (u: Vec2, mm: number, escala: number): PapelRotulo => ({ escala, desvio: { mm, ux: -u.y, uy: -u.x } });

/** Contorno de um lance ou patamar (linha fina): tracejado quando a peça fica acima da cota de corte. */
function outlineOps(polygon: Vec2[], above: boolean, color: string, espessura: Espessura): StrokeOp {
  return { pts: polygon, closed: true, ...espessura, color, alpha: 1, ...(above ? { dash: STAIR_DASH } : {}) };
}

/** União dos polígonos das fatias que passam pelo filtro; vazio sem nenhuma. */
function unionOf(r: ResolvedRamp, keep: (z: number) => boolean, kind?: 'flight' | 'landing', componentIndex?: number): MultiPolygon {
  const polys = r.slices.filter((s) => keep(s.z) && (kind === undefined || s.kind === kind) && (componentIndex === undefined || s.componentIndex === componentIndex)).map((s): MultiPolygon => [[s.polygon]]);
  return polys.length ? union(...polys) : [];
}

/** Linha transversal de corte do lance, na posição `t` do eixo (borda a borda): `startEdge` e `endEdge` interpolados. */
function cutLine(f: ResolvedRampFlight, cutZ: number): [Vec2, Vec2] | null {
  if (!(f.z0 < cutZ && cutZ < f.z1)) return null;
  const t = (cutZ - f.z0) / (f.z1 - f.z0);
  return [lerp(f.startEdge[0], f.endEdge[0], t), lerp(f.startEdge[1], f.endEdge[1], t)];
}

/**
 * Rampas do nível na planta (decisão da rampa §4.1): preenchimento das fatias com a cor do material do tipo (mesma regra
 * da escada); as fatias até a cota de corte saem cheias, as de cima saem leves (alpha 0,35) quando dentro do intervalo de
 * vista. O contorno de cada lance e patamar é contínuo abaixo do corte e tracejado acima. Uma seta de subida e um rótulo
 * com a inclinação por lance; a linha de corte transversal aparece onde o plano cruza o lance. No grosseiro, só o
 * preenchimento da pegada. Com etiquetas ligadas, o código do tipo no centroide.
 */
export function rampFills(
  p: Project,
  ramps: ResolvedRamp[],
  theme: PlanTheme,
  dark: boolean,
  detail: DetailLevel,
  v: Viewport,
  view?: StairView,
  paint: PlanPaint = defaultPaint('stair', v.zoom),
  scale = 100,
): FloorOps {
  const out = empty();
  const corte = espessuraDeCorte(paint);
  const projecao = espessuraDeProjecao(paint);
  const fillBase = dark ? theme.bg : '#ffffff';
  const lineColor = mix(theme.ink, fillBase, 0.35);
  for (const r of ramps) {
    const cutZ = view?.cutZ ?? r.baseZ + RAMP_CUT_HEIGHT;
    const viewTop = view?.topZ ?? Infinity;
    if (r.baseZ > viewTop + EPS) continue;
    const inView = (z: number): boolean => z <= viewTop + EPS;
    const m = p.materials[r.type.materialId];
    const color = surfaceColor(m?.color ?? '#999999', fillBase, dark ? 0.42 : 0.74, paint);
    if (detail === 'coarse') {
      const visible = r.slices.some((s) => inView(s.z));
      if (!visible && r.slices.length > 0) continue;
      const footprint = r.slices.every((s) => inView(s.z)) ? r.footprint : unionOf(r, inView);
      out.fills.push({ polygons: footprint, color, alpha: 1 });
      continue;
    }
    // Fatias até o corte: preenchimento cheio; acima do corte e dentro da vista: preenchimento leve.
    const below = unionOf(r, (z) => z <= cutZ + EPS);
    if (below.length > 0) out.fills.push({ polygons: below, color, alpha: 1 });
    const aboveInView = unionOf(r, (z) => z > cutZ + EPS && inView(z));
    if (aboveInView.length > 0) out.fills.push({ polygons: aboveInView, color, alpha: 0.35 });
    // Contornos de lances e patamares: contínuo abaixo do corte, tracejado acima (parte de cima do lance incluso).
    for (const f of r.flights) {
      if (f.z0 <= cutZ + EPS) {
        const poly = f.z1 <= cutZ + EPS ? [[f.polygon]] : unionOf(r, (z) => z <= cutZ + EPS, 'flight', f.componentIndex);
        for (const ring of poly.flat()) out.strokes.push(outlineOps(ring, false, lineColor, projecao));
      }
      const above = unionOf(r, (z) => z > cutZ + EPS, 'flight', f.componentIndex);
      for (const ring of above.flat()) out.strokes.push(outlineOps(ring, true, lineColor, projecao));
      const cut = cutLine(f, cutZ);
      if (cut) out.strokes.push({ pts: cut, closed: false, ...corte, color: theme.ink, alpha: 1 });
      out.strokes.push(...climbArrow([f.start, f.end], theme.ink, corte));
      const mid = { x: (f.start.x + f.end.x) / 2, y: (f.start.y + f.end.y) / 2 };
      const u = norm(sub(f.end, f.start));
      out.labels.push({ at: mid, text: rampSlopeText(f.slope), papel: { ...beside(u, RAMP_OFFSET_MM, scale), fontMm: RAMP_TEXT_MM } });
    }
    for (const l of r.landings) {
      const above = l.z > cutZ + EPS;
      out.strokes.push(outlineOps(l.polygon, above, lineColor, projecao));
    }
    if (p.settings.showTags) {
      const at = labelPoint(rampFootprint(r));
      if (at) out.labels.push({ at, text: r.type.code, papel: { escala: scale, fontMm: RAMP_TAG_MM } });
    }
  }
  return out;
}

/** Rampas do nível abaixo, apagadas como os pisos e lajes de referência: só o preenchimento da pegada. */
export function belowRampOps(ramps: ResolvedRamp[], theme: PlanTheme): FloorOps {
  const out = empty();
  for (const r of ramps) out.fills.push({ polygons: r.footprint, color: theme.underlay, alpha: 0.22 });
  return out;
}

/** Destaque de seleção e de hover das rampas, no padrão dos pisos e lajes (contorno da pegada). */
export function rampSelectionOps(p: Project, ramps: ResolvedRamp[], selection: Id[], hover: Id | null, theme: PlanTheme, v: Viewport): FloorOps {
  const parts = ramps.map((r) => ({ id: r.id, polygon: rampFootprint(r) }));
  return outlineSelectionOps(parts, selection, hover, !p.settings.showTags, theme, unitsOf(p), v);
}
