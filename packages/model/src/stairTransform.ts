import { applyTransform, type Transform } from '@hestia/geom';
import type { Stair, StairCurve, StairLanding, StairRun, StairSpiralParams } from './stairTypes.ts';

/** Espelhar inverte o sentido do arco (flecha negada), como nas paredes; mover e girar mantêm a flecha. */
const mapCurve = (t: Transform, c: StairCurve): StairCurve => ({
  a: applyTransform(t, c.a),
  b: applyTransform(t, c.b),
  sag: t.kind === 'mirror' ? -c.sag : c.sag,
});

const mapChain = (t: Transform, chain: StairCurve[]): StairCurve[] => chain.map((c) => mapCurve(t, c));

/**
 * Parâmetros do caracol acompanham o croqui (decisão 0014 §2): o centro é transformado como ponto; mover mantém os
 * ângulos; girar soma o ângulo; espelhar reflete o ângulo inicial em torno do eixo e inverte o sentido da varredura.
 */
function mapSpiral(t: Transform, sp: StairSpiralParams): StairSpiralParams {
  const center = applyTransform(t, sp.center);
  if (t.kind === 'translate') return { ...sp, center };
  if (t.kind === 'rotate') return { ...sp, center, startAngle: sp.startAngle + t.angle };
  const axis = Math.atan2(t.b.y - t.a.y, t.b.x - t.a.x);
  return { ...sp, center, startAngle: 2 * axis - sp.startAngle, sweep: -sp.sweep };
}

export function mapStairComponent(t: Transform, c: StairRun | StairLanding): StairRun | StairLanding {
  if (c.kind === 'landing') return { ...c, boundary: mapChain(t, c.boundary) };
  // Espelhar troca os limites: o esquerdo no sentido de subida passa a ser o direito do sentido refletido.
  const mirror = t.kind === 'mirror';
  return {
    ...c,
    boundaryLeft: mapChain(t, mirror ? c.boundaryRight : c.boundaryLeft),
    boundaryRight: mapChain(t, mirror ? c.boundaryLeft : c.boundaryRight),
    risers: mapChain(t, c.risers),
    path: mapChain(t, c.path),
    ...(c.spiral ? { spiral: mapSpiral(t, c.spiral) } : {}),
  };
}

/** Move, gira ou espelha uma escada: todos os croquis de todos os componentes e o trajeto da escada livre. */
export function transformStair(s: Stair, t: Transform): Stair {
  return {
    ...s,
    components: s.components.map((c) => mapStairComponent(t, c)),
    // Escada livre: o trajeto acompanha a transformação, senão a regeneração desfaria o movimento.
    ...(s.freePath ? { freePath: s.freePath.map((v) => applyTransform(t, v)) } : {}),
  };
}
