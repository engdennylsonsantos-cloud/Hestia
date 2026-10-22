import { applyTransform, type Transform, type Vec2 } from '@hestia/geom';
import { type Floor, type Slab } from './types.ts';

/** Move/gira/espelha um piso; espelhar inverte o sentido do contorno (a orientação não importa ao motor, mas fica estável). */
export function transformFloor(f: Floor, t: Transform): Floor {
  const pts = (ring: Vec2[]): Vec2[] => {
    const out = ring.map((q) => applyTransform(t, q));
    return t.kind === 'mirror' ? out.reverse() : out;
  };
  return { ...f, boundary: pts(f.boundary), holes: f.holes.map(pts) };
}

/** Move/gira/espelha uma laje: contorno, furos e a linha de inclinação (origem e direção). */
export function transformSlab(s: Slab, t: Transform): Slab {
  const pts = (ring: Vec2[]): Vec2[] => {
    const out = ring.map((q) => applyTransform(t, q));
    return t.kind === 'mirror' ? out.reverse() : out;
  };
  let slope = s.slope;
  if (slope) {
    const o = applyTransform(t, slope.origin);
    const e = applyTransform(t, { x: slope.origin.x + slope.dir.x, y: slope.origin.y + slope.dir.y });
    const dx = e.x - o.x;
    const dy = e.y - o.y;
    const l = Math.hypot(dx, dy) || 1;
    slope = { origin: o, dir: { x: dx / l, y: dy / l }, percent: slope.percent };
  }
  return { ...s, boundary: pts(s.boundary), holes: s.holes.map(pts), slope };
}
