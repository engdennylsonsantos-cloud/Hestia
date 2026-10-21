import { boxOf, boxesOverlap, differenceClipper, multiArea, multiPoints, type Box, type MultiPolygon } from '@hestia/geom';

/**
 * Remoção de superfícies ocultas (linha oculta, como Revit e Archicad) em (t, z) para o corte e a elevação.
 *
 * Cada item é um multipolígono em (t, z) com a profundidade do seu ponto mais próximo ao plano. Ordena-se do mais
 * perto ao mais longe; `occluder` é a união das partes visíveis já processadas (opacas: paredes, pisos, lajes,
 * telhados, escadas e aberturas, com caixilho, folha e vidro). A parte visível de cada item é o polígono menos o
 * `occluder`, e só então ele entra no `occluder`. Empate de profundidade: pela `rank` (corte antes de abertura, que
 * vem antes do além) e depois pela ordem da lista.
 *
 * Desempenho: uma caixa envolvente por item; só se subtrai dos já processados cuja caixa encosta na do item, o que
 * é exato (os demais não mudam o resultado) e poupa quase todas as operações booleanas num projeto grande.
 */

/** Ordem de empate na mesma profundidade: o corte antes, depois as aberturas, depois o que está além. */
export const OCCLUSION_RANK = { cut: 0, opening: 1, beyond: 2 } as const;

/** Área (m²) abaixo da qual uma parte visível é descartada: resíduo numérico de contato, não superfície. */
export const MIN_VISIBLE_AREA = 1e-6;

export interface OcclusionItem {
  /** Distância do plano de corte (ou da linha de elevação) ao ponto mais próximo do item. */
  depth: number;
  /** Ordem de empate (`OCCLUSION_RANK`). */
  rank: number;
  polygons: MultiPolygon;
}

/**
 * Parte visível de cada item, alinhada a `items` (multipolígono vazio quando o item está oculto ou é residual).
 */
export function visibleParts(items: OcclusionItem[]): MultiPolygon[] {
  const out: MultiPolygon[] = items.map((): MultiPolygon => []);
  const order = items
    .map((_, i) => i)
    .filter((i) => items[i]!.polygons.length > 0)
    .sort((i, j) => items[i]!.depth - items[j]!.depth || items[i]!.rank - items[j]!.rank || i - j);

  const occluders: Array<{ box: Box; polygons: MultiPolygon }> = [];
  for (const i of order) {
    const item = items[i]!;
    const box = boxOf(multiPoints(item.polygons));
    const hits: MultiPolygon[] = [];
    for (const o of occluders) if (boxesOverlap(o.box, box, 1e-9)) hits.push(o.polygons);
    const visible = hits.length > 0 ? differenceClipper(item.polygons, ...hits) : item.polygons;
    if (visible.length === 0 || multiArea(visible) < MIN_VISIBLE_AREA) continue;
    out[i] = visible;
    occluders.push({ box: boxOf(multiPoints(visible)), polygons: visible });
  }
  return out;
}
