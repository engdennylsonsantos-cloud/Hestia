import { boxOf, boxesOverlap, differenceClipper, multiPoints, type Box, type MultiPolygon } from '@hestia/geom';
import type { Id } from '@hestia/model';

/** O que o recorte precisa de cada item do cluster: a parede dona e a caixa envolvente. */
export interface ClipItem {
  wallId: Id;
  box: Box;
}

/** Retorno de acabamento no vão (`insertReturns`): só a forma importa para o recorte. */
export interface ReturnPiece {
  poly: MultiPolygon;
}

/**
 * Recorte de retorno de acabamento contra as paredes vizinhas já pintadas: o retorno não invade parede vizinha
 * (vão perto de um canto ou de um T). Devolve uma função com memo por (retorno, conjunto pintado).
 *
 * O memo vive só no escopo desta chamada (uma por resolução de cluster). `painted` é o mapa do cache de tinta, então
 * a identidade do mapa é a identidade do conjunto ativo; `r` é único por (parede, camada, vão). Ver docs/08 §4 (P-1).
 */
export function makeReturnClipper<T extends ClipItem>(items: readonly T[]): (r: ReturnPiece, wallId: Id, painted: Map<T, MultiPolygon>) => MultiPolygon {
  const clipOf = (poly: MultiPolygon, wallId: Id, painted: Map<T, MultiPolygon>): MultiPolygon => {
    const box = boxOf(multiPoints(poly));
    const subs: MultiPolygon[] = [];
    for (const i of items) {
      if (i.wallId === wallId || !boxesOverlap(i.box, box)) continue;
      const f = painted.get(i);
      if (f && f.length) subs.push(f);
    }
    return differenceClipper(poly, ...subs);
  };
  const memo = new Map<ReturnPiece, Map<Map<T, MultiPolygon>, MultiPolygon>>();
  return (r, wallId, painted) => {
    const byPaint = memo.get(r) ?? new Map<Map<T, MultiPolygon>, MultiPolygon>();
    memo.set(r, byPaint);
    if (!byPaint.has(painted)) byPaint.set(painted, clipOf(r.poly, wallId, painted));
    return byPaint.get(painted)!;
  };
}
