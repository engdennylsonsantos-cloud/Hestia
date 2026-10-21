import { add, mid, mul, ringArea, sub, type Ring, type Vec2 } from '@hestia/geom';
import type { StairType } from '@hestia/model';
import type { ResolvedStair, ResolvedStairRiser, ResolvedStairStep } from './stairs.ts';
import { clipByLevel, ringMoments, type BottomPlane } from './stairBodyGeom.ts';

/**
 * Peça do corpo da escada (decisão 0012 §2). `bottom` é o fundo plano: cota z = a·x + b·y + c. Degrau de escada
 * escalonada e patamar têm fundo plano (a = b = 0). Degraus divididos pelo piso base repetem `kind`, `componentIndex`
 * e `index`.
 */
export interface StairBodyPiece {
  kind: 'tread' | 'landing' | 'arrival';
  componentIndex: number;
  index: number;
  polygon: Ring;
  zTop: number;
  bottom: { a: number; b: number; c: number };
}

/** Comprimento máximo da chegada, atrás do último espelho (m). */
export const STAIR_ARRIVAL_MAX_LENGTH = 0.3;
/** Espessura da laje de cima usada quando nenhuma laje ou piso cobre o último espelho (m): topo = topZ − este valor. */
export const STAIR_ARRIVAL_SLAB_DEFAULT = 0.15;

const EPS = 1e-9;

/** Frente da chegada (decisão 0012 §2): o último espelho `a`→`b` e o sentido de subida `u` (unitário). */
export interface StairArrivalFrame {
  a: Vec2;
  b: Vec2;
  u: Vec2;
  /** Comprimento da chegada atrás do último espelho: min(p, 0,30 m). */
  length: number;
}

/** Cota do fundo da peça no ponto (x, y). */
export function pieceBottomZ(piece: StairBodyPiece, x: number, y: number): number {
  return piece.bottom.a * x + piece.bottom.b * y + piece.bottom.c;
}

/** Volume da peça = área × (topo − fundo no centróide). Exato porque o fundo é um plano. */
export function pieceVolume(piece: StairBodyPiece): number {
  const { area, cx, cy } = ringMoments(piece.polygon);
  return area * (piece.zTop - pieceBottomZ(piece, cx, cy));
}

/**
 * Corpo da escada resolvida. Monolítico: fundo liso (rampa) ou escalonado (dente de serra), conforme `undersideStyle`
 * do tipo (padrão liso); nenhuma peça desce abaixo do piso base. Piso e espelho: degraus com espessura `treadThickness`
 * e patamares com `landingThickness`, sem chegada. Escada com erro: sem peças.
 *
 * Chegada (monolítico): o topo é `opts.arrivalTopZ` (cota absoluta, em geral a face inferior da laje que cobre o último
 * espelho, `stairArrivalTopZ`). Sem ele, vale `topZ − opts.slabThickness` (padrão 0,15 m). Com `arrivalTopZ`, a parte da
 * chegada cujo fundo fica acima desse topo é cortada, então a peça nunca tem espessura negativa.
 */
export function stairBody(stair: ResolvedStair, opts: { slabThickness?: number; arrivalTopZ?: number } = {}): { pieces: StairBodyPiece[] } {
  if (stair.issues.some((i) => i.severity === 'error')) return { pieces: [] };
  const type = stair.type as StairType & { undersideStyle?: 'smooth' | 'stepped' };
  if (type.runStyle !== 'monolithic') return { pieces: assembledPieces(stair) };
  const arrivalTop = opts.arrivalTopZ ?? stair.topZ - (opts.slabThickness ?? STAIR_ARRIVAL_SLAB_DEFAULT);
  return { pieces: monolithicPieces(stair, type, arrivalTop) };
}

/**
 * Frente da chegada (decisão 0012 §2): o último espelho e o sentido de subida. Só existe quando o último degrau é de um
 * lance monolítico que sobe até o espelho de topo (nº N) e o espelho N − 1 também existe; caso contrário, null.
 */
export function stairArrivalFrame(stair: ResolvedStair): StairArrivalFrame | null {
  const h = stair.riserHeight;
  const N = stair.riserCount;
  if (stair.type.runStyle !== 'monolithic' || !(h > 0) || stair.steps.length === 0) return null;
  const lastStep = stair.steps[stair.steps.length - 1]!;
  if (lastStep.kind !== 'tread' || Math.round((lastStep.z - stair.baseZ) / h) !== N - 1) return null;
  const byNumber = riserByNumber(stair, h);
  const top = byNumber.get(N);
  const prevTop = byNumber.get(N - 1);
  if (!top || !prevTop) return null;
  const dv = sub(mid(top.a, top.b), mid(prevTop.a, prevTop.b));
  const pl = Math.hypot(dv.x, dv.y);
  if (!(pl > EPS)) return null;
  return { a: top.a, b: top.b, u: mul(dv, 1 / pl), length: Math.min(pl, STAIR_ARRIVAL_MAX_LENGTH) };
}

/** Espelhos pelo nº global, derivado da cota da base do espelho (z0 = base + (nº − 1)·h): cada linha de emenda existe uma vez. */
function riserByNumber(stair: ResolvedStair, h: number): Map<number, ResolvedStairRiser> {
  return new Map<number, ResolvedStairRiser>(stair.risers.map((r) => [Math.round((r.z0 - stair.baseZ) / h) + 1, r]));
}

function assembledPieces(stair: ResolvedStair): StairBodyPiece[] {
  const { treadThickness, landingThickness } = stair.type;
  return stair.steps.map((st) => ({
    kind: st.kind,
    componentIndex: st.componentIndex,
    index: st.index,
    polygon: st.polygon,
    zTop: st.z,
    bottom: { a: 0, b: 0, c: st.z - (st.kind === 'tread' ? treadThickness : landingThickness) },
  }));
}

/** Degrau de escada monolítica antes do corte pelo piso base: fundo sem limite inferior, espessura T e nº do espelho de trás. */
interface Tread {
  ci: number;
  polygon: Ring;
  zTop: number;
  T: number;
  plane: BottomPlane;
  /** Nº global do espelho de trás: o topo do degrau é num·h acima da base; o da frente é num + 1. */
  num: number;
}

function monolithicPieces(stair: ResolvedStair, type: StairType & { undersideStyle?: 'smooth' | 'stepped' }, arrivalTop: number): StairBodyPiece[] {
  const h = stair.riserHeight;
  const sd = type.structuralDepth;
  const stepped = type.undersideStyle === 'stepped';
  const baseZ = stair.baseZ;
  if (!(h > 0) || stair.steps.length === 0) return [];

  // Degraus de lances vizinhos usam a mesma linha de espelho (pelo nº global).
  const byNumber = riserByNumber(stair, h);
  const built = stair.steps.map((st) => (st.kind === 'tread' ? treadOf(st, byNumber, h, sd, stepped, baseZ) : null));
  const treads = built.filter((t): t is Tread => t !== null);

  // T da rampa anterior (decisão 0012 §2); sem rampa anterior, o da rampa seguinte.
  const rampT = (ci: number): number => {
    const prev = treads.filter((t) => t.ci < ci);
    const next = treads.filter((t) => t.ci > ci);
    return prev.length ? prev[prev.length - 1]!.T : next.length ? next[0]!.T : sd;
  };

  // Corte pelo piso base vale para todo degrau e patamar: só corta quando o fundo fica abaixo de baseZ (nunca acima).
  const pieces: StairBodyPiece[] = [];
  stair.steps.forEach((st, i) => {
    if (st.kind === 'tread') {
      const t = built[i];
      if (t) pieces.push(...fit('tread', st.componentIndex, st.index, t.polygon, t.zTop, t.plane, baseZ));
      return;
    }
    const plane = { a: 0, b: 0, c: st.z - h - rampT(st.componentIndex) };
    pieces.push(...fit('landing', st.componentIndex, st.index, st.polygon, st.z, plane, baseZ));
  });

  // Chegada: faixa atrás do último espelho, sob o último degrau (mesmo plano). O topo é `arrivalTop` (decisão 0012 §2);
  // a parte cujo fundo fica acima dele é cortada (a laje cobre). Sem último degrau de lance que sobe até o espelho N, não há.
  const lastStep = stair.steps[stair.steps.length - 1]!;
  const lastTread = lastStep.kind === 'tread' ? built[stair.steps.length - 1] : null;
  const frame = stairArrivalFrame(stair);
  if (lastTread && frame && arrivalTop > baseZ + EPS) {
    const { a, b, u, length } = frame;
    const ring: Ring = [a, b, add(b, mul(u, length)), add(a, mul(u, length))];
    const polygon = ringArea(ring) < 0 ? ring.reverse() : ring;
    for (const part of partBelow(polygon, lastTread.plane, arrivalTop)) {
      pieces.push(...fit('arrival', lastStep.componentIndex, 1, part, arrivalTop, lastTread.plane, baseZ));
    }
  }
  return pieces;
}

/** Partes do anel onde o fundo `plane` fica em z ≤ `level` (topo da chegada). Fundo horizontal: tudo ou nada. */
function partBelow(ring: Ring, plane: BottomPlane, level: number): Ring[] {
  if (plane.a === 0 && plane.b === 0) return plane.c <= level + EPS ? [ring] : [];
  return clipByLevel(ring, plane, level, 'below');
}

/** Degrau (kind 'tread') com fundo ao longo de `d` entre os espelhos de trás e da frente, `T` abaixo do topo (decisão 0012 §2). */
function treadOf(
  st: ResolvedStairStep,
  byNumber: Map<number, ResolvedStairRiser>,
  h: number,
  sd: number,
  stepped: boolean,
  baseZ: number,
): Tread | null {
  const num = Math.round((st.z - baseZ) / h);
  const rb = byNumber.get(num);
  const rf = byNumber.get(num + 1);
  if (!rb || !rf) return null;
  const back = mid(rb.a, rb.b);
  const d = sub(mid(rf.a, rf.b), back);
  const p = Math.hypot(d.x, d.y);
  // T = profundidade estrutural ÷ cosθ, cosθ = p / √(p² + h²) (decisão 0012 §2, item 2).
  const T = p > EPS ? (sd * Math.hypot(p, h)) / p : sd;
  const zBack = st.z - h - T;
  // Liso: plano que vale zBack em `back` e sobe h ao longo de `d` (gradiente = h·d ÷ p²).
  const a = (h * d.x) / (p * p);
  const b = (h * d.y) / (p * p);
  const plane: BottomPlane = stepped || p <= EPS ? { a: 0, b: 0, c: zBack } : { a, b, c: zBack - a * back.x - b * back.y };
  return { ci: st.componentIndex, polygon: st.polygon, zTop: st.z, T, plane, num };
}

/**
 * Peça com o fundo `plane`, cortada pelo piso base (decisão 0012 §2): plano inteiro abaixo de `baseZ` vira fundo plano em
 * `baseZ`; plano que cruza `baseZ` é dividido em duas peças. Peça acima do piso base sai inalterada.
 */
function fit(
  kind: StairBodyPiece['kind'],
  componentIndex: number,
  index: number,
  polygon: Ring,
  zTop: number,
  plane: BottomPlane,
  baseZ: number,
): StairBodyPiece[] {
  const piece = (poly: Ring, bottom: BottomPlane): StairBodyPiece => ({ kind, componentIndex, index, polygon: poly, zTop, bottom });
  const flat = (): BottomPlane => ({ a: 0, b: 0, c: baseZ });
  const vals = polygon.map((p) => plane.a * p.x + plane.b * p.y + plane.c);
  if (Math.min(...vals) >= baseZ - EPS) return [piece(polygon, plane)];
  if (Math.max(...vals) <= baseZ + EPS) return [piece(polygon, flat())];
  return [
    ...clipByLevel(polygon, plane, baseZ, 'below').map((r) => piece(r, flat())),
    ...clipByLevel(polygon, plane, baseZ, 'above').map((r) => piece(r, plane)),
  ];
}
