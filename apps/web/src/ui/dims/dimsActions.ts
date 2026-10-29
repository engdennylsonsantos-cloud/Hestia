import { formatQuantity, type Command, type ResolvedUnits } from '@hestia/model';
import { parseQuantityText, type TempDim } from '@hestia/tools';

export type DimEditOutcome = { kind: 'done'; commands: Command[]; note?: string } | { kind: 'error'; message: string };

/** Duração do destaque vermelho de uma cota recusada (ms): feedback efêmero de interface. */
export const INVALID_FLASH_MS = 4000;

/**
 * Resolve o texto digitado numa cota: lê na unidade do projeto e pede ao provedor os comandos. Função pura: quem chama
 * executa os comandos (um passo de desfazer) ou mostra a mensagem.
 */
export function resolveDimEdit(dim: TempDim, text: string, units: ResolvedUnits): DimEditOutcome {
  if (!dim.edit) return { kind: 'error', message: 'Esta cota é só de leitura.' };
  const q = dim.quantity ?? 'length';
  const si = parseQuantityText(text, units, q);
  if (si === null) {
    const exemplo = formatQuantity(units, q, q === 'angle' ? Math.PI / 4 : 1.2, { trim: true });
    const nome = q === 'angle' ? 'um ângulo' : 'uma distância';
    return { kind: 'error', message: `Medida inválida: digite ${nome}, como ${exemplo}.` };
  }
  const r = dim.edit(si);
  if ('error' in r) return { kind: 'error', message: r.error };
  return { kind: 'done', commands: r.commands, ...(r.note ? { note: r.note } : {}) };
}
