import { paperMmToPx } from '@hestia/model';
import type { Espessura, PesoPapel, StrokeOp } from './types.ts';

/**
 * Espessura de traço em mm de papel: a conta que a GPU refaz no shader. `kPapel` é a espessura em "unidades de mundo
 * por zoom" (mm × escala ÷ 1000), e o shader põe `max(1, kPapel × zoom)` em pixels, a mesma regra de `paperMmToPx`.
 */

/** Espessura de papel em unidades de mundo por zoom: o shader multiplica pelo zoom corrente. */
export function kPapel(peso: PesoPapel): number {
  return (peso.mm * peso.escala) / 1000;
}

/** Largura em pixels de tela de um traço no `zoom` dado: a do papel (piso de 1 px) se há `papel`, senão `widthPx`. */
export function larguraEmPx(s: Pick<StrokeOp, 'widthPx' | 'papel'>, zoom: number): number {
  const pp = s.papel;
  if (!pp) return s.widthPx;
  const w = paperMmToPx(pp.mm, zoom, pp.escala) * (pp.fator ?? 1);
  return pp.teto !== undefined ? Math.min(pp.teto, w) : w;
}

/** Espessura `e` multiplicada por `fator` (largura em px e peso de papel): a largura do símbolo é o peso vezes a da categoria. */
export function espessuraVezes(e: Espessura, fator: number): Espessura {
  return e.papel ? { widthPx: e.widthPx * fator, papel: { ...e.papel, fator: (e.papel.fator ?? 1) * fator } } : { widthPx: e.widthPx * fator };
}

/** Espessura de papel de `mm` na escala 1:`escala`, com a largura em px já calculada para o `zoom` de construção. */
export function espessuraDePapel(mm: number, zoom: number, escala: number): Espessura {
  return { widthPx: paperMmToPx(mm, zoom, escala), papel: { mm, escala } };
}
