import { applyTransform, type Transform } from '@hestia/geom';
import { mapStairComponent } from './stairTransform.ts';
import type { Ramp } from './rampTypes.ts';

/** Move, gira ou espelha uma rampa: todos os croquis de todos os componentes. Espelhar inverte o lado do giro. */
export function transformRamp(r: Ramp, t: Transform): Ramp {
  return {
    ...r,
    components: r.components.map((c) => mapStairComponent(t, c)),
    // Forma livre: o trajeto acompanha a transformação, senão a regeneração desfaria o movimento.
    ...(r.freePath ? { freePath: r.freePath.map((v) => applyTransform(t, v)) } : {}),
    turn: t.kind === 'mirror' ? (r.turn === 'left' ? 'right' : 'left') : r.turn,
  };
}
