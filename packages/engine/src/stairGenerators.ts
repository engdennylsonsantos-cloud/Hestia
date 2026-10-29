import { add, dot, len, mul, norm, perp, sub, type Vec2 } from '@hestia/geom';
import { stairCalcRuleOf, type StairType } from '@hestia/model';
import type { StairCurve, StairLandingSketch, StairRunSketch } from './stairSketch.ts';

/** Componente do croqui de escada, em ordem (lance, patamar, lance...). Decisão 0011 §1 e §5. */
export type StairComponentSketch =
  | { kind: 'run'; run: StairRunSketch }
  | { kind: 'landing'; landing: StairLandingSketch };

export interface StraightRunOptions {
  /** Ponto do espelho 1, conforme `justify` (padrão: centro do espelho). */
  start: Vec2;
  /** Direção de subida (unitária; normalizada internamente). A esquerda do lance é `perp(dir)`. */
  dir: Vec2;
  width: number;
  /** Nº de linhas de espelho N (≥ 2): o lance tem N−1 degraus. */
  risers: number;
  tread: number;
  /** `start` é o centro (padrão), o extremo esquerdo ou o direito do 1º espelho. */
  justify?: 'center' | 'left' | 'right';
}

export interface TurnOptions {
  start: Vec2;
  dir: Vec2;
  width: number;
  /** Espelhos do 1º lance (N1 ≥ 2); o último encosta no patamar. */
  risersFirst: number;
  /** Espelhos do 2º lance (N2 ≥ 2); o primeiro sai do patamar. */
  risersSecond: number;
  tread: number;
  /** Lado do giro, visto de quem sobe o 1º lance. */
  turn: 'left' | 'right';
  /** Profundidade do patamar, medida a partir do último espelho do 1º lance (padrão = largura). */
  landingDepth?: number;
}

export interface FanRunOptions {
  center: Vec2;
  innerRadius: number;
  outerRadius: number;
  /** Radianos. Sentido anti-horário se `endAngle > startAngle`. */
  startAngle: number;
  endAngle: number;
  /** Nº de espelhos radiais (≥ 2), igualmente espaçados em ângulo, incluindo os dois extremos. */
  risers: number;
}

export interface WinderOptions extends Omit<TurnOptions, 'landingDepth'> {
  /** Espelhos radiais do leque de 90° (padrão 3). Compartilham a linha com os lances vizinhos. */
  winderRisers?: number;
}

const PI_2 = Math.PI / 2;
/** Espelho radial passa do limite e é aparado (decisão 0011 §5): evita cair entre as cordas do arco amostrado. */
const OVERSHOOT = 0.01;

/** Regra de piso usada no cálculo: a·R + b·T = alvo, com o piso limitado a [minTread, maxTread]. */
export interface TreadRule {
  minTread: number;
  maxTread: number;
  a: number;
  b: number;
  target: number;
}

/** Nº de espelhos N = ceil(H ÷ espelho máximo), mínimo 1 (decisão 0011 §4). */
export function riserCountFor(height: number, maxRiser: number): number {
  if (!(maxRiser > 0) || !(height >= 0)) throw new RangeError('altura e espelho máximo devem ser positivos');
  // A tolerância impede 1,1 ÷ 0,1 = 11,000…002 de virar 12 espelhos.
  return Math.max(1, Math.ceil(height / maxRiser - 1e-9));
}

/** Regra de piso do tipo de escada (estilo Revit "Stair Calculator"). */
export function treadRuleOf(type: StairType): TreadRule {
  const rule = stairCalcRuleOf(type);
  return {
    minTread: type.minTread,
    maxTread: rule.maxTread,
    a: rule.calcRiserFactor,
    b: rule.calcTreadFactor,
    target: rule.calcTarget,
  };
}

/**
 * Piso calculado pela regra do tipo: (alvo − a·h) ÷ b, limitado a [piso mínimo, piso máximo] (decisão 0011 §5).
 * Com a regra padrão (a = 2, b = 1, alvo = 0,63), é o antigo clamp(0,63 − 2·h; minTread; 0,32).
 */
export function treadFor(riserHeight: number, rule: TreadRule): number {
  return Math.min(rule.maxTread, Math.max(rule.minTread, (rule.target - rule.a * riserHeight) / rule.b));
}

/** Lance reto: espelhos perpendiculares a `dir`, limites paralelos do 1º ao último espelho. */
export function generateStraightRun(o: StraightRunOptions): StairRunSketch {
  checkRun(o.width, o.risers, o.tread);
  const { d, n } = frame(o.dir);
  const offset = { center: o.width / 2, left: 0, right: o.width }[o.justify ?? 'center'];
  return rectRun(add(o.start, mul(n, offset)), d, n, o.width, o.risers, o.tread);
}

/**
 * Escada em L: 1º lance reto, patamar quadrado (largura × profundidade) e 2º lance a 90° do patamar.
 * O último espelho do 1º lance é a borda do patamar; o 1º do 2º lance sai da borda do patamar do lado do giro,
 * alinhado à borda oposta à entrada (`landingDepth` ≥ largura). Cota de base do 2º lance: N1 · h.
 */
export function generateLShape(o: TurnOptions): StairComponentSketch[] {
  checkRun(o.width, o.risersFirst, o.tread);
  checkRun(o.width, o.risersSecond, o.tread);
  const w = o.width;
  const D = o.landingDepth ?? w;
  if (!(D >= w)) throw new RangeError('o patamar do L deve ter profundidade ≥ largura do lance');
  const { d, n } = frame(o.dir);
  const at = localPoint(o.start, d, n);
  const sg = sideOf(o.turn);
  const U = (o.risersFirst - 1) * o.tread;
  const d2 = mul(n, sg);
  const n2 = perp(d2);
  // Ponto de partida do 2º lance: borda do patamar do lado do giro, do lado da borda oposta à entrada.
  const left0 = at(U + D - (sg > 0 ? w : 0), (sg * w) / 2);
  return [
    run(rectRun(at(0, w / 2), d, n, w, o.risersFirst, o.tread)),
    landing(at, U, U + D, -w / 2, w / 2),
    run(rectRun(left0, d2, n2, w, o.risersSecond, o.tread)),
  ];
}

/**
 * Escada em U: 1º lance, patamar (largura 2·largura + vão, profundidade `landingDepth`) e 2º lance paralelo, de
 * sentido oposto, no lado do giro. Os dois lances encostam na borda do patamar. Vão padrão 0,10 m.
 */
export function generateUShape(o: TurnOptions & { gap?: number }): StairComponentSketch[] {
  checkRun(o.width, o.risersFirst, o.tread);
  checkRun(o.width, o.risersSecond, o.tread);
  const w = o.width;
  const gap = o.gap ?? 0.1;
  const D = o.landingDepth ?? w;
  if (!(gap >= 0)) throw new RangeError('o vão do U não pode ser negativo');
  if (!(D > 0)) throw new RangeError('profundidade do patamar deve ser positiva');
  const { d, n } = frame(o.dir);
  const at = localPoint(o.start, d, n);
  const sg = sideOf(o.turn);
  const U = (o.risersFirst - 1) * o.tread;
  const d2 = mul(d, -1);
  const n2 = perp(d2);
  // 2º lance do lado do giro: a borda da sua saída (espelho 1) está na linha do último espelho do 1º lance.
  const v2 = sg > 0 ? w / 2 + gap : -w / 2 - gap - w;
  const vMin = sg > 0 ? -w / 2 : -w / 2 - gap - w;
  const vMax = sg > 0 ? w / 2 + gap + w : w / 2;
  return [
    run(rectRun(at(0, w / 2), d, n, w, o.risersFirst, o.tread)),
    landing(at, U, U + D, vMin, vMax),
    run(rectRun(at(U, v2), d2, n2, w, o.risersSecond, o.tread)),
  ];
}

/**
 * Lance em leque: limites em arco concêntricos e espelhos radiais igualmente espaçados em ângulo. Vale para
 * escada curva e para winder. Arcos acima de 90° são divididos em trechos (cada um com flecha exata).
 */
export function generateFanRun(o: FanRunOptions): StairRunSketch {
  const c = o.center;
  const r1 = o.innerRadius;
  const r2 = o.outerRadius;
  const a0 = o.startAngle;
  const sweep = o.endAngle - o.startAngle;
  if (!(r1 > 0) || !(r2 > r1)) throw new RangeError('raios do leque: 0 < interno < externo');
  if (!(o.risers >= 2) || !Number.isInteger(o.risers)) throw new RangeError('um lance precisa de ao menos 2 espelhos');
  if (!(Math.abs(sweep) > 1e-9 && Math.abs(sweep) < 2 * Math.PI)) {
    throw new RangeError('ângulo do leque deve ser não nulo e menor que 360°');
  }
  const ccw = sweep > 0;
  const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / PI_2 - 1e-9));
  const at = (r: number, th: number): Vec2 => add(c, mul({ x: Math.cos(th), y: Math.sin(th) }, r));
  const arc = (r: number): StairCurve[] => {
    const pts: Vec2[] = [];
    for (let j = 0; j <= pieces; j++) pts.push(at(r, a0 + (sweep * j) / pieces));
    // Flecha de cada trecho: anti-horário (sag < 0) tem o centro à esquerda; horário, à direita.
    const h = r * (1 - Math.cos(Math.abs(sweep) / pieces / 2));
    const sag = ccw ? -h : h;
    return pts.slice(1).map((b, j) => ({ a: pts[j]!, b, sag }));
  };
  const inner = arc(r1);
  const outer = arc(r2);
  const ext = Math.min(OVERSHOOT, r1 / 2);
  const risers: StairCurve[] = [];
  for (let i = 0; i < o.risers; i++) {
    const th = a0 + (sweep * i) / (o.risers - 1);
    risers.push(line(at(r1 - ext, th), at(r2 + ext, th)));
  }
  // Sentido anti-horário: a esquerda de quem sobe fica para o centro (raio interno).
  return {
    boundaryLeft: ccw ? inner : outer,
    boundaryRight: ccw ? outer : inner,
    risers,
    path: [],
  };
}

/**
 * Winder de 90°: lance reto, leque de `winderRisers` espelhos radiais e lance reto. Sem patamar plano: o último
 * espelho de cada componente é o primeiro do seguinte (mesma linha). Piso medido na borda interna = `tread`
 * (raio interno = tread ÷ ângulo entre espelhos). Cotas de base: 1º lance 0; leque (N1 − 1) · h; 2º lance
 * (N1 + W − 2) · h.
 */
export function generateWinderL(o: WinderOptions): StairComponentSketch[] {
  const W = o.winderRisers ?? 3;
  if (!Number.isInteger(W) || W < 2) throw new RangeError('o winder precisa de ao menos 2 espelhos radiais');
  checkRun(o.width, o.risersFirst, o.tread);
  checkRun(o.width, o.risersSecond, o.tread);
  const w = o.width;
  const { d, n } = frame(o.dir);
  const at = localPoint(o.start, d, n);
  const sg = sideOf(o.turn);
  const U = (o.risersFirst - 1) * o.tread;
  const r1 = o.tread / (PI_2 / (W - 1));
  const r2 = r1 + w;
  // Centro do leque: do lado do giro, a r1 do extremo do 1º lance que fica na borda interna.
  const pEnd = at(U, (sg * w) / 2);
  const c = add(pEnd, mul(n, sg * r1));
  const a0 = Math.atan2(-sg * n.y, -sg * n.x);
  const a1 = a0 + sg * PI_2;
  const d2 = mul(n, sg);
  const n2 = perp(d2);
  const rho1: Vec2 = { x: Math.cos(a1), y: Math.sin(a1) };
  const eIn = add(c, mul(rho1, r1));
  const eOut = add(c, mul(rho1, r2));
  const left0 = dot(eIn, n2) >= dot(eOut, n2) ? eIn : eOut;
  return [
    run(rectRun(at(0, w / 2), d, n, w, o.risersFirst, o.tread)),
    run(generateFanRun({ center: c, innerRadius: r1, outerRadius: r2, startAngle: a0, endAngle: a1, risers: W })),
    run(rectRun(left0, d2, n2, w, o.risersSecond, o.tread)),
  ];
}

function checkRun(width: number, risers: number, tread: number): void {
  if (!(width > 0)) throw new RangeError('largura do lance deve ser positiva');
  if (!(tread > 0)) throw new RangeError('piso deve ser positivo');
  if (!Number.isInteger(risers) || risers < 2) throw new RangeError('um lance precisa de ao menos 2 espelhos');
}

function frame(dir: Vec2): { d: Vec2; n: Vec2 } {
  if (len(dir) < 1e-12) throw new RangeError('direção de subida nula');
  const d = norm(dir);
  return { d, n: perp(d) };
}

/** Ponto de coordenadas locais (u ao longo de `d`, v à esquerda de `n`) a partir de `start`. */
function localPoint(start: Vec2, d: Vec2, n: Vec2): (u: number, v: number) => Vec2 {
  return (u, v) => add(start, add(mul(d, u), mul(n, v)));
}

function sideOf(turn: 'left' | 'right'): 1 | -1 {
  return turn === 'left' ? 1 : -1;
}

const line = (a: Vec2, b: Vec2): StairCurve => ({ a, b, sag: 0 });
const run = (r: StairRunSketch): StairComponentSketch => ({ kind: 'run', run: r });

/** Lance reto a partir do extremo esquerdo do 1º espelho; espelhos perpendiculares a `d`, subindo em `d`. */
function rectRun(left0: Vec2, d: Vec2, n: Vec2, width: number, risers: number, tread: number): StairRunSketch {
  const leftAt = (i: number): Vec2 => add(left0, mul(d, i * tread));
  const rightAt = (i: number): Vec2 => sub(leftAt(i), mul(n, width));
  const spanning: StairCurve[] = [];
  for (let i = 0; i < risers; i++) spanning.push(line(leftAt(i), rightAt(i)));
  return {
    boundaryLeft: [line(leftAt(0), leftAt(risers - 1))],
    boundaryRight: [line(rightAt(0), rightAt(risers - 1))],
    risers: spanning,
    path: [],
  };
}

/** Patamar retangular em coordenadas locais (u0..u1, v0..v1), contorno fechado. */
function landing(
  at: (u: number, v: number) => Vec2,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
): StairComponentSketch {
  return {
    kind: 'landing',
    landing: {
      boundary: [
        line(at(u0, v1), at(u0, v0)),
        line(at(u0, v0), at(u1, v0)),
        line(at(u1, v0), at(u1, v1)),
        line(at(u1, v1), at(u0, v1)),
      ],
    },
  };
}
