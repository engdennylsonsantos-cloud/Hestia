import { espessuraDeCorte, espessuraDeProjecao, type PlanPaint } from './style.ts';
import { espessuraVezes } from './espessura.ts';
import type { Espessura } from './types.ts';

/**
 * Espessuras das linhas do telhado na planta (proposta aprovada de representação). O beiral é a espessura de corte do
 * app (`espessuraDeCorte`, decisão 0015) e a empena sai dele por 0,75×. As arestas internas (cumeeira, espigão e
 * rincão), a pegada e as setas de caimento são traços finos, na espessura de projeção: 1 px na tela com as linhas
 * finas padrão (`thin.ts`). A pegada, que só aparece com balanço, é mais fina que a projeção. Assim, mudar o peso do
 * telhado na vista muda todas juntas.
 */
export interface EspessurasDoTelhado {
  beiral: Espessura;
  empena: Espessura;
  /** Cumeeira, espigão, rincão, projeção de fora da vista e setas de caimento. */
  projecao: Espessura;
  /** Pegada rosa com balanço: mais fina que a projeção, para não competir com o beiral. */
  pegada: Espessura;
}

export function espessurasDoTelhado(paint: PlanPaint): EspessurasDoTelhado {
  const corte = espessuraDeCorte(paint);
  const projecao = espessuraDeProjecao(paint);
  return {
    beiral: corte,
    empena: espessuraVezes(corte, 0.75),
    projecao,
    pegada: espessuraVezes(projecao, 0.6),
  };
}
