import { openingPlanPaths, type OpeningGeometry, type OpeningModel, type OpeningPlanOptions, type OpeningPlanRole } from '@hestia/engine';
import type { Vec2 } from '@hestia/geom';
import { espessuraVezes } from './espessura.ts';
import type { Espessura, PlanTheme, StrokeOp } from './types.ts';

/** Nível de detalhe da planta, incluindo o desligado (spec E §4.1). */
export type OpeningSymbolDetail = 'low' | 'mid' | 'high' | 'off';

/** Opções do símbolo de planta: o modelo único, o detalhe e a convenção de abertura. */
export interface OpeningSymbolOptions extends Omit<OpeningPlanOptions, 'detail'> {
  detail: OpeningSymbolDetail;
}

/** Traço do símbolo já em coordenadas do mundo (a mesma geometria que o DXF recebe). */
export interface OpeningPlanWorldPath {
  pts: Vec2[];
  closed: boolean;
  weight: number;
  tone: 'cut' | 'ink' | 'soft';
  dash?: [number, number];
  role: OpeningPlanRole;
}

/** Limiares de zoom em que o detalhe da esquadria muda (px/m): 1 px = 0,012 m e 1 px = 0,004 m. */
export const OPENING_DETAIL_ZOOMS = [(1 / 0.012) * (1 + 1e-9), (1 / 0.004) * (1 + 1e-9)] as const;

/**
 * Nível efetivo pelo zoom da vista (px/m): baixo até 1 px = 0,012 m; médio até 1 px = 0,004 m; alto abaixo disso.
 * Com o registro de limiares da geometria, anota os dois limiares consultados (ver `limiares.ts`).
 */
export function openingDetailByZoom(zoom: number, limiares?: { registrar(z: number): void }): 'low' | 'mid' | 'high' {
  limiares?.registrar(OPENING_DETAIL_ZOOMS[0]);
  limiares?.registrar(OPENING_DETAIL_ZOOMS[1]);
  if (!Number.isFinite(zoom) || zoom <= 0) return 'low';
  if (zoom <= OPENING_DETAIL_ZOOMS[0]) return 'low';
  if (zoom <= OPENING_DETAIL_ZOOMS[1]) return 'mid';
  return 'high';
}

/** Detalhe efetivo do tipo: `'scale'` escolhe pelo zoom; `'off'` continua desligado. */
export function openingPlanDetail(detail: 'scale' | OpeningSymbolDetail, zoom: number, limiares?: { registrar(z: number): void }): OpeningSymbolDetail {
  return detail === 'scale' ? openingDetailByZoom(zoom, limiares) : detail;
}

const at = (c: Vec2, u: Vec2, n: Vec2, t: number, s: number): Vec2 => ({
  x: c.x + u.x * t + n.x * s,
  y: c.y + u.y * t + n.y * s,
});

/**
 * Traços da planta da esquadria em coordenadas do mundo: a geometria local do vão (`openingPlanPaths`, do engine) posta
 * no lugar pela geometria da abertura. A planta e o DXF usam esta função, então o desenho é o mesmo nos dois.
 */
export function openingPlanWorldPaths(g: OpeningGeometry, model: OpeningModel, opts: OpeningSymbolOptions): OpeningPlanWorldPath[] {
  if (opts.detail === 'off') return [];
  return openingPlanPaths(model, { ...opts, detail: opts.detail }).map((p) => ({
    pts: p.pts.map((q) => at(g.center, g.u, g.n, q.t, q.s)),
    closed: p.closed,
    weight: p.weight,
    tone: p.tone,
    ...(p.dash ? { dash: p.dash } : {}),
    role: p.role,
  }));
}

/**
 * Símbolo de planta da abertura, a partir do modelo único (spec E §4.1). `cut` vai na tinta com a espessura de corte;
 * `ink` e `soft` seguem o desenho de antes (tinta e tinta leve, com o fator de peso do traço).
 */
export function openingSymbol(g: OpeningGeometry, model: OpeningModel, theme: PlanTheme, largura: number | Espessura, opts: OpeningSymbolOptions): StrokeOp[] {
  const base: Espessura = typeof largura === 'number' ? { widthPx: largura } : largura;
  return openingPlanWorldPaths(g, model, opts).map((s) => ({
    pts: s.pts,
    closed: s.closed,
    ...espessuraVezes(base, s.weight),
    color: s.tone === 'soft' ? theme.inkSoft : theme.ink,
    alpha: 1,
    ...(s.dash ? { dash: s.dash } : {}),
  }));
}
