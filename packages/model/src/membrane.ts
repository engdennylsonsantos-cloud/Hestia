import type { Layer } from './types.ts';
import { FUNCTION_PRIORITY } from './priority.ts';

/**
 * Membrana de piso e laje (decisão 0023 §5, como a parede na decisão 0005 #8): a camada de função Membrana ou de
 * espessura zero. Não tem volume nem sólido; a planta e o corte desenham a linha na face da camada. A identificação
 * é pela função ou pela espessura, nunca pelo nome do material.
 */
export const isMembraneLayer = (l: Layer): boolean => l.function === 'membrane' || l.thickness < 1e-6;

/**
 * Prioridade de junção da membrana (decisão 0023 §1.1, aprovada em P-1). Usada pelo resolvedor de junção piso/laje ×
 * parede (P7); sem ela a face de espessura zero não corta nem é cortada por volume.
 */
export const MEMBRANE_PRIORITY: number = FUNCTION_PRIORITY.membrane;
