import { dot, type Vec2 } from './vec.ts';

/**
 * Falha de validação ou de topologia do esqueleto; vira ok:false com `reason`. `at` são os pontos (em planta) onde a
 * frente de onda não fecha, quando a falha tem um lugar definido; o engine os mostra ao usuário.
 */
export class SkeletonFail extends Error {
  constructor(
    message: string,
    readonly at: Vec2[] = [],
  ) {
    super(message);
  }
}

/** Tolerância para unir nós coincidentes (metros e alturas). */
const NODE_TOL = 1e-7;

/**
 * Aresta do frente de onda. Reta no instante t (= altura z):
 *   n·p = c + s·t,  com s = 1/w (w = 0 => s = 0, parede vertical fixa).
 * A face de uma aresta tem plano z = w·distância, logo o deslocamento em planta é t/w.
 * Imutável: partes de uma aresta dividida por split compartilham o mesmo objeto.
 */
export interface Line {
  /** Rótulo da face: índice global da aresta que originou a linha (um grupo de colineares usa o primeiro). */
  id: number;
  /** Direção unitária da aresta de entrada (sentido do anel de entrada). */
  dir: Vec2;
  /** Normal unitária apontando para o material. */
  n: Vec2;
  c: number;
  s: number;
  w: number;
}

/** Vértice do frente de onda: p(t) = p0 + v·t, entre as retas `inL` e `outL`. `node` é o nó onde nasceu. */
export interface Vtx {
  p0: Vec2;
  v: Vec2;
  inL: Line;
  outL: Line;
  node: number;
}

/** Ponto do grafo do esqueleto (planta + altura). */
export interface Node {
  x: number;
  y: number;
  z: number;
}

/** Segmento do grafo: arco de um vértice (f1 != f2) ou aresta-base do contorno (base = true, f1 = f2). */
export interface Seg {
  a: number;
  b: number;
  f1: number;
  f2: number;
  base: boolean;
}

export interface Sim {
  nodes: Node[];
  segs: Seg[];
  rings: Vtx[][];
  T: number;
}

export const newSim = (): Sim => ({ nodes: [], segs: [], rings: [], T: 0 });

/** Índice do nó em (x, y, z), criando-o se não existir (nós coincidentes são unidos). */
export function nodeAt(sim: Sim, x: number, y: number, z: number): number {
  const ns = sim.nodes;
  for (let i = 0; i < ns.length; i++) {
    const q = ns[i]!;
    if (Math.abs(q.x - x) <= NODE_TOL && Math.abs(q.y - y) <= NODE_TOL && Math.abs(q.z - z) <= NODE_TOL) return i;
  }
  ns.push({ x, y, z });
  return ns.length - 1;
}

export const posAt = (v: Vtx, t: number): Vec2 => ({ x: v.p0.x + v.v.x * t, y: v.p0.y + v.v.y * t });

/**
 * Velocidade do vértice entre duas retas: n_a·v = s_a e n_b·v = s_b.
 * Retas paralelas de mesmo sentido e mesma velocidade (vértice reto, p.ex. dois trechos de uma
 * mesma parede que se encontram) têm v = n·s. Null nos demais casos paralelos.
 */
export function solveVel(a: Line, b: Line): Vec2 | null {
  const det = a.n.x * b.n.y - a.n.y * b.n.x;
  if (Math.abs(det) < 1e-10) {
    if (dot(a.n, b.n) > 0 && Math.abs(a.s - b.s) < 1e-12) return { x: a.n.x * a.s, y: a.n.y * a.s };
    return null;
  }
  return { x: (a.s * b.n.y - b.s * a.n.y) / det, y: (a.n.x * b.s - b.n.x * a.s) / det };
}

/**
 * Vértice criado em X no instante T, ligado ao nó `node`.
 * Retas antiparalelas coincidentes não definem velocidade: o vértice nasce degenerado (v = 0)
 * e é tratado pelo "sliver" em skeletonRun.
 */
export function mkVtx(inL: Line, outL: Line, X: Vec2, T: number, node: number): Vtx {
  const v = solveVel(inL, outL);
  if (v) return { p0: { x: X.x - v.x * T, y: X.y - v.y * T }, v, inL, outL, node };
  if (dot(inL.n, outL.n) < 0) return { p0: X, v: { x: 0, y: 0 }, inL, outL, node };
  throw new SkeletonFail('vértice reto entre trechos colineares de pesos diferentes (limite conhecido do esqueleto)', [X]);
}

/** Encerra a trajetória de um vértice no instante T; devolve o nó final. */
export function closeVtx(sim: Sim, v: Vtx, T: number): number {
  const p = posAt(v, T);
  const b = nodeAt(sim, p.x, p.y, T);
  if (b !== v.node) sim.segs.push({ a: v.node, b, f1: v.inL.id, f2: v.outL.id, base: false });
  return b;
}
