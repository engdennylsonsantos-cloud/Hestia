import { espessuraDeCorte, espessuraDeProjecao, type PlanPaint } from './style.ts';
import { espessuraVezes } from './espessura.ts';
import type { Espessura } from './types.ts';

/**
 * Espessuras das linhas do telhado na planta (proposta aprovada de representação). A base é a espessura de corte do
 * app (`espessuraDeCorte`, decisão 0015): o beiral e o rincão são o corte (2 px na proposta), e os demais tipos saem
 * dele pela proporção da proposta (cumeeira 3 px = 1,5×; espigão 2,5 px = 1,25×; empena 1,5 px = 0,75×). Pegada
 * (projeção) e setas de caimento usam a espessura de projeção (1 px na proposta). Assim, mudar o peso do telhado na
 * vista muda todas juntas.
 */
export interface EspessurasDoTelhado {
  cumeeira: Espessura;
  espigao: Espessura;
  rincao: Espessura;
  beiral: Espessura;
  empena: Espessura;
  /** Pegada com balanço, projeção do telhado de fora da vista e setas de caimento. */
  projecao: Espessura;
}

export function espessurasDoTelhado(paint: PlanPaint): EspessurasDoTelhado {
  const corte = espessuraDeCorte(paint);
  return {
    cumeeira: espessuraVezes(corte, 1.5),
    espigao: espessuraVezes(corte, 1.25),
    rincao: corte,
    beiral: corte,
    empena: espessuraVezes(corte, 0.75),
    projecao: espessuraDeProjecao(paint),
  };
}
