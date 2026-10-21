import type { MultiPolygon, Ring } from '@hestia/geom';
import { lineIntervals, type SectionResult } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import { mix } from '../plan/color.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanTheme, StrokeOp } from '../plan/types.ts';
import type { Viewport } from '../viewport.ts';
import { sectionItems } from './pick.ts';

export interface SectionInput {
  project: Project;
  section: SectionResult;
  viewport: Viewport;
  theme: PlanTheme;
  dark: boolean;
  showGrid: boolean;
  /** Seleção e cursor (decisão 0016): realçados por cima do desenho. Sem ele, o desenho é o de sempre. */
  highlight?: { selection: Id[]; hover: Id | null };
}

/** Caixilho de vidro (opaco na linha oculta, como o dono decidiu) e folha de porta: cores fixas do desenho. */
const GLASS_FILL = '#bfe3f5';
const DOOR_FILL = '#e6d2ae';

const ringsOf = (m: MultiPolygon): Ring[] => m.flatMap((p) => p);

const fmt = (z: number): string => `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(2).replace('.', ',')}`;

/**
 * Lista de desenho do corte/elevação: x = distância ao longo da linha, y = cota. Os polígonos já são a parte visível
 * (linha oculta, no motor): aqui só se pinta. Segue a hierarquia de peso do Revit: o que é cortado leva hachura e
 * linha pesada; o que está além aparece mais fino e esmaecido (mais longe, mais claro); vãos são caixilho ou folha
 * opacos. A ordem de pintura é do mais longe ao mais perto, com o corte por último.
 */
export function buildSectionDrawList(input: SectionInput): PlanDrawList {
  const { project: p, section: s, theme, viewport: v } = input;
  const fills: FillOp[] = [];
  const strokes: StrokeOp[] = [];
  const labels: LabelOp[] = [];
  const paper = input.dark ? theme.bg : '#ffffff';
  const maxDepth = Math.max(1e-6, ...s.beyond.map((b) => b.depth), ...s.openings.map((o) => o.depth));

  // Solo e níveis: linhas finas tracejadas ao longo de todo o comprimento.
  for (const l of s.levels) {
    const edge = [
      { x: -0.5, y: l.z },
      { x: s.length + 0.5, y: l.z },
    ];
    strokes.push({ pts: edge, closed: false, widthPx: 1, color: theme.inkSoft, alpha: 0.9, dash: [10, 5] });
    labels.push({ at: edge[1]!, text: `${l.name} ${fmt(l.z)}`, dx: 6, dy: -8, tone: 'info' });
  }

  const drawBeyond = (polygons: MultiPolygon, materialColor: string | undefined, depth: number): void => {
    const fade = 0.55 + 0.35 * (depth / maxDepth);
    const color = mix(mix(materialColor ?? '#999999', paper, 0.55), paper, fade * 0.35);
    fills.push({ polygons, color, alpha: 1 });
    for (const ring of ringsOf(polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1, color: mix(theme.ink, paper, 0.35 + 0.4 * (depth / maxDepth)), alpha: 1 });
  };

  const drawOpening = (polygons: MultiPolygon, kind: 'door' | 'window', cut: boolean, t0: number, t1: number): void => {
    fills.push({ polygons, color: kind === 'window' ? GLASS_FILL : DOOR_FILL, alpha: 1 });
    for (const ring of ringsOf(polygons)) strokes.push({ pts: ring, closed: true, widthPx: cut ? 1.6 : 1.2, color: theme.ink, alpha: 1 });
    if (kind !== 'window') return;
    // Montante no meio do vão: só o trecho visível (o que não está na frente de outro elemento).
    const mid = (t0 + t1) / 2;
    for (const poly of polygons) {
      for (const [z0, z1] of lineIntervals(poly, { x: mid, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 })) {
        strokes.push({ pts: [{ x: mid, y: z0 }, { x: mid, y: z1 }], closed: false, widthPx: 1, color: theme.ink, alpha: 0.7 });
      }
    }
  };

  // Pintura do mais longe ao mais perto: além e vãos pela profundidade; o corte (profundidade 0) por último.
  type Paint = { depth: number; cut: boolean; draw: () => void };
  const paint: Paint[] = [
    ...s.beyond.map((b): Paint => ({ depth: b.depth, cut: false, draw: () => drawBeyond(b.polygons, p.materials[b.materialId]?.color, b.depth) })),
    ...s.openings.map((o): Paint => ({ depth: o.depth, cut: false, draw: () => drawOpening(o.polygons, o.kind, o.cut, o.t0, o.t1) })),
    ...s.cut.map((r): Paint => ({
      depth: 0,
      cut: true,
      draw: () => {
        const m = p.materials[r.materialId];
        const color = mix(m?.color ?? '#999999', paper, input.dark ? 0.5 : 0.58);
        const hatch = m && m.hatch !== 'none' && v.zoom >= 40 ? { kind: m.hatch, color: mix(m.color, input.dark ? '#ffffff' : '#000000', 0.45) } : undefined;
        fills.push({ polygons: r.polygons, color, alpha: 1, hatch });
        for (const ring of ringsOf(r.polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1, color: mix(theme.ink, paper, 0.35), alpha: 1 });
      },
    })),
  ];
  paint.sort((x, y) => y.depth - x.depth || Number(x.cut) - Number(y.cut));
  for (const item of paint) item.draw();

  // Contorno externo: a união das regiões visíveis (o que está atrás de um sólido não entra).
  for (const ring of ringsOf(s.silhouette)) strokes.push({ pts: ring, closed: true, widthPx: 2.2, color: theme.ink, alpha: 1 });

  if (input.highlight) highlightOps(s, input.highlight, theme, fills, strokes);

  return { background: theme.bg, fills, strokes, labels };
}

/**
 * Realce por seleção e por cursor (decisão 0016, seção "Seleção em cortes e elevações"). Um item selecionado (ou cujo
 * dono está selecionado) ganha contorno na cor de seleção e preenchimento translúcido (0,25) sobre as partes visíveis.
 * O item sob o cursor, se não estiver selecionado, ganha só um contorno fraco. Vai por último, por cima do desenho.
 * Corte unido: se uma das origens está selecionada, a região inteira é realçada (o motor não separa as origens).
 */
function highlightOps(s: SectionResult, hl: { selection: Id[]; hover: Id | null }, theme: PlanTheme, fills: FillOp[], strokes: StrokeOp[]): void {
  const selected = new Set(hl.selection);
  for (const item of sectionItems(s)) {
    if (item.owners.some((o) => selected.has(o.id))) {
      fills.push({ polygons: item.polygons, color: theme.select, alpha: 0.25 });
      for (const ring of ringsOf(item.polygons)) strokes.push({ pts: ring, closed: true, widthPx: 2, color: theme.select, alpha: 1 });
    } else if (hl.hover !== null && item.owners.some((o) => o.id === hl.hover)) {
      for (const ring of ringsOf(item.polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1.5, color: theme.select, alpha: 0.55 });
    }
  }
}

/** Caixa para enquadrar o desenho, com folga lateral e vertical. */
export function sectionBox(s: SectionResult): { minX: number; minY: number; maxX: number; maxY: number } {
  return { minX: -0.8, maxX: s.length + 2.2, minY: s.zMin - 0.5, maxY: s.zMax + 0.5 };
}
