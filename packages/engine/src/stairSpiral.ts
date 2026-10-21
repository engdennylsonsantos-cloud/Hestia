import { add, mul, type Vec2 } from '@hestia/geom';
import type { StairCurve, StairRunSketch } from './stairSketch.ts';

/**
 * Caracol (helicoidal) como gerador de croqui (decisão 0014). Os limites são cadeias de arcos concêntricos de até 90°,
 * os espelhos são radiais e a caminhada é a linha média explícita. Os parâmetros ficam no lance (`spiral`) para as alças;
 * editar o croqui à mão descarta o metadado.
 */

/** Parâmetros do caracol guardados no lance (decisão 0014 §1 item 2). `sweep` em rad, com sinal: + anti-horário. */
export interface SpiralParams {
  center: Vec2;
  rInner: number;
  rOuter: number;
  startAngle: number;
  sweep: number;
}

export interface SpiralRunOptions extends SpiralParams {
  /** Nº de espelhos radiais N (≥ 2): o lance tem N−1 degraus, com Δ = sweep ÷ (N−1). */
  risers: number;
}

/** Croqui gerado por `generateSpiralRun`: o croqui do motor mais a origem e os parâmetros do caracol. */
export type SpiralRunSketch = StairRunSketch & { generatedBy: 'spiral'; spiral: SpiralParams };

/** Varredura máxima (duas voltas, decisão 0014 §1 item 3). */
export const SPIRAL_MAX_SWEEP = 4 * Math.PI;
/** Raio interno mínimo (m): para os limites não se tocarem (decisão 0014 §1 item 4). */
export const SPIRAL_MIN_INNER = 0.05;

/** Espelho passa do limite e é aparado (mesmo critério do leque). */
const OVERSHOOT = 0.01;
const PI_2 = Math.PI / 2;

/** Ângulo por degrau Δ = varredura ÷ (N−1), com sinal. */
export function spiralStepAngle(sweep: number, risers: number): number {
  if (!Number.isInteger(risers) || risers < 2) throw new RangeError('um lance precisa de ao menos 2 espelhos');
  return sweep / (risers - 1);
}

/**
 * Lance de caracol: limites interno e externo em arcos concêntricos (até 90° cada um), espelhos radiais em
 * `startAngle + k·Δ` (k = 0..N−1) e caminhada na linha média (raio `(rInner + rOuter) ÷ 2`), do 1º ao último espelho.
 * Sentido anti-horário (sweep > 0): a esquerda de quem sobe é o limite interno. Recusa varredura fora de 0 < |sweep| ≤ 4π,
 * raio interno abaixo de 0,05 m e raio externo não maior que o interno.
 */
export function generateSpiralRun(o: SpiralRunOptions): SpiralRunSketch {
  const sw = Math.abs(o.sweep);
  if (!(sw > 0 && sw <= SPIRAL_MAX_SWEEP + 1e-12)) {
    throw new RangeError('varredura do caracol deve ser não nula e de no máximo 4π (duas voltas)');
  }
  if (!(o.rInner >= SPIRAL_MIN_INNER)) throw new RangeError('raio interno do caracol deve ser de ao menos 0,05 m');
  if (!(o.rOuter > o.rInner)) throw new RangeError('raio externo do caracol deve ser maior que o interno');
  if (!Number.isFinite(o.startAngle) || !Number.isFinite(o.center.x) || !Number.isFinite(o.center.y)) {
    throw new RangeError('centro e ângulo inicial do caracol devem ser finitos');
  }
  const N = o.risers;
  spiralStepAngle(o.sweep, N);
  const { center: c, rInner: r1, rOuter: r2, startAngle: a0, sweep } = o;
  const ccw = sweep > 0;
  const rm = (r1 + r2) / 2;
  const at = (r: number, th: number): Vec2 => add(c, mul({ x: Math.cos(th), y: Math.sin(th) }, r));
  /** Arcos de até 90°; flecha de cada trecho: anti-horário tem o centro à esquerda (sag < 0), horário à direita. */
  const arc = (r: number): StairCurve[] => {
    const pieces = Math.max(1, Math.ceil(sw / PI_2 - 1e-9));
    const pts: Vec2[] = [];
    for (let j = 0; j <= pieces; j++) pts.push(at(r, a0 + (sweep * j) / pieces));
    const h = r * (1 - Math.cos(sw / pieces / 2));
    const sag = ccw ? -h : h;
    return pts.slice(1).map((b, j) => ({ a: pts[j]!, b, sag }));
  };
  const inner = arc(r1);
  const outer = arc(r2);
  const ext = Math.min(OVERSHOOT, r1 / 2);
  const risers: StairCurve[] = [];
  for (let k = 0; k < N; k++) {
    const th = a0 + (sweep * k) / (N - 1);
    risers.push({ a: at(r1 - ext, th), b: at(r2 + ext, th), sag: 0 });
  }
  return {
    boundaryLeft: ccw ? inner : outer,
    boundaryRight: ccw ? outer : inner,
    risers,
    path: arc(rm),
    generatedBy: 'spiral',
    spiral: { center: { x: c.x, y: c.y }, rInner: r1, rOuter: r2, startAngle: a0, sweep },
  };
}

/**
 * Metadado do caracol de um lance (`spiral`), ou undefined para croqui livre ou reto. O lance do modelo ainda não
 * declara o campo: a leitura é por nome, sem tipo.
 */
export function spiralParamsOf(run: object): SpiralParams | undefined {
  const sp = (run as { spiral?: SpiralParams }).spiral;
  return sp && typeof sp === 'object' ? sp : undefined;
}

/** Varredura (rad, com sinal) do caracol de um lance, ou undefined para croqui livre ou reto. */
export function spiralSweepOf(run: object): number | undefined {
  return spiralParamsOf(run)?.sweep;
}

/** Lance gerado como caracol (`generatedBy: 'spiral'`), mesmo sem o metadado. */
export function isSpiralRun(run: object): boolean {
  return (run as { generatedBy?: unknown }).generatedBy === 'spiral';
}
