import { espessuraDeCorte, espessuraDeProjecao, type PlanPaint } from './style.ts';
import { espessuraVezes } from './espessura.ts';
import type { Espessura } from './types.ts';

/**
 * Espessuras das linhas do telhado na planta (proposta aprovada de representação). O beiral é a espessura de corte do
 * app (`espessuraDeCorte`, decisão 0015) e a empena sai dele por 0,75×. As arestas internas (cumeeira, espigão e
 * rincão), a pegada e as setas de caimento são traços finos, na espessura de projeção: 1 px na tela com as linhas
 * finas padrão (`thin.ts`). Assim, mudar o peso do telhado na vista muda todas juntas.
 */
export interface EspessurasDoTelhado {
  beiral: Espessura;
  empena: Espessura;
  /** Cumeeira, espigão, rincão, pegada com balanço, projeção de fora da vista e setas de caimento. */
  projecao: Espessura;
}

export function espessurasDoTelhado(paint: PlanPaint): EspessurasDoTelhado {
  const corte = espessuraDeCorte(paint);
  return {
    beiral: corte,
    empena: espessuraVezes(corte, 0.75),
    projecao: espessuraDeProjecao(paint),
  };
}
