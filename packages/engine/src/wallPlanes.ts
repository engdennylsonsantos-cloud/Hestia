import { coreSpan, type WallDimRef } from '@hestia/model';
import { sAtDepth, type WallFrame } from './frame.ts';

/**
 * Planos de uma parede na normal (coordenada `s` do `WallFrame`, que mede para a esquerda de a→b). `faceLo`/`faceHi` são
 * as faces acabadas e `coreLo`/`coreHi` as faces do núcleo, ordenadas por `s`; `axis` é o centro da espessura total.
 */
export interface WallPlanes {
  axis: number;
  faceLo: number;
  faceHi: number;
  coreLo: number;
  coreHi: number;
  coreCenter: number;
}

export function wallPlanes(frame: WallFrame): WallPlanes {
  const core = coreSpan(frame.type);
  const c0 = sAtDepth(frame, core.from);
  const c1 = sAtDepth(frame, core.to);
  const coreLo = Math.min(c0, c1);
  const coreHi = Math.max(c0, c1);
  return { axis: frame.sMid, faceLo: frame.sLo, faceHi: frame.sHi, coreLo, coreHi, coreCenter: (coreLo + coreHi) / 2 };
}

/**
 * Posição (na normal) do plano `ref` voltado para o lado `toward` (+1 = lado de `n`, −1 = oposto): é a face que fica
 * entre a parede e o elemento medido. `axis` e `coreCenter` não dependem do lado.
 */
export function wallPlaneAt(planes: WallPlanes, ref: WallDimRef, toward: 1 | -1): number {
  switch (ref) {
    case 'axis':
      return planes.axis;
    case 'coreCenter':
      return planes.coreCenter;
    case 'finish':
      return toward > 0 ? planes.faceHi : planes.faceLo;
    case 'coreFace':
      return toward > 0 ? planes.coreHi : planes.coreLo;
  }
}
