import { intersection, union, type MultiPolygon, type Polygon } from '@hestia/geom';
import type { SectionOrigin } from './section.ts';

/**
 * Peça do corte unido: o polígono (já recortado pela oclusão, se houver) de uma origem. Permite à seleção achar o
 * elemento de cada trecho do corte que o motor une por material (decisão 0016 §7).
 */
export interface SectionPart {
  origin: SectionOrigin;
  polygons: MultiPolygon;
}

/** Chave estável de uma origem (por valor), para agrupar e distinguir origens. */
const originKey = (o: SectionOrigin): string => JSON.stringify(o);

/** Origens distintas (por valor), na ordem da primeira aparição. */
export function uniqueOrigins(list: SectionOrigin[]): SectionOrigin[] {
  const seen = new Set<string>();
  const out: SectionOrigin[] = [];
  for (const o of list) {
    const key = originKey(o);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

/**
 * Parte de cada origem (união dos polígonos dela) antes da oclusão. `sources` vem sem repetição; cada polígono de
 * `list` entra na peça da origem de chave igual.
 */
export function partsByOrigin(list: Array<{ polygon: Polygon; origin: SectionOrigin }>, sources: SectionOrigin[]): SectionPart[] {
  return sources.map((origin) => ({
    origin,
    polygons: union(...list.filter((c) => originKey(c.origin) === originKey(origin)).map((c): MultiPolygon => [c.polygon])),
  }));
}

/** Recorta cada peça pela região visível (oclusão já aplicada) e descarta as que não sobraram. */
export function clipParts(parts: SectionPart[] | undefined, visible: MultiPolygon): SectionPart[] | undefined {
  if (!parts) return undefined;
  return parts
    .map((part): SectionPart => ({ origin: part.origin, polygons: intersection(part.polygons, visible) }))
    .filter((part) => part.polygons.length > 0);
}
