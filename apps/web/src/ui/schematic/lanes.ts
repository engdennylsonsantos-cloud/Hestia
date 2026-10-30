import { MIN_FONT_RATIO, type Drawing, type Rect } from './drawing.ts';

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** Folga da primeira linha de cota a partir do obstáculo e recuo depois da linha usada (em unidades de `em`). */
const LANE_GAP = 1.2;
const LANE_PAD = 0.45;

/**
 * Altura máxima do texto em relação ao menor lado do quadro (1/6). Sem esse limite, um quadro estreito e comprido é
 * dominado pelos rótulos: a fonte cresce para caber na regra da largura e a geometria (os degraus, a rampa) fica menor
 * que o próprio texto.
 */
export const MAX_TEXT_OF_MINOR = 6;

export class LaneStack {
  private readonly em: number;
  private readonly edges: Record<Side, number>;

  constructor(obstacle: Rect, em: number) {
    this.em = em;
    this.edges = { left: obstacle.x0, right: obstacle.x1, bottom: obstacle.y0, top: obstacle.y1 };
  }

  take(side: Side, extentEm: number): number {
    const dir = side === 'left' || side === 'bottom' ? -1 : 1;
    const line = this.edges[side] + dir * LANE_GAP * this.em;
    this.edges[side] = line + dir * (LANE_PAD + extentEm) * this.em;
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

const widthOf = (d: Drawing): number => d.frame.x1 - d.frame.x0;
const minorOf = (d: Drawing): number => Math.min(widthOf(d), d.frame.y1 - d.frame.y0);

/**
 * Escolhe o `em` construindo o desenho com tamanhos crescentes até a fonte ficar legível (razão mínima).
 * O ponto fixo literal da fórmula `0.034·largura` diverge quando as caixas de texto dominam a largura;
 * por isso o passo cresce de 5% em 5% a partir de `em0` e para no primeiro tamanho aceitável.
 *
 * Depois, o `em` é limitado pela MENOR dimensão do quadro (`MAX_TEXT_OF_MINOR`): o texto não pode ocupar mais de 1/6 do
 * lado menor. Assim o desenho passa a usar a altura do quadro em vez de só a largura, e a geometria fica maior que os
 * rótulos. A legibilidade vem primeiro: se o limite deixasse a fonte abaixo de `MIN_FONT_RATIO`, fica o `em` legível
 * (o `checkDrawing` continua verde).
 */
export function solveEm(build: (em: number) => Drawing, em0: number, iterations = 6): Drawing {
  let em = em0;
  let last = build(em);
  const ratio = (): number => em / widthOf(last);
  const legible = (d: Drawing, e: number): boolean => e / widthOf(d) >= MIN_FONT_RATIO;
  if (ratio() < MIN_FONT_RATIO) {
    const maxSteps = Math.max(400, iterations);
    for (let i = 0; i < maxSteps; i++) {
      em *= 1.05;
      last = build(em);
      if (ratio() >= MIN_FONT_RATIO) break;
      if (em > 1e6) break;
    }
  }
  const cap = minorOf(last) / MAX_TEXT_OF_MINOR;
  if (em > cap) {
    const atCap = build(cap);
    if (legible(atCap, cap)) return atCap;
  }
  return last;
}
