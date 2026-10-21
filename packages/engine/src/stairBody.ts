import { add, mid, mul, ringArea, sub, type Ring } from '@hestia/geom';
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
/** Espessura da laje de cima usada quando o chamador não informa (m). */
export const STAIR_ARRIVAL_SLAB_DEFAULT = 0.15;

const EPS = 1e-9;

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
 */
export function stairBody(stair: ResolvedStair, opts: { slabThickness?: number } = {}): { pieces: StairBodyPiece[] } {
  if (stair.issues.some((i) => i.severity === 'error')) return { pieces: [] };
  const type = stair.type as StairType & { undersideStyle?: 'smooth' | 'stepped' };
  if (type.runStyle !== 'monolithic') return { pieces: assembledPieces(stair) };
  return { pieces: monolithicPieces(stair, type, opts.slabThickness ?? STAIR_ARRIVAL_SLAB_DEFAULT) };
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

/** Degrau antes do corte pelo piso base: fundo sem limite inferior, espessura T da rampa e nível de base do lance. */
interface Tread {
  ci: number;
  index: number;
  polygon: Ring;
  zTop: number;
  T: number;
  plane: BottomPlane;
  atBase: boolean;
}

function monolithicPieces(stair: ResolvedStair, type: StairType & { undersideStyle?: 'smooth' | 'stepped' }, slab: number): StairBodyPiece[] {
  const h = stair.riserHeight;
  const sd = type.structuralDepth;
  const stepped = type.undersideStyle === 'stepped';
  const baseZ = stair.baseZ;
  if (!(h > 0) || stair.steps.length === 0) return [];

  // Espelhos de cada lance, em ordem de subida; `before` = nº de espelhos dos lances anteriores (cota da base do lance).
  const runCis = [...new Set(stair.risers.map((r) => r.componentIndex))].sort((a, b) => a - b);
  const runs = new Map<number, ResolvedStairRiser[]>(
    runCis.map((ci) => [ci, stair.risers.filter((r) => r.componentIndex === ci).sort((x, y) => x.index - y.index)]),
  );
  const landingSteps = stair.steps.filter((s) => s.kind === 'landing');
  const cis = [...new Set([...runCis, ...landingSteps.map((s) => s.componentIndex)])].sort((a, b) => a - b);
  const before = (ci: number): number => runCis.filter((c) => c < ci).reduce((n, c) => n + runs.get(c)!.length, 0);

  const treads: Tread[] = [];
  for (const st of stair.steps) {
    if (st.kind !== 'tread') continue;
    const t = treadOf(st, runs.get(st.componentIndex) ?? [], h, sd, stepped, before(st.componentIndex) === 0);
    if (t) treads.push(t);
  }

  // T da rampa anterior (decisão 0012 §2); sem rampa anterior, o da rampa seguinte.
  const rampT = (ci: number): number => {
    const prev = treads.filter((t) => t.ci < ci);
    const next = treads.filter((t) => t.ci > ci);
    return prev.length ? prev[prev.length - 1]!.T : next.length ? next[0]!.T : sd;
  };

  const pieces: StairBodyPiece[] = [];
  for (const ci of cis) {
    if (runs.has(ci)) {
      for (const t of treads.filter((x) => x.ci === ci)) {
        pieces.push(...fit('tread', ci, t.index, t.polygon, t.zTop, t.plane, t.atBase, baseZ));
      }
      continue;
    }
    const lp = landingSteps.find((s) => s.componentIndex === ci)!;
    const plane = { a: 0, b: 0, c: lp.z - h - rampT(ci) };
    pieces.push(...fit('landing', ci, lp.index, lp.polygon, lp.z, plane, before(ci) === 0, baseZ));
  }

  // Chegada: só quando o último componente é um lance com pelo menos dois espelhos (decisão 0012 §2).
  const lastCi = cis[cis.length - 1];
  const lastRun = lastCi !== undefined ? runs.get(lastCi) : undefined;
  if (lastCi !== undefined && lastRun && lastRun.length >= 2) {
    const prevRiser = lastRun[lastRun.length - 2]!;
    const lastRiser = lastRun[lastRun.length - 1]!;
    const dv = sub(mid(lastRiser.a, lastRiser.b), mid(prevRiser.a, prevRiser.b));
    const pl = Math.hypot(dv.x, dv.y);
    const last = treads.find((t) => t.ci === lastCi && t.index === lastRun.length - 1);
    if (pl > EPS && last) {
      const u = mul(dv, 1 / pl);
      const L = Math.min(pl, STAIR_ARRIVAL_MAX_LENGTH);
      const ring: Ring = [lastRiser.a, lastRiser.b, add(lastRiser.b, mul(u, L)), add(lastRiser.a, mul(u, L))];
      const polygon = ringArea(ring) < 0 ? ring.reverse() : ring;
      pieces.push(...fit('arrival', lastCi, 1, polygon, stair.topZ - slab, last.plane, last.atBase, baseZ));
    }
  }
  return pieces;
}

/** Degrau k (índice `st.index`) entre os espelhos k e k+1 do lance: fundo a `T` abaixo do topo, ao longo de `d`. */
function treadOf(st: ResolvedStairStep, rs: ResolvedStairRiser[], h: number, sd: number, stepped: boolean, atBase: boolean): Tread | null {
  const rb = rs[st.index - 1];
  const rf = rs[st.index];
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
  return { ci: st.componentIndex, index: st.index, polygon: st.polygon, zTop: st.z, T, plane, atBase };
}

/**
 * Peça com o fundo `plane`, cortada pelo piso base quando o lance parte de `baseZ` (decisão 0012 §2): plano inteiro
 * abaixo de `baseZ` vira fundo plano em `baseZ`; plano que cruza `baseZ` é dividido em duas peças.
 */
function fit(
  kind: StairBodyPiece['kind'],
  componentIndex: number,
  index: number,
  polygon: Ring,
  zTop: number,
  plane: BottomPlane,
  cut: boolean,
  baseZ: number,
): StairBodyPiece[] {
  const piece = (poly: Ring, bottom: BottomPlane): StairBodyPiece => ({ kind, componentIndex, index, polygon: poly, zTop, bottom });
  const flat = (): BottomPlane => ({ a: 0, b: 0, c: baseZ });
  if (!cut) return [piece(polygon, plane)];
  const vals = polygon.map((p) => plane.a * p.x + plane.b * p.y + plane.c);
  if (Math.min(...vals) >= baseZ - EPS) return [piece(polygon, plane)];
  if (Math.max(...vals) <= baseZ + EPS) return [piece(polygon, flat())];
  return [
    ...clipByLevel(polygon, plane, baseZ, 'below').map((r) => piece(r, flat())),
    ...clipByLevel(polygon, plane, baseZ, 'above').map((r) => piece(r, plane)),
  ];
}
