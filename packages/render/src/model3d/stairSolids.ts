import { add, mul, norm, perp, sub, type Ring, type Vec2 } from '@hestia/geom';
import type { ResolvedStair, ResolvedStairRiser, ResolvedStairStep } from '@hestia/engine';
import type { Id } from '@hestia/model';
import { riserPoints } from '../stairRisers.ts';
import { extrudePolygon, type SolidBatch } from './solids.ts';

/** Tolerância (m) para reconhecer a cota de um degrau igual à de um espelho. */
const Z_TOL = 1e-9;

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
 * Sólidos das escadas (3D), por material do tipo (decisão 0011 §1). Lance monolítico: cada degrau é um prisma de
 * `z − structuralDepth` a `z`; o espelho tem espessura `riserThickness` (se > 0) entre z0 e z1. Lance montado: degrau
 * de `z − treadThickness` a `z`; espelho de `riserThickness` atrás da linha. Patamar: prisma de `z − landingThickness`
 * a `z`, em qualquer estilo. Escada com erro (issue `error`) ou sem degraus não gera malha. Os prismas não se
 * sobrepõem em planta nem em altura (o espelho fica acima do degrau de trás), então volume = Σ área × espessura.
 */
export function buildStairSolids(stairs: ResolvedStair[]): SolidBatch[] {
  const byMat = new Map<Id, SolidBatch>();
  for (const s of stairs) {
    if (s.steps.length === 0 || s.issues.some((i) => i.severity === 'error')) continue;
    const b = batchOf(byMat, s.type.materialId);
    const monolithic = s.type.runStyle === 'monolithic';
    for (const st of s.steps) {
      if (st.kind === 'landing') {
        extrudePolygon(b, [st.polygon], st.z - s.type.landingThickness, st.z);
        continue;
      }
      const depth = monolithic ? s.type.structuralDepth : s.type.treadThickness;
      extrudePolygon(b, [st.polygon], st.z - depth, st.z);
    }
    if (s.type.riserThickness > 0) {
      for (const r of s.risers) extrudePolygon(b, [riserSlab(s, r, s.type.riserThickness)], r.z0, r.z1);
    }
  }
  return [...byMat.values()];
}
