import type { MultiPolygon, Ring } from '@hestia/geom';
import type { SectionResult } from '@hestia/engine';
import type { Project } from '@hestia/model';
import { mix } from '../plan/color.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanTheme, StrokeOp } from '../plan/types.ts';
import type { Viewport } from '../viewport.ts';

export interface SectionInput {
  project: Project;
  section: SectionResult;
  viewport: Viewport;
  theme: PlanTheme;
  dark: boolean;
  showGrid: boolean;
}

const ringsOf = (m: MultiPolygon): Ring[] => m.flatMap((p) => p);

const fmt = (z: number): string => `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(2).replace('.', ',')}`;

/**
 * Lista de desenho do corte/elevação: x = distância ao longo da linha, y = cota. Segue a hierarquia de peso do
 * Revit: o que é cortado leva hachura e linha pesada, o que está além aparece mais fino e esmaecido (mais longe,
 * mais claro), e os níveis entram como linhas-guia com a cota.
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

  // Além do plano de corte, do mais longe ao mais perto.
  for (const b of s.beyond) {
    const m = p.materials[b.materialId];
    const fade = 0.55 + 0.35 * (b.depth / maxDepth);
    const color = mix(mix(m?.color ?? '#999999', paper, 0.55), paper, fade * 0.35);
    fills.push({ polygons: b.polygons, color, alpha: 1 });
    for (const ring of ringsOf(b.polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1, color: mix(theme.ink, paper, 0.35 + 0.4 * (b.depth / maxDepth)), alpha: 1 });
  }

  // Vãos: caixilho/folha como retângulo; no corte, a linha pesada passa pelo vão aberto.
  for (const o of s.openings) {
    const ring: Ring = [
      { x: o.t0, y: o.z0 },
      { x: o.t1, y: o.z0 },
      { x: o.t1, y: o.z1 },
      { x: o.t0, y: o.z1 },
    ];
    if (o.kind === 'window') {
      fills.push({ polygons: [[ring]], color: '#bfe3f5', alpha: o.cut ? 0.7 : 0.55 });
      const mid = (o.t0 + o.t1) / 2;
      strokes.push({ pts: [{ x: mid, y: o.z0 }, { x: mid, y: o.z1 }], closed: false, widthPx: 1, color: theme.ink, alpha: 0.7 });
    }
    strokes.push({ pts: ring, closed: true, widthPx: o.cut ? 1.6 : 1.2, color: theme.ink, alpha: 1 });
  }

  // Material cortado: cor, hachura (quando cabe) e contorno pesado.
  for (const r of s.cut) {
    const m = p.materials[r.materialId];
    const color = mix(m?.color ?? '#999999', paper, input.dark ? 0.5 : 0.58);
    const hatch = m && m.hatch !== 'none' && v.zoom >= 40 ? { kind: m.hatch, color: mix(m.color, input.dark ? '#ffffff' : '#000000', 0.45) } : undefined;
    fills.push({ polygons: r.polygons, color, alpha: 1, hatch });
    for (const ring of ringsOf(r.polygons)) strokes.push({ pts: ring, closed: true, widthPx: 1, color: mix(theme.ink, paper, 0.35), alpha: 1 });
  }
  for (const ring of ringsOf(s.silhouette)) strokes.push({ pts: ring, closed: true, widthPx: 2.2, color: theme.ink, alpha: 1 });

  return { background: theme.bg, fills, strokes, labels };
}

/** Caixa para enquadrar o desenho, com folga lateral e vertical. */
export function sectionBox(s: SectionResult): { minX: number; minY: number; maxX: number; maxY: number } {
  return { minX: -0.8, maxX: s.length + 2.2, minY: s.zMin - 0.5, maxY: s.zMax + 0.5 };
}
