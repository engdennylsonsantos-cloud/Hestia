import { boxOf, multiPoints, union, type MultiPolygon, type Polygon } from '@hestia/geom';
import type { HatchKind, Id } from '@hestia/model';
import type { SectionOrigin, SectionRegion } from './section.ts';
import { OCCLUSION_RANK, type OcclusionItem } from './sectionOcclusion.ts';
import { originKey, partsByOrigin, type SectionPart } from './sectionParts.ts';

/** Um material do corte antes da oclusão: os polígonos de cada origem (ainda sem o que está na frente). */
export interface CutEntry {
  materialId: Id;
  hatch?: HatchKind;
  items: Array<{ polygon: Polygon; origin: SectionOrigin }>;
}

/** Peça do corte (uma por origem em cada material) com o item de oclusão dela. `entry` é o índice do material. */
export interface CutPiece {
  entry: number;
  part: SectionPart;
  item: OcclusionItem;
}

/**
 * Peças do corte para a linha oculta. A cota de cada uma é a faixa do elemento de origem inteiro (somando todos os
 * materiais dele), para a regra de contenção de parede em piso (`cotaKeys`).
 */
export function cutPieces(entries: CutEntry[], sources: SectionOrigin[][]): CutPiece[] {
  const parts = entries.flatMap((entry, e) => partsByOrigin(entry.items, sources[e]!).map((part) => ({ entry: e, part })));
  const span = new Map<string, { bottom: number; top: number }>();
  for (const { part } of parts) {
    const key = originKey(part.origin);
    const b = boxOf(multiPoints(part.polygons));
    const s = span.get(key) ?? { bottom: Infinity, top: -Infinity };
    span.set(key, { bottom: Math.min(s.bottom, b.minY), top: Math.max(s.top, b.maxY) });
  }
  return parts.map(({ entry, part }) => {
    const s = span.get(originKey(part.origin))!;
    const cota = { bottom: s.bottom, top: s.top, wall: part.origin.wallId !== undefined };
    return { entry, part, item: { depth: 0, rank: OCCLUSION_RANK.cut, polygons: part.polygons, cota } };
  });
}

/** Regiões de corte por material, a partir das peças visíveis (uma região por material, como antes da oclusão por peça). */
export function cutRegions(entries: CutEntry[], sources: SectionOrigin[][], visible: SectionPart[][]): SectionRegion[] {
  const out: SectionRegion[] = [];
  entries.forEach((entry, e) => {
    const pieces = visible[e]!;
    if (pieces.length === 0) return;
    out.push({
      materialId: entry.materialId,
      hatch: entry.hatch,
      polygons: union(...pieces.map((q): MultiPolygon => q.polygons)),
      sources: sources[e]!,
      parts: pieces,
    });
  });
  return out;
}
