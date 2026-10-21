import { add, intersection, mul, multiArea, norm, perp, sub, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import {
  STAIR_OPENING_DEFAULT_THICKNESS,
  stairBody,
  type ResolvedStair,
  type ResolvedStairRiser,
  type ResolvedStairStep,
  type StairBodyPiece,
} from '@hestia/engine';
import {
  floorPolygon,
  floorsOnLevel,
  floorTypeThickness,
  slabPolygon,
  slabsOnLevel,
  slabTypeThickness,
  type Id,
  type Project,
} from '@hestia/model';
import { riserPoints } from '../stairRisers.ts';
import { extrudePolygon, type SolidBatch } from './solids.ts';

/** Tolerância (m) para reconhecer a cota de um degrau igual à de um espelho. */
const Z_TOL = 1e-9;

/** Tolerância (m, m²) das comparações de área na cobertura da escada pela laje. */
const EPS = 1e-9;

/** Espessura mínima (m) de uma peça monolítica: o fundo nunca alcança o topo (decisão 0012 §2). */
const MIN_PIECE_THICKNESS = 1e-4;

/** Centroide simples (média dos vértices): basta para degraus, que são polígonos quase convexos. */
const centroid = (r: Ring): Vec2 => ({ x: r.reduce((s, p) => s + p.x, 0) / r.length, y: r.reduce((s, p) => s + p.y, 0) / r.length });

/** Normal à esquerda em cada vértice da polilinha (tangente pela diferença central; unilateral nas pontas). */
function leftNormals(pts: Vec2[]): Vec2[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    return perp(norm(sub(b, a)));
  });
}

/**
 * Lado para o qual a espessura do espelho cresce: para trás, onde fica o degrau de cota z0 (o anterior, mais baixo).
 * Sem degrau de cota z0 (primeiro espelho), vai para o lado oposto ao degrau de cota z1. Retorna +1 (esquerda) ou −1.
 */
function behindSide(s: ResolvedStair, r: ResolvedStairRiser, mid: Vec2, n: Vec2): 1 | -1 {
  const stepAt = (z: number): ResolvedStairStep | undefined => s.steps.find((st) => Math.abs(st.z - z) < Z_TOL);
  const below = stepAt(r.z0);
  if (below) return dotSign(n, sub(centroid(below.polygon), mid)) >= 0 ? 1 : -1;
  const above = stepAt(r.z1);
  if (above) return dotSign(n, sub(centroid(above.polygon), mid)) >= 0 ? -1 : 1;
  return 1;
}

const dotSign = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/**
 * Seção do espelho com espessura `t` atrás da linha (para o lado do degrau anterior): a polilinha da linha do espelho
 * seguida da mesma polilinha deslocada. Assim o espelho não invade o degrau de cota superior nem o de baixo.
 */
export function riserSlab(s: ResolvedStair, r: ResolvedStairRiser, t: number): Ring {
  const pts = riserPoints(r);
  const ns = leftNormals(pts);
  const n0 = ns[Math.floor(ns.length / 2)]!;
  const mid = pts[Math.floor(pts.length / 2)]!;
  const side = behindSide(s, r, mid, n0);
  const off = pts.map((p, i) => add(p, mul(ns[i]!, side * t)));
  return [...pts, ...off.reverse()];
}

/**
 * Espessura (m) da laje ou do piso do nível de topo que cobre a planta da escada: a maior, como o furo da laje
 * (`thicknessUnder` de stairOpenings.ts, que não é exportada; mantenha as duas em sincronia). Sem cobertura, o padrão.
 */
export function stairSlabThickness(p: Project, s: ResolvedStair): number {
  if (!s.topLevelId) return STAIR_OPENING_DEFAULT_THICKNESS;
  const covers = (polygon: Polygon): boolean => multiArea(intersection([polygon], s.footprint)) > EPS;
  const thicknesses: number[] = [];
  for (const sl of slabsOnLevel(p, s.topLevelId)) {
    const t = p.slabTypes[sl.typeId];
    if (t && covers(slabPolygon(sl))) thicknesses.push(slabTypeThickness(t));
  }
  for (const f of floorsOnLevel(p, s.topLevelId)) {
    const t = p.floorTypes[f.typeId];
    if (t && covers(floorPolygon(f))) thicknesses.push(floorTypeThickness(t));
  }
  return thicknesses.length ? Math.max(...thicknesses) : STAIR_OPENING_DEFAULT_THICKNESS;
}

/** Lote do material `m` dentro do mapa, criado na primeira vez. */
function batchOf(byMat: Map<Id, SolidBatch>, m: Id): SolidBatch {
  let b = byMat.get(m);
  if (!b) {
    b = { materialId: m, positions: [], normals: [], indices: [] };
    byMat.set(m, b);
  }
  return b;
}

/**
 * Peça do lance monolítico: topo plano em `zTop` e fundo no plano `a·x + b·y + c`, limitado a `zTop − 1e-4` para a
 * espessura nunca ser nula ou negativa. A extrusão recebe a menor cota do fundo só para passar pelo guarda de altura.
 */
function extrudePiece(b: SolidBatch, piece: StairBodyPiece): void {
  const { a, b: slope, c } = piece.bottom;
  const top = piece.zTop;
  const bottomAt = (x: number, y: number): number => Math.min(a * x + slope * y + c, top - MIN_PIECE_THICKNESS);
  const zMin = Math.min(...piece.polygon.map((p) => bottomAt(p.x, p.y)));
  extrudePolygon(b, [piece.polygon], zMin, top, undefined, bottomAt);
}

/**
 * Sólidos das escadas (3D), por material do tipo (decisão 0011 §1). Lance monolítico (decisão 0012): o corpo são as
 * peças de `stairBody` (degraus, patamares e chegada), cada uma com topo plano e fundo plano ou em rampa; os espelhos
 * são a face de trás das peças, então não há placas. Lance montado: degrau de `z − treadThickness` a `z`; espelho de
 * `riserThickness` atrás da linha; patamar de `landingThickness`. Escada com erro (issue `error`) ou sem degraus não
 * gera malha. `slabThicknessOf` dá a espessura da laje de chegada de cada escada (padrão: 0,15 m).
 */
export function buildStairSolids(
  stairs: ResolvedStair[],
  slabThicknessOf: (s: ResolvedStair) => number = () => STAIR_OPENING_DEFAULT_THICKNESS,
): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const s of stairs) {
    if (s.steps.length === 0 || s.issues.some((i) => i.severity === 'error')) continue;
    const b = batchOf(byMat, s.type.materialId);
    if (s.type.runStyle === 'monolithic') {
      for (const piece of stairBody(s, { slabThickness: slabThicknessOf(s) }).pieces) extrudePiece(b, piece);
      continue;
    }
    for (const st of s.steps) {
      if (st.kind === 'landing') {
        extrudePolygon(b, [st.polygon], st.z - s.type.landingThickness, st.z);
        continue;
      }
      extrudePolygon(b, [st.polygon], st.z - s.type.treadThickness, st.z);
    }
    if (s.type.riserThickness > 0) {
      for (const r of s.risers) extrudePolygon(b, [riserSlab(s, r, s.type.riserThickness)], r.z0, r.z1);
    }
  }
  return [...byMat.values()];
}
