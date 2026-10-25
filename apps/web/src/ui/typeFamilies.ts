import { openingFamilyOf, type OpeningType } from '@hestia/model';

/** Família exibida no seletor de tipo e no cabeçalho do diálogo: cada categoria tem uma família única. */
export const FAMILY = {
  wall: 'Parede básica',
  floor: 'Piso',
  slab: 'Laje',
  ceiling: 'Forro',
  roof: 'Telhado',
  stair: 'Escada',
} as const;

/** Família de uma abertura (Porta de giro, Janela de correr…); tipo sem família válida cai em "Outros". */
export function openingFamilyName(t: Pick<OpeningType, 'kind' | 'plan' | 'leaves'>): string {
  return openingFamilyOf(t)?.name ?? 'Outros';
}
