import { dist, type Vec2 } from '@hestia/geom';
import type { DimProvider, TempDim } from '../types.ts';

/** Deslocamento em gesto (mover/copiar): do ponto-base ao cursor. */
export interface DisplacementSubject {
  from: Vec2;
  to: Vec2;
}

const PROVIDER_ID = 'displacement';
const DIM_OFFSET = 0.15;

const end = (at: Vec2, slot: string) => ({ at, slot, kind: 'wall' as const, current: 'axis' as const, options: ['axis'] as const });

/**
 * Cota do deslocamento durante o gesto de mover/copiar (só leitura: a digitação já existe nas ferramentas). O overlay
 * desenha a mesma linha de cota e o mesmo campo de todas as cotas; o valor segue as unidades do projeto.
 */
export const displacementDimProvider: DimProvider<DisplacementSubject> = {
  id: PROVIDER_ID,
  compute(_ctx, subject): TempDim[] {
    const value = dist(subject.from, subject.to);
    if (!(value > 1e-9)) return [];
    return [
      {
        key: `${PROVIDER_ID}:gesture:length`,
        a: subject.from,
        b: subject.to,
        offset: DIM_OFFSET,
        value,
        ends: [end(subject.from, 'from'), end(subject.to, 'to')],
      },
    ];
  },
};
