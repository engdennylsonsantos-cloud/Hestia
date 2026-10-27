import { asMulti, pointsText, ringArea, sub, weightedSkeleton, type SkeletonInput, type SkeletonResult, type SkeletonStep, type Vec2 } from '@hestia/geom';
import { crossingParams, perpOf, planeHas, unitOf } from './roofGeom.ts';
import { envelopePlanes } from './roofEnvelope.ts';
import type { ResolvedRoofPlane, RoofLine } from './roofs.ts';

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
 * Furos entram no esqueleto como anéis de peso 0 (empena em volta da abertura, decisão 0008 item 8)? Não: o esqueleto de
 * @hestia/geom falha com furo de aresta paralela ao contorno ("arestas paralelas"), com furo triangular ou fora do centro
 * ("limite de eventos") e não termina com furo girado. Em vez disso, o contorno é resolvido sem o furo e a empena do furo
 * é construída à parte como prisma vertical até o plano das águas (`holeGableLines`), com a empena por furo; o furo segue
 * recortado da superfície (`roofs.ts`), então a área e a cota longe do furo ficam certas e não há exceção.
 */
export const HOLES_IN_SKELETON = false;

/** −0 vira +0. */
const zeroPos = (v: number): number => (v === 0 ? 0 : v);

/** Índice, no contorno original, da aresta k do anel anti-horário quando o original é horário (inverso da ordem). */
const reversedIndex = (k: number, n: number): number => (((n - 2 - k) % n) + n) % n;

/**
 * Telhado plano (nenhuma aresta define inclinação): uma água horizontal, na cota do beiral, sobre o contorno (os furos
 * saem depois, em `roofs.ts`). Sem caimento: `percent` 0 e subida fixa para cima, então a cota é a do beiral em toda parte.
 */
function flatPlanes(boundary: Vec2[], eaveZ: number): WaterSolution {
  const ring = ringArea(boundary) >= 0 ? boundary : [...boundary].reverse();
  return { planes: [{ polygon: asMulti(ring), origin: boundary[0]!, up: { x: 0, y: 1 }, percent: 0, z0: eaveZ }] };
}

/**
 * Águas pelo esqueleto reto com pesos: cada aresta com inclinação gera a água da face dela, com a cota
 * z = eaveZ + inclinação × distância à aresta. Arestas sem inclinação são empenas (sem água). O solver recebe o contorno
 * anti-horário (e os furos, se `HOLES_IN_SKELETON`); a ordem das arestas volta à original pelo índice.
 *
 * Sem inclinação nenhuma, o telhado é plano. Quando o esqueleto não fecha, não gera água ou deixa degrau (superfície
 * descontínua), o cálculo cai na envoltória dos planos das arestas inclinadas (roofEnvelope.ts), como o Revit: a recusa
 * só sobra para região sem aresta inclinada que a cubra.
 */
export function skeletonPlanes(boundary: Vec2[], holes: Vec2[][], edgeSlopes: Array<number | null>, eaveZ: number): WaterSolution {
  const n = boundary.length;
  if (edgeSlopes.length !== n) {
    return { planes: [], problem: `as inclinações (${edgeSlopes.length}) não batem com as arestas do contorno (${n})` };
  }
  if (n < 3) return { planes: [], problem: 'o contorno tem menos de 3 pontos' };
  const weights = edgeSlopes.map(weightOf);
  if (!weights.some((w) => w > 0)) return flatPlanes(boundary, eaveZ);
  const skeleton = skeletonWater(boundary, holes, edgeSlopes, weights, eaveZ);
  // Esqueleto que fecha sem degrau fica como está. Com degrau (superfície descontínua) ou sem água, vale a envoltória.
  if (skeleton.planes.length && !skeleton.steps) return skeleton;
  let envelope: WaterSolution;
  try {
    envelope = envelopePlanes(boundary, edgeSlopes, eaveZ);
  } catch {
    // A envoltória não conseguiu recortar o contorno (topologia que o recorte não aceita): vale o motivo do esqueleto.
    return skeleton;
  }
  return envelope.planes.length || envelope.problem ? envelope : skeleton;
}

/** Águas do esqueleto reto com pesos (sem o fallback): vazias, com `problem`, quando ele não fecha. */
function skeletonWater(boundary: Vec2[], holes: Vec2[][], edgeSlopes: Array<number | null>, weights: number[], eaveZ: number): WaterSolution {
  const n = boundary.length;
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
  if (!res.ok) {
    const reason = res.reason ?? 'o contorno não gerou águas';
    // Com lugar definido, a recusa diz onde a frente de onda não fecha (o usuário vê os pontos, não só a falha).
    return { planes: [], problem: res.points?.length ? `o esqueleto não fecha em ${pointsText(res.points)} m (${reason})` : reason };
  }
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

/**
 * Empena (testeira) em volta de cada furo (claraboia/shaft): o furo não entra no esqueleto; cada aresta do furo vira
 * uma linha 'gable' — o prisma vertical da cota do beiral até o plano da água que a cobre. O trecho é partido onde a
 * aresta cruza uma divisa entre águas, para a área da testeira sair por água; o trecho fora de toda água não gera linha
 * (furo fora das águas, como em águas livres que não cobrem a região).
 */
export function holeGableLines(holes: Vec2[][], planes: ResolvedRoofPlane[]): RoofLine[] {
  const water = planes.flatMap((pl) => pl.polygon);
  const out: RoofLine[] = [];
  for (const h of holes) {
    if (h.length < 3) continue;
    for (let i = 0; i < h.length; i++) {
      const a = h[i]!;
      const b = h[(i + 1) % h.length]!;
      const ab = sub(b, a);
      const ts = crossingParams(a, b, water);
      for (let k = 0; k + 1 < ts.length; k++) {
        const t0 = ts[k]!;
        const t1 = ts[k + 1]!;
        if (t1 - t0 < 1e-12) continue;
        const p = { x: a.x + ab.x * t0, y: a.y + ab.y * t0 };
        const q = { x: a.x + ab.x * t1, y: a.y + ab.y * t1 };
        const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        if (planes.some((pl) => planeHas(pl.polygon, m))) out.push({ kind: 'gable', a: p, b: q });
      }
    }
  }
  return out;
}
