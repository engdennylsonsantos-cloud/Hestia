import { rotate, type Vec2 } from './vec.ts';
import type { MultiPolygon } from './polygon.ts';

/** Transformação rígida 2D usada pelas ferramentas de edição (mover, girar, espelhar). */
export type Transform =
  | { kind: 'translate'; d: Vec2 }
  | { kind: 'rotate'; about: Vec2; angle: number }
  | { kind: 'mirror'; a: Vec2; b: Vec2 };

export function applyTransform(t: Transform, p: Vec2): Vec2 {
  switch (t.kind) {
    case 'translate':
      return { x: p.x + t.d.x, y: p.y + t.d.y };
    case 'rotate':
      return rotate(p, t.angle, t.about);
    case 'mirror': {
      const dx = t.b.x - t.a.x;
      const dy = t.b.y - t.a.y;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return p;
      const k = ((p.x - t.a.x) * dx + (p.y - t.a.y) * dy) / l2;
      const fx = t.a.x + dx * k;
      const fy = t.a.y + dy * k;
      return { x: 2 * fx - p.x, y: 2 * fy - p.y };
    }
  }
}

export const transformMulti = (t: Transform, m: MultiPolygon): MultiPolygon =>
  m.map((poly) => poly.map((ring) => ring.map((p) => applyTransform(t, p))));
