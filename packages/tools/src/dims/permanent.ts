import { newId, type Command, type Id } from '@hestia/model';
import type { TempDim } from './types.ts';

/**
 * Converte cotas dinâmicas em cotas permanentes (ícone "I"): um `addDimension` por `TempDim`, com os mesmos pontos,
 * afastamento e medida. Sem `unit`/`precision`/`prefix`: a leitura segue as unidades do projeto. As cotas nascem livres
 * (sem `refs`): os pontos medidos são faces e bordas de esquadria, que não são extremidades de parede.
 */
export function toPermanent(levelId: Id, dims: readonly TempDim[]): Command[] {
  return dims.map((d) => ({
    type: 'addDimension' as const,
    levelId,
    dimension: { id: newId('dim'), a: { ...d.a }, b: { ...d.b }, offset: d.offset, mode: 'aligned' as const },
  }));
}
