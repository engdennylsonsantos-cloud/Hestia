import { openingSymbolPaths } from '@hestia/geom';
import type { OpeningGeometry } from '@hestia/engine';
import { espessuraVezes } from './espessura.ts';
import type { Espessura, PlanTheme, StrokeOp } from './types.ts';

/**
 * Símbolo de planta da abertura, por família (`plan`) e número de folhas (a geometria é `openingSymbolPaths`, no geom,
 * compartilhada com o DXF). Aqui só se dá a cor e a espessura: traço principal na tinta, secundário na tinta leve.
 */
export function openingSymbol(g: OpeningGeometry, theme: PlanTheme, largura: number | Espessura = 1.2): StrokeOp[] {
  const base: Espessura = typeof largura === 'number' ? { widthPx: largura } : largura;
  return openingSymbolPaths(g).map((s) => ({
    pts: s.pts,
    closed: s.closed,
    ...espessuraVezes(base, s.weight),
    color: s.tone === 'ink' ? theme.ink : theme.inkSoft,
    alpha: 1,
    dash: s.dash,
  }));
}
