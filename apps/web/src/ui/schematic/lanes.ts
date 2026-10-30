import type { Drawing, Rect } from './drawing.ts';

export type Side = 'left' | 'right' | 'top' | 'bottom';

export class LaneStack {
  private readonly em: number;
  private readonly edges: Record<Side, number>;

  constructor(obstacle: Rect, em: number) {
    this.em = em;
    this.edges = { left: obstacle.x0, right: obstacle.x1, bottom: obstacle.y0, top: obstacle.y1 };
  }

  take(side: Side, extentEm: number): number {
    const dir = side === 'left' || side === 'bottom' ? -1 : 1;
    const line = this.edges[side] + dir * 1.6 * this.em;
    this.edges[side] = line + dir * (0.6 + extentEm) * this.em;
    return line;
  }

  edge(side: Side): number {
    return this.edges[side];
  }

  reserve(side: Side, coord: number): void {
    if (side === 'left' || side === 'bottom') this.edges[side] = Math.min(this.edges[side], coord);
    else this.edges[side] = Math.max(this.edges[side], coord);
  }
}

export function solveEm(build: (em: number) => Drawing, em0: number, iterations = 6): Drawing {
  let em = em0;
  let last = build(em);
  for (let i = 0; i < iterations; i++) {
    const w = last.frame.x1 - last.frame.x0;
    const next = 0.034 * w;
    if (Math.abs(next - em) / em < 0.01) break;
    em = next;
    last = build(em);
  }
  return last;
}
