import { voidCrossPaths, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import type { DetailLevel } from '@hestia/model';
import type { PlanPaint } from './style.ts';
import type { PlanTheme, StrokeOp } from './types.ts';

/**
 * X dos furos quadrangulares de piso, laje ou telhado na planta (decisão 0024 §3): as duas diagonais que ligam os
 * vértices opostos do contorno do furo (shaft, claraboia). Furo com mais de quatro vértices não leva X, porque a
 * diagonal entre vértices opostos só é definida para quadrilátero. No grosseiro o símbolo não sai. A largura é a da
 * projeção da categoria (o X segue a categoria do elemento, com peso e visibilidade dela).
 */
export function holeMarkOps(polygon: MultiPolygon, theme: PlanTheme, paint: PlanPaint, detail: DetailLevel): StrokeOp[] {
  if (detail === 'coarse') return [];
  const out: StrokeOp[] = [];
  for (const poly of polygon) {
    for (const hole of poly.slice(1)) {
      const q = quadOf(hole);
      if (!q) continue;
      for (const seg of voidCrossPaths(q)) out.push({ pts: seg, closed: false, widthPx: paint.projPx, color: theme.inkSoft, alpha: 1 });
    }
  }
  return out;
}

/** Os quatro vértices do anel, sem o ponto de fechamento repetido; `null` se não houver exatamente quatro. */
function quadOf(ring: Ring): [Vec2, Vec2, Vec2, Vec2] | null {
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = ring.length > 1 && first !== undefined && last !== undefined && first.x === last.x && first.y === last.y;
  const pts = closed ? ring.slice(0, -1) : ring;
  if (pts.length !== 4) return null;
  const [a, b, c, d] = pts;
  return a && b && c && d ? [a, b, c, d] : null;
}
