import { difference, multiArea, offsetMulti } from '@hestia/geom';
import { resolveCeilings, type ResolvedCeiling } from '@hestia/engine';
import type { DetailLevel, Id, Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { fmtArea, labelPoint, outlineSelectionOps, type FloorOps } from './floors.ts';
import { defaultPaint, surfaceColor, type PlanPaint } from './style.ts';
import type { PlanTheme } from './types.ts';

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

/** Cor do forro na planta: a do material da primeira camada (a de cima, como no tipo), ou cinza sem material. */
export function ceilingFillMaterial(c: ResolvedCeiling): Id | undefined {
  return c.layers[0]?.materialId;
}

/**
 * Forros na planta de forro (decisão 0021): contorno e furos preenchidos com a cor do material da primeira camada, com
 * hachura em médio/fino com zoom suficiente, e a faixa de contorno como nas lajes. Com etiquetas ligadas, marca e área.
 * Só a planta de forro (direção 'up') chama esta função; na planta baixa forro não é desenhado.
 */
export function ceilingFills(
  p: Project,
  levelId: Id,
  theme: PlanTheme,
  dark: boolean,
  detail: DetailLevel,
  v: Viewport,
  hidden?: ReadonlySet<Id>,
  paint: PlanPaint = defaultPaint('floor', v.zoom),
): FloorOps {
  const out = empty();
  const fillBase = dark ? theme.bg : '#ffffff';
  const fine = detail === 'fine';
  for (const c of resolveCeilings(p, levelId)) {
    if (hidden?.has(c.ceilingId)) continue;
    const materialId = ceilingFillMaterial(c);
    const m = materialId ? p.materials[materialId] : undefined;
    const color = surfaceColor(m?.color ?? '#999999', fillBase, dark ? 0.38 : 0.6, paint);
    const hatch = m && m.hatch !== 'none' && detail !== 'coarse' && (fine || v.zoom >= 40) ? { kind: m.hatch, color: mix(paint.color ?? m.color, dark ? '#ffffff' : '#000000', 0.45) } : undefined;
    out.fills.push({ polygons: c.polygon, color, alpha: 1, hatch });
    const at = labelPoint(c.polygon);
    if (detail !== 'coarse') {
      const band = difference(c.polygon, offsetMulti(c.polygon, -paint.cutPx / v.zoom));
      if (band.length) out.fills.push({ polygons: band, color: mix(theme.ink, fillBase, 0.35), alpha: 1, contour: true });
    }
    if (p.settings.showTags && at) {
      const e = p.elements[c.ceilingId];
      const mark = e && e.kind === 'ceiling' ? e.mark : '';
      const text = [mark, fmtArea(multiArea(c.polygon), 1)].filter(Boolean).join(' · ');
      out.labels.push({ at, text });
    }
  }
  return out;
}

/** Destaque de seleção e de hover dos forros na planta de forro, no mesmo padrão das lajes. */
export function ceilingSelectionOps(p: Project, levelId: Id, selection: Id[], hover: Id | null, theme: PlanTheme, v: Viewport, hidden?: ReadonlySet<Id>): FloorOps {
  const parts = resolveCeilings(p, levelId)
    .filter((c) => !hidden?.has(c.ceilingId))
    .map((c) => ({ id: c.ceilingId, polygon: c.polygon }));
  return outlineSelectionOps(parts, selection, hover, !p.settings.showTags, theme, v);
}
