import type { Id, OpeningType, Project } from './types.ts';

/**
 * Referência nominal do tipo (ArchiCAD: Nominal Size; NBR 15930-2). No Brasil "porta 80 x 210" é a FOLHA e o vão na
 * parede é maior (folha + 80 mm na largura e + 50 mm na altura, para fixação mecânica). A ÚNICA fonte do tamanho do vão
 * é este arquivo: com `nominalRef` 'opening' (padrão) `width`/`height` já são o vão; com 'leaf' são a folha e o vão é
 * derivado (folha + folga). O motor lê o tipo por `spanTypeOf`/`openingTypeOf` (width/height já = vão); o quadro e o
 * diálogo, que mostram a folha, usam `leafSizeOf`.
 */

/** Folga padrão do vão em relação à folha nominal (m): NBR 15930-2, folha + 80 mm na largura e + 50 mm na altura. */
export const OPENING_SPAN_GAP_DEFAULTS = { w: 0.08, h: 0.05 } as const;
/** Limite da folga (m) aceito ao salvar o tipo. */
export const OPENING_SPAN_GAP_MAX = 0.3;

type NominalFields = Pick<OpeningType, 'width' | 'height'> & Partial<Pick<OpeningType, 'nominalRef' | 'spanGap'>>;

const gapOr = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);

/** A que `width`/`height` se referem: 'opening' (padrão) ou 'leaf'. */
export const openingNominalRef = (t: Pick<OpeningType, 'nominalRef'>): 'opening' | 'leaf' => (t.nominalRef === 'leaf' ? 'leaf' : 'opening');

/** Folga do vão sobre a folha (m), com o padrão da NBR 15930-2 onde o campo falta ou é inválido. */
export function openingSpanGap(t: Partial<Pick<OpeningType, 'spanGap'>>): { w: number; h: number } {
  return { w: gapOr(t.spanGap?.w, OPENING_SPAN_GAP_DEFAULTS.w), h: gapOr(t.spanGap?.h, OPENING_SPAN_GAP_DEFAULTS.h) };
}

/** Vão do tipo (m): o que o motor recorta na parede e onde o batente se assenta. */
export function openingSpanOf(t: NominalFields): { width: number; height: number } {
  if (openingNominalRef(t) !== 'leaf') return { width: t.width, height: t.height };
  const g = openingSpanGap(t);
  return { width: t.width + g.w, height: t.height + g.h };
}

/** Folha nominal do tipo (m): `width`/`height` com 'leaf'; com 'opening', o vão menos a folga (nunca negativa). */
export function leafSizeOf(t: NominalFields): { width: number; height: number } {
  if (openingNominalRef(t) === 'leaf') return { width: t.width, height: t.height };
  const g = openingSpanGap(t);
  return { width: Math.max(0, t.width - g.w), height: Math.max(0, t.height - g.h) };
}

/**
 * O mesmo tipo com `width`/`height` = VÃO. Com 'opening' devolve o próprio objeto (identidade: nenhum projeto
 * existente muda); com 'leaf' devolve uma cópia com `nominalRef` 'opening', para que o tipo normalizado não some a folga duas vezes.
 */
export function spanTypeOf<T extends NominalFields>(t: T): T {
  if (openingNominalRef(t) !== 'leaf') return t;
  const s = openingSpanOf(t);
  return { ...t, width: s.width, height: s.height, nominalRef: 'opening' };
}

/** Tipo de abertura do projeto já normalizado para o vão (undefined quando não existe). */
export function openingTypeById(p: Pick<Project, 'openingTypes'>, id: Id): OpeningType | undefined {
  const t = p.openingTypes[id];
  return t ? spanTypeOf(t) : undefined;
}
