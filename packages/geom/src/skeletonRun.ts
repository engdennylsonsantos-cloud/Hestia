import { dist, dot, type Vec2 } from './vec.ts';
import { SkeletonFail, closeVtx, mkVtx, nodeAt, posAt, solveVel, type Sim, type Vtx } from './skeletonCore.ts';
import { nextEvent, type Event } from './skeletonEvents.ts';

type EdgeEv = Extract<Event, { kind: 'edge' }>;
type SplitEv = Extract<Event, { kind: 'split' }>;

/** Vértices de `from` até `to` (inclusive, em volta do anel). */
function cyc(R: Vtx[], from: number, to: number): Vtx[] {
  const m = R.length;
  const out: Vtx[] = [];
  let k = from;
  for (let guard = 0; guard < m; guard++) {
    out.push(R[k]!);
    if (k === to) break;
    k = (k + 1) % m;
  }
  return out;
}

/** Aresta P→Q encolheu a zero: vértices P e Q viram um único vértice Y entre as retas externas. */
function applyEdge(sim: Sim, ev: EdgeEv): void {
  const R = sim.rings[ev.r]!;
  const m = R.length;
  const i = ev.i;
  const T = ev.t;
  const P = R[i]!;
  const Q = R[(i + 1) % m]!;
  const pp = posAt(P, T);
  const pq = posAt(Q, T);
  const X = { x: (pp.x + pq.x) / 2, y: (pp.y + pq.y) / 2 };
  const N = nodeAt(sim, X.x, X.y, T);
  closeVtx(sim, P, T);
  closeVtx(sim, Q, T);
  const Y = mkVtx(P.inL, Q.outL, X, T, N);
  sim.rings[ev.r] = [...cyc(R, (i + 2) % m, (i - 1 + m) % m), Y];
}

/**
 * Vértice reflexo V (retas A→B) atinge a aresta K = R2[j].outL no ponto X.
 * - meio da aresta: X1 = (K,B) e X2 = (A,K); o anel se divide (mesmo anel) ou funde (anéis diferentes).
 * - extremo inicial W = R2[j] (evento vértice-vértice): o trecho K_1 tem comprimento zero; W some e
 *   nasce Y = (W.in, B) no lugar de X1; X2 = (A,K) como acima.
 * - extremo final Q = R2[j+1]: Q some e nasce Z = (A, Q.out); X1 = (K,B) como acima.
 */
function applySplit(sim: Sim, ev: SplitEv): void {
  const T = ev.t;
  const R = sim.rings[ev.r]!;
  const R2 = sim.rings[ev.r2]!;
  const m = R.length;
  const m2 = R2.length;
  const i = ev.i;
  const j = ev.j;
  const V = R[i]!;
  const A = V.inL;
  const B = V.outL;
  const K = R2[j]!.outL;
  const X = posAt(V, T);
  const N = nodeAt(sim, X.x, X.y, T);
  closeVtx(sim, V, T);
  const X2 = mkVtx(A, K, X, T, N);
  const sameRing = ev.r === ev.r2;
  if (ev.at === 'start') {
    const W = R2[j]!;
    const Y = mkVtx(W.inL, B, X, T, N);
    closeVtx(sim, W, T);
    if (sameRing) {
      if (j === (i + 1) % m) throw new SkeletonFail('evento vértice-vértice sobre aresta adjacente não suportado');
      sim.rings = sim.rings
        .filter((_, k) => k !== ev.r)
        .concat([
          [Y, ...cyc(R, (i + 1) % m, (j - 1 + m) % m)],
          [X2, ...cyc(R, (j + 1) % m, (i - 1 + m) % m)],
        ]);
    } else {
      const merged = [X2, ...cyc(R2, (j + 1) % m2, (j - 1 + m2) % m2), Y, ...cyc(R, (i + 1) % m, (i - 1 + m) % m)];
      sim.rings = sim.rings.filter((_, k) => k !== ev.r && k !== ev.r2).concat([merged]);
    }
    return;
  }
  if (ev.at === 'end') {
    const Q = R2[(j + 1) % m2]!;
    const X1 = mkVtx(K, B, X, T, N);
    const Z = mkVtx(A, Q.outL, X, T, N);
    closeVtx(sim, Q, T);
    if (sameRing) {
      sim.rings = sim.rings
        .filter((_, k) => k !== ev.r)
        .concat([
          [X1, ...cyc(R, (i + 1) % m, j)],
          [Z, ...cyc(R, (j + 2) % m, (i - 1 + m) % m)],
        ]);
    } else {
      const merged = [Z, ...cyc(R2, (j + 2) % m2, j), X1, ...cyc(R, (i + 1) % m, (i - 1 + m) % m)];
      sim.rings = sim.rings.filter((_, k) => k !== ev.r && k !== ev.r2).concat([merged]);
    }
    return;
  }
  const X1 = mkVtx(K, B, X, T, N);
  let fresh: Vtx[][];
  if (sameRing) {
    fresh = [
      [X1, ...cyc(R, (i + 1) % m, j)],
      [X2, ...cyc(R, (j + 1) % m, (i - 1 + m) % m)],
    ];
    sim.rings = sim.rings.filter((_, k) => k !== ev.r).concat(fresh);
  } else {
    fresh = [[X2, ...cyc(R2, (j + 1) % m2, j), X1, ...cyc(R, (i + 1) % m, (i - 1 + m) % m)]];
    sim.rings = sim.rings.filter((_, k) => k !== ev.r && k !== ev.r2).concat(fresh);
  }
}

/**
 * Resolve vértices degenerados (retas antiparalelas coincidentes, "sliver" de largura zero):
 * o vértice V e seus vizinhos U e W fecham no ponto comum; a cumeeira é o segmento V→U.
 */
function fixRing(sim: Sim, R0: Vtx[]): Vtx[] {
  let R = R0;
  for (let guard = 0; guard < 10000; guard++) {
    const m = R.length;
    if (m < 3) return R;
    const k = R.findIndex((v) => solveVel(v.inL, v.outL) === null);
    if (k < 0) return R;
    const V = R[k]!;
    const U = R[(k - 1 + m) % m]!;
    const W = R[(k + 1) % m]!;
    if (dot(V.inL.n, V.outL.n) >= 0) throw new SkeletonFail('vértice degenerado sem solução');
    const T = sim.T;
    const pu: Vec2 = posAt(U, T);
    const pw: Vec2 = posAt(W, T);
    const pv: Vec2 = posAt(V, T);
    const dU = dist(pu, pv);
    const dW = dist(pw, pv);
    if (Math.abs(dU - dW) > 1e-7) {
      // U e W estão na mesma semirreta a partir de V: o sliver vai só até o mais próximo.
      // A cumeeira é V→próximo; o próximo é trocado por um vértice novo sobre a reta do outro lado.
      const nearIsU = dU < dW;
      const near = nearIsU ? U : W;
      const pn = nearIsU ? pu : pw;
      const nN = closeVtx(sim, near, T);
      if (V.node !== nN) sim.segs.push({ a: V.node, b: nN, f1: V.inL.id, f2: V.outL.id, base: false });
      const NEW = nearIsU ? mkVtx(U.inL, V.outL, pn, T, nN) : mkVtx(V.inL, W.outL, pn, T, nN);
      const idxNear = nearIsU ? (k - 1 + m) % m : (k + 1) % m;
      R = R.map((v, idx) => (idx === idxNear ? NEW : v)).filter((_, idx) => idx !== k);
      continue;
    }
    if (dist(pu, pw) > 1e-6) throw new SkeletonFail('evento degenerado não suportado (arestas paralelas)');
    const nU = closeVtx(sim, U, T);
    closeVtx(sim, W, T);
    if (V.node !== nU) sim.segs.push({ a: V.node, b: nU, f1: V.inL.id, f2: V.outL.id, base: false });
    if (m === 3) return [];
    if (m === 4) {
      // sobra um único vértice Z = (W.out, U.in) no ponto comum; se ele também é degenerado,
      // a cumeeira vai de Z até esse ponto
      const Z = R[(k + 2) % m]!;
      if (solveVel(Z.inL, Z.outL) === null) {
        const nZ = closeVtx(sim, Z, T);
        if (nZ !== nU) sim.segs.push({ a: nZ, b: nU, f1: Z.inL.id, f2: Z.outL.id, base: false });
        return [];
      }
      return [Z];
    }
    const rest = cyc(R, (k + 2) % m, (k - 2 + m) % m);
    const NEW = mkVtx(U.inL, W.outL, pu, T, nU);
    R = [...rest, NEW];
  }
  throw new SkeletonFail('limite de iterações na resolução de degenerescências');
}

/** Anel com menos de 3 vértices: todos os vértices se encerram agora; 2 vértices geram cumeeira entre eles. */
function finishRing(sim: Sim, R: Vtx[]): void {
  const T = sim.T;
  const ids = R.map((v) => closeVtx(sim, v, T));
  if (R.length === 2 && ids[0] !== ids[1]) {
    sim.segs.push({ a: ids[0]!, b: ids[1]!, f1: R[0]!.inL.id, f2: R[0]!.outL.id, base: false });
  }
}

function settle(sim: Sim): void {
  const out: Vtx[][] = [];
  for (const R0 of sim.rings) {
    const R = fixRing(sim, R0);
    if (R.length >= 3) out.push(R);
    else finishRing(sim, R);
  }
  sim.rings = out;
}

/** Roda o frente de onda até todos os anéis se encerrarem. */
export function runSim(sim: Sim): void {
  for (let it = 0; it < 200000; it++) {
    if (sim.rings.length === 0) return;
    const ev = nextEvent(sim.rings, sim.T);
    if (!ev) throw new SkeletonFail('frente de onda sem eventos: geometria não converge');
    sim.T = ev.t;
    if (ev.kind === 'edge') applyEdge(sim, ev);
    else applySplit(sim, ev);
    settle(sim);
  }
  throw new SkeletonFail('limite de eventos atingido');
}
