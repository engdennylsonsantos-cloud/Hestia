import { applyTransform, type Transform } from '@hestia/geom';
import type { Stair, StairCurve, StairLanding, StairRun } from './stairTypes.ts';

/** Espelhar inverte o sentido do arco (flecha negada), como nas paredes; mover e girar mantêm a flecha. */
const mapCurve = (t: Transform, c: StairCurve): StairCurve => ({
  a: applyTransform(t, c.a),
  b: applyTransform(t, c.b),
  sag: t.kind === 'mirror' ? -c.sag : c.sag,
});

const mapChain = (t: Transform, chain: StairCurve[]): StairCurve[] => chain.map((c) => mapCurve(t, c));

function mapComponent(t: Transform, c: StairRun | StairLanding): StairRun | StairLanding {
  if (c.kind === 'landing') return { ...c, boundary: mapChain(t, c.boundary) };
  // Espelhar troca os limites: o esquerdo no sentido de subida passa a ser o direito do sentido refletido.
  const mirror = t.kind === 'mirror';
  return {
    ...c,
    boundaryLeft: mapChain(t, mirror ? c.boundaryRight : c.boundaryLeft),
    boundaryRight: mapChain(t, mirror ? c.boundaryLeft : c.boundaryRight),
    risers: mapChain(t, c.risers),
    path: mapChain(t, c.path),
  };
}

/** Move, gira ou espelha uma escada: todos os croquis de todos os componentes. */
export function transformStair(s: Stair, t: Transform): Stair {
  return { ...s, components: s.components.map((c) => mapComponent(t, c)) };
}
