import {
  arcFromSagitta,
  arcPointAt,
  closestOnSegment,
  dist,
  mid,
  SLOPE_HALF_PX,
  validateSketch,
  type SketchDraft,
  type SketchResult,
  type SketchSeg,
  type Vec2,
} from '@hestia/geom';
import { worldToScreen, type Viewport } from '../viewport.ts';
import { labelPoint } from './floors.ts';
import { quadradoEm, poligonoEm, tracoEm } from './marcadores.ts';
import { polyOf, outerLoop } from './sketchGeom.ts';
import { slopeMarks, slopeOps, triangleCenterPx } from './sketchSlope.ts';
import type { PlanOps, PlanTheme } from './types.ts';

/** Vermelho dos problemas: fica legível sobre o claro e o escuro, e não se confunde com o rosa do rascunho. */
export const SKETCH_ISSUE = '#e53935';

/** Meio lado do quadrado de cada vértice, em pixels de tela. */
const VERTEX_HALF_PX = 3;
/** Raio do balão de problema, em pixels de tela. */
const BALLOON_PX = 8;
/** Erro máximo da poligonal dos arcos, em pixels de tela: arco liso em qualquer zoom. */
const CHORD_PX = 0.5;
/** Destaque da linha selecionada: mais grosso que a linha rosa, com disco cheio nas pontas e no meio. */
const SELECT_WIDTH_PX = 4;
const HOVER_WIDTH_PX = 3;
const SELECT_VERTEX_PX = 4.5;
const SELECT_MID_PX = 4;

const BALLOON_OFFS: Vec2[] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return { x: BALLOON_PX * Math.cos(a), y: BALLOON_PX * Math.sin(a) };
});

const discOffs = (r: number): Vec2[] =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  });

const SELECT_VERTEX_OFFS = discOffs(SELECT_VERTEX_PX);
const SELECT_MID_OFFS = discOffs(SELECT_MID_PX);

/** Caixa da janela de seleção em arraste: `window` (da esquerda para a direita) é preenchida. */
export interface SketchSelectionBox {
  a: Vec2;
  b: Vec2;
  window: boolean;
}

const keyOf = (p: Vec2): string => `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`;

/** Meio da linha: no arco, o ponto do arco; na reta, o meio da corda. */
function midPointOf(seg: SketchSeg): Vec2 {
  const arc = seg.sag ? arcFromSagitta(seg.a, seg.b, seg.sag) : null;
  return arc ? arcPointAt(arc, arc.length / 2) : mid(seg.a, seg.b);
}

/** Linha selecionada em azul sólido, com os vértices e o meio cheios; a do cursor em azul claro e mais fina. */
function highlightOps(draft: SketchDraft, theme: PlanTheme, view: Viewport, hover: string | null): PlanOps {
  const selected = new Set(draft.selected);
  const out: PlanOps = { fills: [], strokes: [], labels: [] };
  const tol = CHORD_PX / view.zoom;
  for (const s of draft.segs) {
    const on = selected.has(s.id);
    if (!on && s.id !== hover) continue;
    out.strokes.push({ pts: polyOf(s, tol), closed: false, widthPx: on ? SELECT_WIDTH_PX : HOVER_WIDTH_PX, color: on ? theme.select : theme.selectHover, alpha: 1 });
    if (!on) continue;
    out.fills.push({ ...poligonoEm(s.a, SELECT_VERTEX_OFFS), color: theme.select, alpha: 1 });
    out.fills.push({ ...poligonoEm(s.b, SELECT_VERTEX_OFFS), color: theme.select, alpha: 1 });
    out.fills.push({ ...poligonoEm(midPointOf(s), SELECT_MID_OFFS), color: theme.select, alpha: 1 });
  }
  return out;
}

/** Retângulo tracejado do arrasto; preenchido quando a janela pega as linhas inteiras (esquerda para a direita). */
function selectionBoxOps(box: SketchSelectionBox, theme: PlanTheme): PlanOps {
  const ring = [box.a, { x: box.b.x, y: box.a.y }, box.b, { x: box.a.x, y: box.b.y }];
  const out: PlanOps = { fills: [], strokes: [], labels: [] };
  if (box.window) out.fills.push({ polygons: [[ring]], color: theme.select, alpha: 0.12 });
  out.strokes.push({ pts: ring, closed: true, widthPx: 1, color: theme.select, alpha: 0.9, dash: [6, 4] });
  return out;
}

/** Problema: balão branco com borda vermelha e "!" no ponto do problema (em pixels de tela). */
function balloonOps(at: Vec2, out: PlanOps): void {
  out.fills.push({ ...poligonoEm(at, BALLOON_OFFS), color: '#ffffff', alpha: 1 });
  out.strokes.push({ ...tracoEm(at, BALLOON_OFFS, true), widthPx: 1.5, color: SKETCH_ISSUE, alpha: 1 });
  out.labels.push({ at, text: '!', center: true, bold: true });
}

/**
 * Operações de desenho do esboço em planta: linhas em rosa (1,5 px, arcos amostrados como arcos), vértices como
 * quadradinhos, realce das selecionadas e do cursor, furos com hachura e legenda, linhas dos problemas em vermelho com
 * balão, e (só no telhado) o triângulo de inclinação por aresta do laço externo.
 */
export function sketchOps(
  draft: SketchDraft,
  result: SketchResult,
  theme: PlanTheme,
  view: Viewport,
  hover: string | null = null,
  box: SketchSelectionBox | null = null,
): PlanOps {
  const rose = theme.roofFootprint;
  const out: PlanOps = { fills: [], strokes: [], labels: [] };
  const tol = CHORD_PX / view.zoom;

  for (const s of draft.segs) out.strokes.push({ pts: polyOf(s, tol), closed: false, widthPx: 1.5, color: rose, alpha: 1 });

  const seen = new Set<string>();
  for (const s of draft.segs) {
    for (const p of [s.a, s.b]) {
      if (seen.has(keyOf(p))) continue;
      seen.add(keyOf(p));
      out.fills.push({ ...quadradoEm(p, VERTEX_HALF_PX).fill, color: rose, alpha: 1 });
    }
  }

  for (const loop of result.loops) {
    if (loop.role !== 'hole') continue;
    out.fills.push({ polygons: [[loop.ring]], color: rose, alpha: 0.12, hatch: { kind: 'diagonal', color: rose, alpha: 0.6 } });
    const at = labelPoint([[loop.ring]]);
    if (at) out.labels.push({ at, text: 'furo', center: true });
  }

  const bad = new Set(result.issues.flatMap((i) => i.segIds));
  for (const s of draft.segs) {
    if (bad.has(s.id)) out.strokes.push({ pts: polyOf(s, tol), closed: false, widthPx: 2.5, color: SKETCH_ISSUE, alpha: 1 });
  }
  for (const issue of result.issues) if (issue.at) balloonOps(issue.at, out);

  const hi = highlightOps(draft, theme, view, hover);
  out.strokes.push(...hi.strokes);
  out.fills.push(...hi.fills);

  if (draft.target === 'roof') {
    const outer = outerLoop(result.loops);
    if (outer) {
      const sl = slopeOps(slopeMarks(draft, outer), theme);
      out.fills.push(...sl.fills);
      out.strokes.push(...sl.strokes);
      out.labels.push(...sl.labels);
    }
  }
  if (box) {
    const b = selectionBoxOps(box, theme);
    out.fills.push(...b.fills);
    out.strokes.push(...b.strokes);
  }
  return out;
}

/** Distância (px) de um ponto de tela à poligonal de tela `pts`. */
function distToPolyline(p: Vec2, pts: Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, dist(closestOnSegment(p, pts[i]!, pts[i + 1]!), p));
  return best;
}

/**
 * Hit-test de linha: id da aresta mais próxima de `at` (pixels de tela) dentro de `tolPx`, ou `null`. Arcos são testados
 * pela poligonal que se desenha, então o clique segue a curva.
 */
export function sketchHitSeg(draft: SketchDraft, at: Vec2, view: Viewport, tolPx = 6): string | null {
  let best: { id: string; d: number } | null = null;
  for (const s of draft.segs) {
    const d = distToPolyline(at, polyOf(s, CHORD_PX / view.zoom).map((p) => worldToScreen(view, p)));
    if (d <= tolPx && (!best || d < best.d)) best = { id: s.id, d };
  }
  return best?.id ?? null;
}

/**
 * Hit-test do triângulo de inclinação de uma aresta do laço externo: centro em pixels de tela e raio (o círculo que
 * contém o triângulo). `null` fora do telhado, sem laço externo ou para aresta que não é do laço. Valida o rascunho
 * de novo, pois não recebe o resultado.
 */
export function sketchTriangleAt(draft: SketchDraft, segId: string, view: Viewport): { center: Vec2; r: number } | null {
  if (draft.target !== 'roof') return null;
  const outer = outerLoop(validateSketch(draft.segs).loops);
  if (!outer) return null;
  const m = slopeMarks(draft, outer).find((x) => x.seg.id === segId);
  if (!m) return null;
  return { center: triangleCenterPx(m, view), r: SLOPE_HALF_PX * Math.SQRT2 };
}
