import { MIN_FONT_RATIO, type Drawing, type Rect } from './drawing.ts';

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

/**
 * Escolhe o `em` construindo o desenho com tamanhos crescentes até a fonte ficar legível (razão mínima).
 * O ponto fixo literal da fórmula `0.034·largura` diverge quando as caixas de texto dominam a largura;
 * por isso o passo cresce de 5% em 5% a partir de `em0` e para no primeiro tamanho aceitável.
 */
export function solveEm(build: (em: number) => Drawing, em0: number, iterations = 6): Drawing {
  let em = em0;
  let last = build(em);
  const ratio = (): number => em / (last.frame.x1 - last.frame.x0);
  if (ratio() >= MIN_FONT_RATIO) return last;
  const maxSteps = Math.max(400, iterations);
  for (let i = 0; i < maxSteps; i++) {
    em *= 1.05;
    last = build(em);
    if (ratio() >= MIN_FONT_RATIO) return last;
    if (em > 1e6) break;
  }
  return last;
}
