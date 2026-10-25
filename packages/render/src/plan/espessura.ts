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
  return s.papel ? paperMmToPx(s.papel.mm, zoom, s.papel.escala) : s.widthPx;
}

/** Espessura de papel de `mm` na escala 1:`escala`, com a largura em px já calculada para o `zoom` de construção. */
export function espessuraDePapel(mm: number, zoom: number, escala: number): Espessura {
  return { widthPx: paperMmToPx(mm, zoom, escala), papel: { mm, escala } };
}
