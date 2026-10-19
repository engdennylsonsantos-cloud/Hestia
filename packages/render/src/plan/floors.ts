import { difference, multiArea, offsetMulti, pointInPolygon, polygonArea, type MultiPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { lineIntervals, resolveFloors, type ResolvedFloor } from '@hestia/engine';
import type { DetailLevel, Id, Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import type { FillOp, LabelOp, PlanTheme, StrokeOp } from './types.ts';

export interface FloorOps {
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
}

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

/** Área em m² com vírgula decimal, como nas demais etiquetas da planta. */
export const fmtArea = (a: number, digits: number): string => `${a.toFixed(digits).replace('.', ',')} m²`;

/** Centroide de um anel (fórmula da área); cai na média dos vértices quando a área é zero. */
function ringCentroid(r: Ring): Vec2 {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const q = r[(i + 1) % r.length]!;
    const k = p.x * q.y - q.x * p.y;
    a += k;
    cx += (p.x + q.x) * k;
    cy += (p.y + q.y) * k;
  }
  if (Math.abs(a) < 1e-12) {
    return { x: r.reduce((s, v) => s + v.x, 0) / r.length, y: r.reduce((s, v) => s + v.y, 0) / r.length };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/**
 * Ponto para a etiqueta do piso: o centroide do maior polígono se cair dentro dele (furos incluídos). Se cair fora
 * (piso em L, por exemplo), usa o meio do maior trecho interno na mesma altura.
 */
export function labelPoint(m: MultiPolygon): Vec2 | null {
  let best: Polygon | null = null;
  for (const q of m) if (!best || Math.abs(polygonArea(q)) > Math.abs(polygonArea(best))) best = q;
  const outer = best?.[0];
  if (!best || !outer || outer.length < 3) return null;
  const c = ringCentroid(outer);
  if (pointInPolygon(c, best)) return c;
  let span: [number, number] | null = null;
  for (const [t0, t1] of lineIntervals(best, { x: 0, y: c.y }, { x: 1, y: 0 }, { x: 0, y: 1 })) {
    if (!span || t1 - t0 > span[1] - span[0]) span = [t0, t1];
  }
  return span ? { x: (span[0] + span[1]) / 2, y: c.y } : c;
}

/**
 * Pisos do nível na planta (D1). O piso fica atrás das paredes (decisão 0006): preenchimento com a cor do material
 * da camada de topo, mais claro que o das paredes; hachura em médio/fino com zoom suficiente (no fino, sempre);
 * contorno fino de 1 px com os furos. No grosseiro só o preenchimento chapado. Com etiquetas ligadas, o código do
 * tipo e a área no centroide.
 */
export function floorFills(p: Project, levelId: Id, theme: PlanTheme, dark: boolean, detail: DetailLevel, v: Viewport): FloorOps {
  const out = empty();
  const fillBase = dark ? theme.bg : '#ffffff';
  const fine = detail === 'fine';
  for (const f of resolveFloors(p, levelId)) {
    const top = f.layers[0];
    const m = top ? p.materials[top.materialId] : undefined;
    const color = mix(m?.color ?? '#999999', fillBase, dark ? 0.42 : 0.74);
    const hatch = m && m.hatch !== 'none' && detail !== 'coarse' && (fine || v.zoom >= 40) ? { kind: m.hatch, color: mix(m.color, dark ? '#ffffff' : '#000000', 0.45) } : undefined;
    out.fills.push({ polygons: f.polygon, color, alpha: 1, hatch });
    if (detail !== 'coarse') {
      // Contorno como faixa preenchida (e não traço): os traços são todos desenhados depois dos preenchimentos e
      // apareceriam por cima das paredes; a faixa respeita a ordem (piso primeiro, paredes por cima).
      const band = difference(f.polygon, offsetMulti(f.polygon, -1.5 / v.zoom));
      if (band.length) out.fills.push({ polygons: band, color: mix(theme.ink, fillBase, 0.35), alpha: 1 });
    }
    if (p.settings.showTags) {
      const code = p.floorTypes[f.typeId]?.code;
      const at = labelPoint(f.polygon);
      const text = [code, fmtArea(multiArea(f.polygon), 1)].filter(Boolean).join(' · ');
      if (at) out.labels.push({ at, text });
    }
  }
  return out;
}

/** Peça de piso ou laje para destaque: id e contorno em planta (furos incluídos). */
export interface OutlinedPart {
  id: Id;
  polygon: MultiPolygon;
}

/**
 * Destaque de seleção e de hover de peças (pisos e lajes): azul translúcido; selecionado ganha contorno de 2 px,
 * quadradinhos nos vértices e, quando `areaLabel` está ligado, a área no centroide (a etiqueta de tipo já a mostra
 * com as etiquetas ligadas).
 */
export function outlineSelectionOps(parts: OutlinedPart[], selection: Id[], hover: Id | null, areaLabel: boolean, theme: PlanTheme, v: Viewport): FloorOps {
  const out = empty();
  const sel = new Set(selection);
  const half = 4.5 / v.zoom;
  for (const f of parts) {
    const isSel = sel.has(f.id);
    const isHover = !isSel && hover === f.id;
    if (!isSel && !isHover) continue;
    out.fills.push({ polygons: f.polygon, color: theme.select, alpha: isSel ? 0.26 : 0.16 });
    if (!isSel) continue;
    for (const ring of f.polygon.flat()) {
      out.strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
      for (const pt of ring) {
        const sq: Vec2[] = [
          { x: pt.x - half, y: pt.y - half },
          { x: pt.x + half, y: pt.y - half },
          { x: pt.x + half, y: pt.y + half },
          { x: pt.x - half, y: pt.y + half },
        ];
        out.fills.push({ polygons: [[sq]], color: '#ffffff', alpha: 1 });
        out.strokes.push({ pts: sq, closed: true, widthPx: 1.6, color: theme.select, alpha: 1 });
      }
    }
    if (areaLabel) {
      const at = labelPoint(f.polygon);
      if (at) out.labels.push({ at, text: fmtArea(multiArea(f.polygon), 2), dy: -12, tone: 'info' });
    }
  }
  return out;
}

/** Destaque dos pisos do nível (D1). */
export function floorSelectionOps(p: Project, levelId: Id, selection: Id[], hover: Id | null, theme: PlanTheme, v: Viewport): FloorOps {
  const parts = resolveFloors(p, levelId).map((f) => ({ id: f.floorId, polygon: f.polygon }));
  return outlineSelectionOps(parts, selection, hover, !p.settings.showTags, theme, v);
}

/** Pisos do nível abaixo, como referência apagada (D4): mesma linguagem do subpavimento das paredes. */
export function belowFloorOps(floors: Array<Pick<ResolvedFloor, 'polygon'>>, theme: PlanTheme): FloorOps {
  const out = empty();
  for (const f of floors) {
    out.fills.push({ polygons: f.polygon, color: theme.underlay, alpha: 0.22 });
    for (const ring of f.polygon.flat()) out.strokes.push({ pts: ring, closed: true, widthPx: 1, color: theme.underlay, alpha: 0.7 });
  }
  return out;
}
