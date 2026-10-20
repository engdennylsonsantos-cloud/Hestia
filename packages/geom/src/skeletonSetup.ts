import { cross, dist, dot, mul, norm, perp, sub, type Vec2 } from './vec.ts';
import { ringArea, pointInRing } from './polygon.ts';
import { SkeletonFail, mkVtx, newSim, nodeAt, type Line, type Sim, type Vtx } from './skeletonCore.ts';
import { type LeaderInfo } from './skeletonFaces.ts';

/** Entrada do esqueleto (contrato público; ver skeleton.ts). */
export interface SkeletonInput {
  outer: Vec2[];
  holes: Vec2[][];
  weights: number[][];
}

const EPS_LEN = 1e-9;

function segmentsTouch(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = cross(sub(b, a), sub(c, a));
  const o2 = cross(sub(b, a), sub(d, a));
  const o3 = cross(sub(d, c), sub(a, c));
  const o4 = cross(sub(d, c), sub(b, c));
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  const onSeg = (p: Vec2, q: Vec2, r: Vec2): boolean =>
    Math.abs(cross(sub(q, p), sub(r, p))) <= 1e-9 && dot(sub(r, p), sub(r, q)) <= 1e-9;
  return onSeg(a, b, c) || onSeg(a, b, d) || onSeg(c, d, a) || onSeg(c, d, b);
}

function checkShape(input: SkeletonInput): Vec2[][] {
  if (!Array.isArray(input.holes)) throw new SkeletonFail('furos inválidos: esperado um array');
  const rings = [input.outer, ...input.holes];
  if (!Array.isArray(input.weights) || input.weights.length !== rings.length) {
    throw new SkeletonFail('pesos: deve haver um vetor de pesos por anel (externo e furos)');
  }
  rings.forEach((R, r) => {
    const nome = r === 0 ? 'contorno externo' : `furo ${r}`;
    if (!Array.isArray(R) || R.length < 3) throw new SkeletonFail(`${nome} com menos de 3 vértices`);
    for (const p of R) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new SkeletonFail(`${nome} com coordenada inválida`);
    }
    const m = R.length;
    for (let k = 0; k < m; k++) {
      if (dist(R[k]!, R[(k + 1) % m]!) <= EPS_LEN) throw new SkeletonFail(`${nome} com vértices repetidos`);
    }
    if (Math.abs(ringArea(R)) <= 1e-9) throw new SkeletonFail(`${nome} com área zero`);
    const ws = input.weights[r];
    if (!Array.isArray(ws) || ws.length !== m) throw new SkeletonFail(`${nome}: um peso por aresta`);
    for (const w of ws) {
      if (!Number.isFinite(w) || w < 0) throw new SkeletonFail(`${nome}: pesos devem ser finitos e não negativos`);
    }
  });
  if (input.weights.every((ws) => ws.every((w) => w === 0))) {
    throw new SkeletonFail('nenhuma aresta define inclinação');
  }
  return rings;
}

function checkTopology(rings: Vec2[][]): void {
  rings.forEach((R, r) => {
    const m = R.length;
    for (let i = 0; i < m; i++) {
      for (let j = i + 2; j < m; j++) {
        if (i === 0 && j === m - 1) continue;
        if (segmentsTouch(R[i]!, R[(i + 1) % m]!, R[j]!, R[(j + 1) % m]!)) {
          throw new SkeletonFail(
            r === 0 ? 'contorno com auto-interseção' : `furo ${r} com auto-interseção`,
          );
        }
      }
    }
  });
  for (let a = 0; a < rings.length; a++) {
    for (let b = a + 1; b < rings.length; b++) {
      const A = rings[a]!;
      const B = rings[b]!;
      for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < B.length; j++) {
          if (segmentsTouch(A[i]!, A[(i + 1) % A.length]!, B[j]!, B[(j + 1) % B.length]!)) {
            throw new SkeletonFail('furo encosta ou cruza o contorno (ou outro furo)');
          }
        }
      }
    }
  }
  const outer = rings[0]!;
  for (let r = 1; r < rings.length; r++) {
    if (!pointInRing(rings[r]![0]!, outer)) throw new SkeletonFail(`furo ${r} fora do contorno externo`);
  }
}

/** Ponto de partida do grupo de arestas colineares de mesmo peso: arestas de uma mesma reta se juntam. */
function joinFlags(R: Vec2[], ws: number[]): boolean[] {
  const m = R.length;
  const dirs = R.map((p, k) => norm(sub(R[(k + 1) % m]!, p)));
  return dirs.map((d, k) => {
    const k1 = (k + 1) % m;
    const d2 = dirs[k1]!;
    const cr = cross(d, d2);
    const dt = dot(d, d2);
    if (Math.abs(cr) < 1e-9 && dt > 0) {
      if (ws[k] !== ws[k1]) throw new SkeletonFail('vértice colinear entre arestas de pesos diferentes');
      return true;
    }
    if (Math.abs(cr) < 1e-9 && dt < 0) throw new SkeletonFail('espinho: aresta consecutiva invertida');
    return false;
  });
}

/** Constrói o estado inicial: retas, vértices do frente de onda e arestas-base do grafo. */
export function setup(input: SkeletonInput): { sim: Sim; leaders: LeaderInfo[] } {
  const rings = checkShape(input);
  checkTopology(rings);
  const sim = newSim();
  const leaders: LeaderInfo[] = [];
  let offset = 0;
  rings.forEach((R, r) => {
    const m = R.length;
    const ws = input.weights[r]!;
    const join = joinFlags(R, ws);
    const sgn = (r === 0 ? 1 : -1) * (ringArea(R) > 0 ? 1 : -1);
    const dirs = R.map((p, k) => norm(sub(R[(k + 1) % m]!, p)));
    const s0 = join.findIndex((_, k) => !join[(k - 1 + m) % m]);
    if (s0 < 0) throw new SkeletonFail('contorno inteiro colinear');
    const lines: Line[] = new Array(m);
    for (let q = 0; q < m; q++) {
      const k = (s0 + q) % m;
      const prev = (k - 1 + m) % m;
      if (join[prev]) {
        lines[k] = lines[prev]!;
        continue;
      }
      const w = ws[k]!;
      const id = offset + k;
      lines[k] = {
        id,
        dir: dirs[k]!,
        n: mul(perp(dirs[k]!), sgn),
        c: dot(mul(perp(dirs[k]!), sgn), R[k]!),
        s: w > 0 ? 1 / w : 0,
        w,
      };
      leaders.push({ id, ring: r, edge: k, w });
    }
    const ringVtx: Vtx[] = [];
    for (let k = 0; k < m; k++) {
      if (join[(k - 1 + m) % m]) continue;
      const node = nodeAt(sim, R[k]!.x, R[k]!.y, 0);
      ringVtx.push(mkVtx(lines[(k - 1 + m) % m]!, lines[k]!, R[k]!, 0, node));
    }
    sim.rings.push(ringVtx);
    for (let k = 0; k < m; k++) {
      const a = nodeAt(sim, R[k]!.x, R[k]!.y, 0);
      const b = nodeAt(sim, R[(k + 1) % m]!.x, R[(k + 1) % m]!.y, 0);
      sim.segs.push({ a, b, f1: lines[k]!.id, f2: lines[k]!.id, base: true });
    }
    offset += m;
  });
  return { sim, leaders };
}
