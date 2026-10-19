import earcut from 'earcut';
import type { Polygon } from './polygon.ts';

export interface Mesh2D {
  /** x,y,x,y... */
  positions: number[];
  indices: number[];
}

/** Triangula um polígono com furos. */
export function triangulate(p: Polygon): Mesh2D {
  const positions: number[] = [];
  const holes: number[] = [];
  p.forEach((ring, i) => {
    if (i > 0) holes.push(positions.length / 2);
    for (const v of ring) positions.push(v.x, v.y);
  });
  const indices = earcut(positions, holes, 2);
  return { positions, indices };
}
