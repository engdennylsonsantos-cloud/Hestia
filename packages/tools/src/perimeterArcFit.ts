import { cross, dist, dot, len, sagFromThreePoints, sub, type Vec2 } from '@hestia/geom';

/** Flags de um lado do anel (só telhado as usa). Um arco só nasce de lados com as mesmas flags. */
export interface ArcFlags {
  definesSlope?: boolean;
  slopePct?: number;
  overhang?: number;
}

/** Linha recuperada do anel: reta (sem `sag`) ou arco, com a flecha de `sagFromThreePoints` (sinal = lado do abaulamento). */
export interface FittedSide {
  a: Vec2;
  b: Vec2;
  sag?: number;
  flags: ArcFlags;
}

/**
 * Erro máximo, em metros, de um vértice ao círculo e da corda à flecha. Abaixo disto, uma sequência é arco; acima, é
 * reta (um polígono inscrito, de lados retos, não vira arco, e um vértice de ruído não vira arco de raio enorme).
 */
export const ARC_TOL = 0.003;

/** Arco de até 180°: a sequência maior que isto vira mais de um arco. */
const HALF_TURN = Math.PI;

const NO_FLAGS: ArcFlags = Object.freeze({});

interface Circle {
  c: Vec2;
  r: number;
}

/** Sequência de lados sobre um círculo: o círculo, a varredura (em módulo, radianos) e o número de lados. */
interface Run extends Circle {
  sweep: number;
  k: number;
}

/** Mesmas flags: o arco nasce só de lados que as têm iguais. */
const sameFlags = (a: ArcFlags, b: ArcFlags): boolean => a.definesSlope === b.definesSlope && a.slopePct === b.slopePct && a.overhang === b.overhang;

/** Circunferência por três pontos, ou null quando estão alinhados. */
function circleThrough(a: Vec2, b: Vec2, c: Vec2): Circle | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  return { c: center, r: dist(center, a) };
}

/**
 * Ângulo, com sinal, que um lado varre em torno de `c`. Null quando o lado é degenerado ou a corda fica com flecha
 * acima de `ARC_TOL` (lado reto, não parte de um arco amostrado).
 */
function sideAngle(a: Vec2, b: Vec2, c: Vec2, r: number): number | null {
  const seg = dist(a, b);
  if (seg < 1e-9) return null;
  const h = Math.min(seg / 2, r);
  if (r - Math.sqrt(r * r - h * h) > ARC_TOL) return null;
  const ua = sub(a, c);
  const ub = sub(b, c);
  const th = Math.atan2(cross(ua, ub), dot(ua, ub));
  return Math.abs(th) < 1e-12 ? null : th;
}

/**
 * Sequência de `k` lados a partir do vértice `i` (vértices i..i+k) sobre um círculo: todos os vértices dentro de
 * `ARC_TOL` dele, cada lado com flecha até `ARC_TOL`, mesmo sentido de giro, e o vértice do meio mais que `ARC_TOL`
 * longe da reta das pontas (reta com ruído não é arco). Null quando não se sustenta.
 */
function runCircle(ring: Vec2[], i: number, k: number): Run | null {
  const n = ring.length;
  const v = (t: number): Vec2 => ring[(i + t) % n]!;
  const circ = circleThrough(v(0), v(Math.floor(k / 2)), v(k));
  if (!circ) return null;
  const { c, r } = circ;
  const chord = sub(v(k), v(0));
  const span = len(chord);
  if (span < 1e-9 || Math.abs(cross(chord, sub(v(Math.floor(k / 2)), v(0)))) / span <= ARC_TOL) return null;
  for (let t = 0; t <= k; t++) if (Math.abs(dist(v(t), c) - r) > ARC_TOL) return null;
  let sign = 0;
  let sweep = 0;
  for (let t = 0; t < k; t++) {
    const th = sideAngle(v(t), v(t + 1), c, r);
    if (th === null) return null;
    const s = Math.sign(th);
    if (sign !== 0 && s !== sign) return null;
    sign = s;
    sweep += th;
  }
  return { c, r, sweep: Math.abs(sweep), k };
}

/** Maior sequência a partir de `i` sobre um círculo, com os lados de flags iguais às de `i`; k = 0 quando nenhuma chega a 3. */
function longestRun(ring: Vec2[], fl: ArcFlags[], i: number): Run | null {
  const n = ring.length;
  let best: Run | null = null;
  for (let k = 1; k <= n - 1; k++) {
    if (!sameFlags(fl[(i + k - 1) % n]!, fl[i]!)) break;
    if (k < 3) continue;
    const run = runCircle(ring, i, k);
    if (!run) break;
    best = run;
  }
  return best;
}

/** Anel inteiro sobre um só círculo (n ≥ 6, sem uma só quebra de lado nem de flags): devolve o círculo, ou null. */
function wholeRingCircle(ring: Vec2[], fl: ArcFlags[]): Run | null {
  const n = ring.length;
  if (n < 6 || fl.some((f) => !sameFlags(f, fl[0]!))) return null;
  const circ = circleThrough(ring[0]!, ring[Math.floor(n / 3)]!, ring[Math.floor((2 * n) / 3)]!);
  if (!circ) return null;
  if (ring.some((q) => Math.abs(dist(q, circ.c) - circ.r) > ARC_TOL)) return null;
  let sign = 0;
  let sweep = 0;
  for (let t = 0; t < n; t++) {
    const th = sideAngle(ring[t]!, ring[(t + 1) % n]!, circ.c, circ.r);
    if (th === null) return null;
    const s = Math.sign(th);
    if (sign !== 0 && s !== sign) return null;
    sign = s;
    sweep += th;
  }
  return Math.abs(Math.abs(sweep) - 2 * Math.PI) <= 1e-6 ? { ...circ, sweep: 2 * Math.PI, k: n } : null;
}

/**
 * Arcos de uma sequência de `k` lados a partir do vértice `i`, com varredura `sweep`: uma flecha por arco, cada um de
 * até 180° (a sequência é repartida em partes iguais, de pelo menos três lados).
 */
function pushArcs(ring: Vec2[], i: number, k: number, sweep: number, flags: ArcFlags, out: FittedSide[]): void {
  const n = ring.length;
  const parts = Math.max(1, Math.min(Math.ceil(sweep / HALF_TURN - 1e-9), Math.floor(k / 3)));
  for (let j = 0; j < parts; j++) {
    const from = Math.round((j * k) / parts);
    const to = Math.round(((j + 1) * k) / parts);
    const a = ring[(i + from) % n]!;
    const b = ring[(i + to) % n]!;
    const m = ring[(i + Math.floor((from + to) / 2)) % n]!;
    out.push({ a, b, sag: sagFromThreePoints(a, m, b), flags });
  }
}

/**
 * Recupera os arcos de um anel fechado. `ring` são os vértices na ordem do anel (sem repetir o primeiro); `flags[i]`
 * vale para o lado que parte do vértice i. Uma sequência de três ou mais lados sobre o mesmo círculo (ver `runCircle`)
 * vira arcos com flecha, de até 180° cada, de flags iguais. Os demais lados saem retos. Anel inteiro sobre um círculo
 * vira arcos, sem sobra de reta. Com menos de dois vértices, não há lados.
 */
export function fitRing(ring: Vec2[], flags: ArcFlags[] = []): FittedSide[] {
  const n = ring.length;
  if (n < 2) return [];
  const fl = ring.map((_, j) => flags[j] ?? NO_FLAGS);
  const straight = (i: number): FittedSide => ({ a: ring[i]!, b: ring[(i + 1) % n]!, flags: fl[i]! });
  if (n < 3) return [straight(0), straight(1)];

  const whole = wholeRingCircle(ring, fl);
  if (whole) {
    const out: FittedSide[] = [];
    pushArcs(ring, 0, n, whole.sweep, fl[0]!, out);
    return out;
  }

  const runs = ring.map((_, i) => longestRun(ring, fl, i));
  // Começa numa fronteira de arco (o lado anterior não abre um), para que um arco que cruza o vértice 0 não seja cortado.
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (runs[i] && !runs[(i + n - 1) % n]) {
      s = i;
      break;
    }
  }
  const out: FittedSide[] = [];
  let p = 0;
  while (p < n) {
    const i = (s + p) % n;
    const run = runs[i];
    const k = run ? Math.min(run.k, n - p) : 0;
    const cut = run && k === run.k ? run : k >= 3 ? runCircle(ring, i, k) : null;
    if (cut) {
      pushArcs(ring, i, k, cut.sweep, fl[i]!, out);
      p += k;
    } else {
      out.push(straight(i));
      p += 1;
    }
  }
  return out;
}
