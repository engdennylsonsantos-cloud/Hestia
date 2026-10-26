import { ContadoresPerf } from './contadores.ts';

/**
 * Instância única de contadores do app. O render (planFrame, gpu.ts) e o painel da web precisam do mesmo objeto; por isso
 * ele mora no pacote de render e não na aplicação. Inativo por padrão: nada é medido sem `?perf=1`.
 */
export const contadores = new ContadoresPerf();
