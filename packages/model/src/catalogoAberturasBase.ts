import type { OpeningType } from './types.ts';

/**
 * Monta um tipo de abertura do catálogo com o vidro padrão e o fechamento herdado do tipo de parede. `frame` é o material
 * do batente (madeira nas portas, alumínio nas janelas). Usado por defaults.ts e pelos catálogos brasileiros.
 */
export const ot = (o: Omit<OpeningType, 'frameMaterialId' | 'glassMaterialId' | 'closure'>, frame = 'mat_madeira'): OpeningType => ({
  ...o,
  frameMaterialId: frame,
  glassMaterialId: 'mat_vidro',
  closure: 'inherit',
});
