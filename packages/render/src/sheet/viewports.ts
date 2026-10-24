import { computeSection, resolveLevel } from '@hestia/engine';
import { levelGraphicsOf, sectionGraphicsOf, sectionPoints, type Id, type Project, type SheetViewport, type SheetViewSource } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';
import { buildPlanDrawList, levelBox } from '../plan/build.ts';
import { LIGHT } from '../plan/types.ts';
import { buildSectionDrawList, sectionBox } from '../section/build.ts';
import { partsOf, toPaper, viewMappingOf } from './convert.ts';
import { emptyParts, type ViewportParts } from './types.ts';

/**
 * Projeto com a escala da vista da prancha: os gráficos do nível (ou do corte) passam a usar a escala da própria vista,
 * então os pesos (`lineWeightMm`) e o detalhe saem da escala escolhida na prancha, não da do nível.
 */
function withSheetScale(p: Project, view: SheetViewSource, scale: number): Project {
  if (view.kind === 'plan') {
    const graphics = { ...levelGraphicsOf(p, view.levelId), scale };
    return { ...p, levels: p.levels.map((l) => (l.id === view.levelId ? { ...l, graphics } : l)) };
  }
  if (view.kind === 'section') return { ...p, sectionGraphics: { ...sectionGraphicsOf(p), scale } };
  return p;
}

const centreOf = (b: { minX: number; minY: number; maxX: number; maxY: number } | null): Vec2 =>
  b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : { x: 0, y: 0 };

/** Planta de um nível na escala da vista, centrada no conteúdo do nível. Nível inexistente: sem partes. */
export function planPartsOf(p: Project, levelId: Id, vp: SheetViewport): ViewportParts {
  if (!p.levels.some((l) => l.id === levelId)) return emptyParts();
  const pp = withSheetScale(p, { kind: 'plan', levelId }, vp.scale);
  const centre = centreOf(levelBox(p, levelId));
  const m = viewMappingOf(vp, centre);
  const list = buildPlanDrawList({
    project: pp,
    levelId,
    resolved: resolveLevel(p, levelId),
    below: null,
    viewport: { cx: m.cx, cy: m.cy, zoom: m.zoom, width: m.width, height: m.height },
    theme: LIGHT,
    dark: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: false,
  });
  return partsOf(list, toPaper(vp, m), LIGHT);
}

/** Corte ou elevação de uma vista de seção do projeto na escala da vista, centrada na caixa do corte. */
export function sectionPartsOf(p: Project, sectionId: Id, vp: SheetViewport): ViewportParts {
  const view = p.views.find((v) => v.id === sectionId);
  if (!view) return emptyParts();
  const pp = withSheetScale(p, { kind: 'section', sectionId }, vp.scale);
  const pts = sectionPoints(p, view);
  const section = computeSection(pp, { a: pts.a, b: pts.b, depth: view.depth });
  const m = viewMappingOf(vp, centreOf(sectionBox(section)));
  const list = buildSectionDrawList({
    project: pp,
    section,
    viewport: { cx: m.cx, cy: m.cy, zoom: m.zoom, width: m.width, height: m.height },
    theme: LIGHT,
    dark: false,
    showGrid: false,
  });
  return partsOf(list, toPaper(vp, m), LIGHT);
}
