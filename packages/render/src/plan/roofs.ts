import { difference, multiArea, offsetMulti, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { resolveRoofs, type ResolvedRoof, type ResolvedRoofLayer } from '@hestia/engine';
import type { DetailLevel, Id, Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { mix } from './color.ts';
import { fmtArea, labelPoint, outlineSelectionOps, type FloorOps } from './floors.ts';
import { slopeArrow } from './slabs.ts';
import type { PlanTheme } from './types.ts';

const empty = (): FloorOps => ({ fills: [], strokes: [], labels: [] });

/** Luz de noroeste na planta (y para cima = norte): a água voltada para ela fica um tom mais clara. */
const LIGHT_NW: Vec2 = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };

/** Contorno do telhado em planta: união das águas (as divisas internas somem). */
export const roofFootprint = (r: ResolvedRoof): MultiPolygon => union(...r.planes.map((pl) => pl.polygon));

/** Área real de todas as águas (m²): a área em planta de cada água vezes √(1 + i²), com i = percent/100. */
export const roofRealArea = (r: ResolvedRoof): number => r.planes.reduce((s, pl) => s + multiArea(pl.polygon) * Math.sqrt(1 + (pl.percent / 100) ** 2), 0);

/** Percentual com vírgula decimal, como nas demais cotas da planta: "30 %", "27,5 %". */
export const fmtPercent = (p: number): string => `${String(Math.round(p * 10) / 10).replace('.', ',')} %`;

/** Tom da água: voltada para a luz de noroeste fica 6 % mais clara; a outra, 6 % mais escura (dá volume ao plano). */
export function waterTone(color: string, up: Vec2): string {
  const facing = -up.x * LIGHT_NW.x - up.y * LIGHT_NW.y;
  return facing >= 0 ? mix(color, '#ffffff', 0.06) : mix(color, '#000000', 0.06);
}

/** Camada de topo: a de menor `below`, a que se vê de cima. */
function topLayer(r: ResolvedRoof): ResolvedRoofLayer | undefined {
  return r.layers.reduce<ResolvedRoofLayer | undefined>((best, l) => (!best || l.below < best.below ? l : best), undefined);
}

/** Desloca a etiqueta 20 px para o lado da seta (perpendicular a ela), para não cruzar a haste. */
const beside = (u: Vec2): { dx: number; dy: number } => ({ dx: -20 * u.y, dy: -20 * u.x });

/**
 * Telhados sobre a lista de águas (D1). Cada água tem a cor da camada de topo misturada com o papel (0,5 claro, 0,3
 * escuro) e um tom por orientação; o telhado é semitransparente (0,55; 0,8 no grosseiro) para ver as paredes por
 * baixo. Fora do grosseiro: hachura em médio/fino com zoom suficiente, contorno do beiral como faixa, cumeeira e
 * espigão em traço, rincão tracejado e, por água, seta de caimento (da subida para a descida) com o percentual.
 * Com etiquetas ligadas, código e área real no centroide.
 */
export function roofOps(roofs: ResolvedRoof[], p: Project, theme: PlanTheme, dark: boolean, detail: DetailLevel, v: Viewport): FloorOps {
  const out = empty();
  const fillBase = dark ? theme.bg : '#ffffff';
  const coarse = detail === 'coarse';
  const fine = detail === 'fine';
  for (const r of roofs) {
    const top = topLayer(r);
    const m = top ? p.materials[top.materialId] : undefined;
    const base = mix(m?.color ?? '#999999', fillBase, dark ? 0.3 : 0.5);
    const hatch = m && m.hatch !== 'none' && !coarse && (fine || v.zoom >= 40) ? { kind: m.hatch, color: mix(m.color, dark ? '#ffffff' : '#000000', 0.45) } : undefined;
    for (const pl of r.planes) out.fills.push({ polygons: pl.polygon, color: waterTone(base, pl.up), alpha: coarse ? 0.8 : 0.55, hatch });
    const foot = roofFootprint(r);
    if (!coarse) {
      const band = difference(foot, offsetMulti(foot, -1.5 / v.zoom));
      if (band.length) out.fills.push({ polygons: band, color: mix(theme.ink, fillBase, 0.35), alpha: 1 });
      for (const ln of r.lines) {
        if (ln.kind === 'eave') continue;
        const dash: [number, number] | undefined = ln.kind === 'valley' ? [6, 3] : undefined;
        out.strokes.push({ pts: [ln.a, ln.b], closed: false, widthPx: ln.kind === 'ridge' ? 2.2 : 1.6, color: theme.ink, alpha: 1, ...(dash ? { dash } : {}) });
      }
      for (const pl of r.planes) {
        const at = labelPoint(pl.polygon);
        if (!at) continue;
        const down = { x: -pl.up.x, y: -pl.up.y };
        out.strokes.push(...slopeArrow(down, at, v, theme));
        out.labels.push({ at, text: fmtPercent(pl.percent), ...beside(down) });
      }
    }
    if (p.settings.showTags) {
      const at = labelPoint(foot);
      const text = [p.roofTypes[r.typeId]?.code, fmtArea(roofRealArea(r), 1)].filter(Boolean).join(' · ');
      // Acima da seta de caimento (que tem 40 px para cada lado), para não se sobrepor a ela.
      if (at) out.labels.push({ at, text, dy: coarse ? -10 : -52 });
    }
  }
  return out;
}

/** Telhados do nível na planta (D1), antes das etiquetas e depois das paredes e aberturas. */
export function roofFills(p: Project, levelId: Id, theme: PlanTheme, dark: boolean, detail: DetailLevel, v: Viewport): FloorOps {
  return roofOps(resolveRoofs(p, levelId), p, theme, dark, detail, v);
}

/** Destaque de seleção e de hover dos telhados (D1), no padrão das lajes; a área é a real. */
export function roofSelectionOps(p: Project, levelId: Id, selection: Id[], hover: Id | null, theme: PlanTheme, v: Viewport): FloorOps {
  const parts = resolveRoofs(p, levelId).map((r) => ({ id: r.roofId, polygon: roofFootprint(r), area: roofRealArea(r) }));
  return outlineSelectionOps(parts, selection, hover, !p.settings.showTags, theme, v);
}
