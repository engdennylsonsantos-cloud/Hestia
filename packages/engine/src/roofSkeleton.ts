import { ringArea, sub, weightedSkeleton, type SkeletonInput, type SkeletonResult, type SkeletonStep, type Vec2 } from '@hestia/geom';
import { perpOf, unitOf } from './roofGeom.ts';
import type { ResolvedRoofPlane } from './roofs.ts';

/** Solver do esqueleto reto com pesos (`weightedSkeleton`, em @hestia/geom); trocável pelos testes. */
export type WeightedSkeleton = (input: SkeletonInput) => SkeletonResult;

let solver: WeightedSkeleton = weightedSkeleton;

/** Troca o solver (testes). `null` volta ao esqueleto de @hestia/geom. */
export function setWeightedSkeleton(fn: WeightedSkeleton | null): void {
  solver = fn ?? weightedSkeleton;
}

/** Águas de um telhado: planos já com a cota do beiral; `problem` diz por que não há águas (ausente quando há). */
export interface WaterSolution {
  planes: ResolvedRoofPlane[];
  problem?: string;
  /** Vértices reentrantes com degrau na superfície (empena encostando em beiral), em planta e em m; ausente quando contínua. */
  steps?: SkeletonStep[];
}

/** Peso de uma aresta: percentual / 100 quando ela define inclinação; null, zero ou inválido vira 0 (empena). */
export const weightOf = (s: number | null | undefined): number => (s !== null && s !== undefined && Number.isFinite(s) && s > 0 ? s / 100 : 0);

/**
 * Furos entram no esqueleto como anéis de peso 0 (empena em volta da abertura, decisão 0008 item 8)? Hoje não: o
 * esqueleto de @hestia/geom falha com furo de aresta paralela ao contorno ("arestas paralelas"), com furo triangular ou
 * fora do centro ("limite de eventos") e não termina com furo girado. Enquanto isso, o furo é recortado da superfície
 * calculada sem ele (`roofs.ts`): área e cota longe do furo ficam certas. Trocar para `true` quando o SK resolver.
 */
export const HOLES_IN_SKELETON = false;

/** −0 vira +0. */
const zeroPos = (v: number): number => (v === 0 ? 0 : v);

/** Índice, no contorno original, da aresta k do anel anti-horário quando o original é horário (inverso da ordem). */
const reversedIndex = (k: number, n: number): number => (((n - 2 - k) % n) + n) % n;

/**
 * Águas pelo esqueleto reto com pesos: cada aresta com inclinação gera a água da face dela, com a cota
 * z = eaveZ + inclinação × distância à aresta. Arestas sem inclinação são empenas (sem água). O solver recebe o contorno
 * anti-horário (e os furos, se `HOLES_IN_SKELETON`); a ordem das arestas volta à original pelo índice.
 */
export function skeletonPlanes(boundary: Vec2[], holes: Vec2[][], edgeSlopes: Array<number | null>, eaveZ: number): WaterSolution {
  const n = boundary.length;
  if (edgeSlopes.length !== n) {
    return { planes: [], problem: `as inclinações (${edgeSlopes.length}) não batem com as arestas do contorno (${n})` };
  }
  const weights = edgeSlopes.map(weightOf);
  if (!weights.some((w) => w > 0)) return { planes: [], problem: 'nenhuma aresta define inclinação' };
  const ccw = ringArea(boundary) >= 0;
  const outer = ccw ? boundary : [...boundary].reverse();
  const origOf = (k: number): number => (ccw ? k : reversedIndex(k, n));
  const holeRings = HOLES_IN_SKELETON ? holes.filter((h) => h.length >= 3).map((h) => (ringArea(h) > 0 ? [...h].reverse() : h)) : [];
  let res: SkeletonResult;
  try {
    res = solver({
      outer,
      holes: holeRings,
      weights: [outer.map((_, k) => weights[origOf(k)]!), ...holeRings.map((h) => h.map(() => 0))],
    });
  } catch (e) {
    return { planes: [], problem: `falha no cálculo das águas (${e instanceof Error ? e.message : String(e)})` };
  }
  if (!res.ok) return { planes: [], problem: res.reason ?? 'o contorno não gerou águas' };
  const planes: ResolvedRoofPlane[] = [];
  for (const f of res.faces) {
    if (f.ring !== 0) continue;
    const j = origOf(f.edge);
    const slope = edgeSlopes[j];
    if (!(weights[j]! > 0) || slope === null || slope === undefined) continue;
    const a = boundary[j]!;
    const u = unitOf(sub(boundary[(j + 1) % n]!, a));
    if (!u) continue;
    // Normal para dentro da água: à esquerda da aresta se o contorno é anti-horário, à direita se é horário.
    const left = perpOf(u);
    // `zeroPos` tira o −0 que a rotação deixa (é o mesmo número, mas a comparação de objetos nota a diferença).
    const up = ccw ? left : { x: -left.x, y: -left.y };
    up.x = zeroPos(up.x);
    up.y = zeroPos(up.y);
    planes.push({ polygon: [[f.polygon]], origin: a, up, percent: slope, z0: eaveZ });
  }
  const steps = res.steps && res.steps.length > 0 ? { steps: res.steps } : {};
  return planes.length ? { planes, ...steps } : { planes, problem: 'o contorno não gerou águas' };
}
