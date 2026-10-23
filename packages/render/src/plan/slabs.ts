import { difference, multiArea, offsetMulti, type Vec2 } from '@hestia/geom';
import { fillRegionOf, junctionLevel, resolveSlabs, type ElementJunction, type ResolvedSlab, type ResolvedSlabLayer } from '@hestia/engine';
import type { DetailLevel, Id, Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { concatOps, fmtArea, labelPoint, membraneLineOps, outlineSelectionOps, type FloorOps } from './floors.ts';
import { holeMarkOps } from './holeMarks.ts';
import { defaultPaint, surfaceColor, type PlanPaint } from './style.ts';
import type { PlanTheme, StrokeOp } from './types.ts';

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

/** Camada que dá a cor e a hachura da laje: a estrutural (função 'structure'); sem ela, a de topo. */
export function structuralLayer(p: Project, s: ResolvedSlab): ResolvedSlabLayer | undefined {
  const layers = p.slabTypes[s.typeId]?.layers ?? [];
  return s.layers.find((l) => layers[l.layerIndex]?.function === 'structure') ?? s.layers.find((l) => !l.membrane);
}

/**
 * Seta de caimento: segmento de 80 px centrado no ponto, na direção `dir` da inclinação (para onde a face sobe), com
 * cabeça de 7 px e espessura `widthPx` (a do corte da categoria).
 */
export function slopeArrow(dir: Vec2, at: Vec2, v: Viewport, theme: PlanTheme, widthPx: number): StrokeOp[] {
  const k = Math.hypot(dir.x, dir.y) || 1;
  const u = { x: dir.x / k, y: dir.y / k };
  const half = 40 / v.zoom;
  const head = 7 / v.zoom;
  const tip = { x: at.x + u.x * half, y: at.y + u.y * half };
  const back = { x: -u.x, y: -u.y };
  const wing = (a: number): Vec2 => ({
    x: tip.x + head * (back.x * Math.cos(a) - back.y * Math.sin(a)),
    y: tip.y + head * (back.x * Math.sin(a) + back.y * Math.cos(a)),
  });
  const style = { widthPx, color: theme.ink, alpha: 0.9 };
  return [
    { pts: [{ x: at.x - u.x * half, y: at.y - u.y * half }, tip], closed: false, ...style },
    { pts: [wing(Math.PI / 6), tip, wing(-Math.PI / 6)], closed: false, ...style },
  ];
}

/**
 * Lajes do nível na planta (D1). Desenhadas antes dos pisos e das paredes: a laje fica por baixo do piso. Cor da
 * camada estrutural misturada com o papel (um tom mais escura que a do piso, 0,6 claro e 0,38 escuro); hachura em
 * médio/fino com zoom suficiente; contorno como faixa preenchida de 1,5 px (traços seriam cobertos pelos
 * preenchimentos seguintes). Com etiquetas ligadas, código e área. Com inclinação, seta de caimento e percentual
 * (fora do grosseiro).
 */
export function slabFills(
  p: Project,
  levelId: Id,
  theme: PlanTheme,
  dark: boolean,
  detail: DetailLevel,
  v: Viewport,
  hidden?: ReadonlySet<Id>,
  paint: PlanPaint = defaultPaint('slab', v.zoom),
): FloorOps {
  const jl = junctionLevel(p, levelId);
  return concatOps(
    resolveSlabs(p, levelId)
      .filter((s) => !hidden?.has(s.slabId))
      .map((s) => slabOpsOf(p, s, theme, dark, detail, v, paint, jl.elements.get(s.slabId))),
  );
}

/** Operações de uma laje (preenchimento, contorno, seta de caimento e etiquetas). `slabFills` as junta; a planta as ordena pela cota. */
export function slabOpsOf(p: Project, s: ResolvedSlab, theme: PlanTheme, dark: boolean, detail: DetailLevel, v: Viewport, paint: PlanPaint, el?: ElementJunction): FloorOps {
  const out = empty();
  // Região depois da junção (P7b): a laje sem corte fica com o contorno dela; cortada, com a região que sobra.
  // Preenchimento: a camada de cima (o término dela vale mesmo sem junção; ver `floorOpsOf`) ou, com corte, a região
  // resolvida — ou as partes da camada de cima quando o término dela é explícito (0023 F7 e 0025).
  const top = s.layers.find((l) => !l.membrane);
  const region = fillRegionOf(top ?? { explicit: false, polygon: s.polygon }, el);
  if (region.length === 0) return out;
  const fillBase = dark ? theme.bg : '#ffffff';
  const fine = detail === 'fine';
  const layer = structuralLayer(p, s);
  const m = layer ? p.materials[layer.materialId] : undefined;
  const color = surfaceColor(m?.color ?? '#999999', fillBase, dark ? 0.38 : 0.6, paint);
  const hatch = m && m.hatch !== 'none' && detail !== 'coarse' && (fine || v.zoom >= 40) ? { kind: m.hatch, color: mix(paint.color ?? m.color, dark ? '#ffffff' : '#000000', 0.45) } : undefined;
  out.fills.push({ polygons: region, color, alpha: 1, hatch });
  out.strokes.push(...holeMarkOps(s.polygon, theme, paint, detail));
  const at = labelPoint(s.polygon);
  if (detail !== 'coarse') {
    const band = difference(region, offsetMulti(region, -paint.cutPx / v.zoom));
    if (band.length) out.fills.push({ polygons: band, color: mix(theme.ink, fillBase, 0.35), alpha: 1, contour: true });
    // Linha de membrana na face da própria camada (P8): ela pode ir ao núcleo da parede.
    for (const l of s.layers) if (l.membrane) out.strokes.push(...membraneLineOps(l.polygon, theme));
    if (s.slope && at) {
      out.strokes.push(...slopeArrow(s.slope.dir, at, v, theme, paint.cutPx));
      out.labels.push({ at, text: `${s.slope.percent.toFixed(1).replace('.', ',')} %`, dy: 12 });
    }
  }
  if (p.settings.showTags && at) {
    const code = p.slabTypes[s.typeId]?.code;
    const text = [code, fmtArea(multiArea(s.polygon), 1)].filter(Boolean).join(' · ');
    out.labels.push({ at, text, ...(s.slope ? { dy: -10 } : {}) });
  }
  return out;
}

/** Destaque de seleção e de hover das lajes (D1), no mesmo padrão dos pisos. */
export function slabSelectionOps(p: Project, levelId: Id, selection: Id[], hover: Id | null, theme: PlanTheme, v: Viewport, hidden?: ReadonlySet<Id>): FloorOps {
  const parts = resolveSlabs(p, levelId)
    .filter((s) => !hidden?.has(s.slabId))
    .map((s) => ({ id: s.slabId, polygon: s.polygon }));
  return outlineSelectionOps(parts, selection, hover, !p.settings.showTags, theme, v);
}
