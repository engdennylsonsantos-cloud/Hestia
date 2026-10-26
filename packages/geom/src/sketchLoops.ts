import { arcSample } from './arc.ts';
import { SKETCH_TOL, type SegGeo } from './sketchGeom.ts';
import { dist, type Vec2 } from './vec.ts';

/** Grafo das pontas: pontas a até 1 mm uma da outra são o mesmo nó. */
export interface Graph {
  /** Por linha (índice local): nós das pontas a e b. */
  ends: [number, number][];
  pos: Vec2[];
  /** Nº de pontas que chegam a cada nó. */
  deg: number[];
}

export function buildGraph(lines: SegGeo[]): Graph {
  const pos: Vec2[] = [];
  const node = (p: Vec2): number => {
    let i = pos.findIndex((q) => dist(p, q) <= SKETCH_TOL);
    if (i < 0) i = pos.push(p) - 1;
    return i;
  };
  const ends = lines.map((g): [number, number] => [node(g.seg.a), node(g.seg.b)]);
  const deg = pos.map(() => 0);
  for (const [a, b] of ends) {
    deg[a] = (deg[a] ?? 0) + 1;
    deg[b] = (deg[b] ?? 0) + 1;
  }
  return { ends, pos, deg };
}

/** Agrupa as linhas em componentes conexos (linhas que compartilham um nó). */
export function groupSegs(g: Graph): number[][] {
  const parent = g.pos.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r] ?? r;
    return r;
  };
  for (const [a, b] of g.ends) parent[find(a)] = find(b);
  const groups = new Map<number, number[]>();
  g.ends.forEach(([a], s) => {
    const r = find(a);
    let list = groups.get(r);
    if (!list) {
      list = [];
      groups.set(r, list);
    }
    list.push(s);
  });
  return [...groups.values()];
}

/**
 * Componente: `open` tem ponta livre; `branch` tem nó com três ou mais pontas (laços encostados);
 * `cycle` é um laço fechado simples (todo nó com exatamente duas pontas).
 */
export type CompKind = 'open' | 'branch' | 'cycle';

export interface Comp {
  segs: number[];
  kind: CompKind;
  /** Ponto para o balão de erro: ponta livre, nó de encontro ou um vértice. */
  at: Vec2;
}

export function classify(g: Graph, segs: number[]): Comp {
  const nodes = [...new Set(segs.flatMap((s) => g.ends[s] ?? []))];
  const first = nodes[0] ?? 0;
  const free = nodes.find((n) => g.deg[n] === 1);
  if (free !== undefined) return { segs, kind: 'open', at: g.pos[free] ?? { x: 0, y: 0 } };
  const branch = nodes.find((n) => (g.deg[n] ?? 0) >= 3);
  if (branch !== undefined) return { segs, kind: 'branch', at: g.pos[branch] ?? { x: 0, y: 0 } };
  return { segs, kind: 'cycle', at: g.pos[first] ?? { x: 0, y: 0 } };
}

/** Passo ao longo do laço: a linha e o sentido em que é percorrida. */
export interface Step {
  seg: number;
  fwd: boolean;
}

/** Ordena as linhas de um laço fechado (cada nó tem duas pontas), no sentido de percurso. */
export function cycleOrder(g: Graph, segs: number[]): Step[] {
  const first = segs[0];
  if (first === undefined) return [];
  const order: Step[] = [{ seg: first, fwd: true }];
  const used = new Set([first]);
  let node = g.ends[first]?.[1];
  while (used.size < segs.length) {
    const next = segs.find((s) => !used.has(s) && (g.ends[s]?.includes(node ?? -1) ?? false));
    if (next === undefined) break;
    const fwd = g.ends[next]?.[0] === node;
    order.push({ seg: next, fwd });
    used.add(next);
    node = fwd ? g.ends[next]?.[1] : g.ends[next]?.[0];
  }
  return order;
}

/** Polilinha do laço, sem repetir o primeiro ponto. Arcos amostrados com erro de corda de 2 mm. */
export function sampleRing(order: Step[], lines: SegGeo[]): Vec2[] {
  const ring: Vec2[] = [];
  for (const { seg, fwd } of order) {
    const g = lines[seg];
    if (!g) continue;
    if (g.arc) {
      const pts = arcSample(g.arc, fwd ? 0 : g.len, fwd ? g.len : 0, 0, 2 * SKETCH_TOL);
      ring.push(...pts.slice(0, -1));
    } else {
      ring.push(fwd ? g.seg.a : g.seg.b);
    }
  }
  return ring;
}
