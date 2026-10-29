import type { Transform } from '@hestia/geom';
import { mapStairComponent } from './stairTransform.ts';
import type { Ramp } from './rampTypes.ts';

/** Move, gira ou espelha uma rampa: todos os croquis de todos os componentes. Espelhar inverte o lado do giro. */
export function transformRamp(r: Ramp, t: Transform): Ramp {
  return {
    ...r,
    components: r.components.map((c) => mapStairComponent(t, c)),
    turn: t.kind === 'mirror' ? (r.turn === 'left' ? 'right' : 'left') : r.turn,
  };
}
