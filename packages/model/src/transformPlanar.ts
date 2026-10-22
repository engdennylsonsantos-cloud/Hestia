import { applyTransform, type Transform, type Vec2 } from '@hestia/geom';
import { followsRoom } from './ceiling.ts';
import { type Ceiling, type Floor, type Slab } from './types.ts';

/** Solta o vínculo do contorno quando o elemento é movido/girado/espelhado (a cópia herda a origem; decisão 0023 §8.2b). */
const detach = <T extends { outlineSource?: { linked: boolean } }>(e: T, copy: boolean): T =>
  !copy && e.outlineSource?.linked ? { ...e, outlineSource: { ...e.outlineSource, linked: false } } : e;

/** Move/gira/espelha um piso; espelhar inverte o sentido do contorno (a orientação não importa ao motor, mas fica estável). */
export function transformFloor(f: Floor, t: Transform, copy = false): Floor {
  const pts = (ring: Vec2[]): Vec2[] => {
    const out = ring.map((q) => applyTransform(t, q));
    return t.kind === 'mirror' ? out.reverse() : out;
  };
  return detach({ ...f, boundary: pts(f.boundary), holes: f.holes.map(pts) }, copy);
}

/** Move/gira/espelha uma laje: contorno, furos e a linha de inclinação (origem e direção). */
export function transformSlab(s: Slab, t: Transform, copy = false): Slab {
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
  return detach({ ...s, boundary: pts(s.boundary), holes: s.holes.map(pts), slope }, copy);
}

/**
 * Move/gira/espelha um forro: contorno e furos (o nível e a cota não mudam). Forro que acompanha o ambiente se solta ao
 * mover (como o piso); a cópia herda o vínculo.
 */
export function transformCeiling(c: Ceiling, t: Transform, copy = false): Ceiling {
  const pts = (ring: Vec2[]): Vec2[] => {
    const out = ring.map((q) => applyTransform(t, q));
    return t.kind === 'mirror' ? out.reverse() : out;
  };
  const moved = { ...c, boundary: pts(c.boundary), holes: c.holes.map(pts) };
  return !copy && followsRoom(c) ? { ...moved, roomLinked: false } : moved;
}
