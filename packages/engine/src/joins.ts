import { cross, dist, dot, intersectLines, mul, add, type Vec2 } from '@hestia/geom';
import { pointAt, type WallFrame } from './frame.ts';

const JOIN_TOL = 0.02;
/** ~2° — abaixo disso as paredes são consideradas colineares. */
const COLLINEAR_SIN = 0.035;
const MITER_LIMIT = 6;

/** Dados do vizinho necessários para esquadrejar uma camada contra ele (tudo em números → cache estável). */
export interface MiterSide {
  /** Ponto onde o eixo desta parede termina na junção. */
  o: Vec2;
  u: Vec2;
  n: Vec2;
  sHi: number;
  sLo: number;
  /** +1 se a face externa (afastada do vizinho) é a de s maior. */
  sigma: 1 | -1;
}

export type EndSpec =
  | { kind: 'flat'; t: number }
  | { kind: 'miter'; self: MiterSide; other: MiterSide };

export interface WallEnds {
  a: EndSpec;
  b: EndSpec;
}

interface EndRef {
  f: WallFrame;
  which: 'a' | 'b';
  o: Vec2;
  /** Direção unitária saindo do nó para dentro da parede. */
  dir: Vec2;
}

const sOfDepth = (m: MiterSide, d: number): number => (m.sigma > 0 ? m.sHi - d : m.sLo + d);

/** Ponto da aresta de fim da camada, na fronteira à profundidade `d` (medida da face externa do canto). */
export function miterPoint(self: MiterSide, other: MiterSide, d: number): Vec2 | null {
  const dd = Math.min(d, other.sHi - other.sLo);
  const sA = sOfDepth(self, d);
  const sB = sOfDepth(other, dd);
  const r = intersectLines(add(self.o, mul(self.n, sA)), self.u, add(other.o, mul(other.n, sB)), other.u);
  return r ? r.point : null;
}

const sideOf = (r: EndRef, towards: Vec2): MiterSide => ({
  o: r.o,
  u: r.f.u,
  n: r.f.n,
  sHi: r.f.sHi,
  sLo: r.f.sLo,
  // Se o vizinho está à esquerda desta parede, a face externa do canto é a da direita (s menor).
  sigma: dot(r.f.n, towards) > 0 ? -1 : 1,
});

const flatAt = (r: EndRef, ext: number): EndSpec => ({ kind: 'flat', t: r.which === 'a' ? -ext : r.f.length + ext });

function setEnd(out: Map<string, WallEnds>, r: EndRef, spec: EndSpec): void {
  const e = out.get(r.f.wall.id);
  if (e) e[r.which] = spec;
}

function miterPair(out: Map<string, WallEnds>, a: EndRef, b: EndRef): void {
  const sa = sideOf(a, b.dir);
  const sb = sideOf(b, a.dir);
  const limit = MITER_LIMIT * Math.max(a.f.thickness, b.f.thickness, 0.05);
  const ok = (s: MiterSide, o: MiterSide, ref: EndRef): boolean => {
    const t = s.sHi - s.sLo;
    for (const d of [0, t]) {
      const p = miterPoint(s, o, d);
      if (!p || dist(p, ref.o) > limit) return false;
    }
    return true;
  };
  if (!ok(sa, sb, a) || !ok(sb, sa, b)) return; // ângulo agudo demais: mantém corte reto
  setEnd(out, a, { kind: 'miter', self: sa, other: sb });
  setEnd(out, b, { kind: 'miter', self: sb, other: sa });
}

/** Ramal que termina no meio de outra parede: o fim vai até a linha de centro da parede atravessada. */
function toCenterline(branch: EndRef, through: WallFrame): EndSpec | null {
  const den = dot(branch.f.u, through.n);
  if (Math.abs(den) < 0.05) return null;
  const t = (through.sMid + dot(sub2(through.a, branch.f.a), through.n)) / den;
  if (branch.which === 'a') return { kind: 'flat', t: Math.min(t, branch.f.length - 0.01) };
  return { kind: 'flat', t: Math.max(t, 0.01) };
}

const sub2 = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x - q.x, y: p.y - q.y });

function groupEnds(refs: EndRef[]): EndRef[][] {
  const parent = refs.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    return r;
  };
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      if (refs[i]!.f === refs[j]!.f) continue;
      if (dist(refs[i]!.o, refs[j]!.o) <= JOIN_TOL) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, EndRef[]>();
  refs.forEach((r, i) => {
    const k = find(i);
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  });
  return [...groups.values()];
}

/** Extensão (corte reto) necessária para cobrir o canto externo com `other`. */
function outerExtension(a: EndRef, b: EndRef): number {
  const sa = sideOf(a, b.dir);
  const sb = sideOf(b, a.dir);
  const p = miterPoint(sa, sb, 0);
  if (!p) return 0;
  return Math.max(0, -dot(sub2(p, a.o), a.dir));
}

function resolveNode(out: Map<string, WallEnds>, g: EndRef[]): void {
  if (g.length === 2) {
    const [a, b] = g as [EndRef, EndRef];
    if (Math.abs(cross(a.dir, b.dir)) < COLLINEAR_SIN) return; // continuação ou sobreposição: corte reto
    miterPair(out, a, b);
    return;
  }
  // 3+ paredes: procura um par colinear (parede "passante" dividida no nó).
  let pair: [number, number] | null = null;
  for (let i = 0; i < g.length && !pair; i++) {
    for (let j = i + 1; j < g.length; j++) {
      if (Math.abs(cross(g[i]!.dir, g[j]!.dir)) < COLLINEAR_SIN && dot(g[i]!.dir, g[j]!.dir) < 0) {
        pair = [i, j];
        break;
      }
    }
  }
  if (pair) {
    const through = g[pair[0]]!.f;
    g.forEach((r, i) => {
      if (i === pair![0] || i === pair![1]) return;
      const spec = toCenterline(r, through);
      if (spec) setEnd(out, r, spec);
    });
    return;
  }
  // Sem par colinear: cada fim se estende o necessário para cobrir o nó (aproximação documentada).
  for (const r of g) {
    let ext = 0;
    for (const o of g) if (o !== r) ext = Math.max(ext, outerExtension(r, o));
    setEnd(out, r, flatAt(r, Math.min(ext, MITER_LIMIT * r.f.thickness)));
  }
}

/** Fim isolado que cai dentro de outra parede vira junção em T. */
function tryTee(out: Map<string, WallEnds>, r: EndRef, frames: WallFrame[]): void {
  let best: { g: WallFrame; sd: number } | null = null;
  for (const g of frames) {
    if (g === r.f) continue;
    const rel = sub2(r.o, g.a);
    const t = dot(rel, g.u);
    const sd = Math.abs(dot(rel, g.n) - g.sMid);
    if (t < -JOIN_TOL || t > g.length + JOIN_TOL) continue;
    if (sd > g.thickness / 2 + JOIN_TOL) continue;
    if (Math.abs(cross(r.dir, g.u)) < 0.1) continue;
    if (!best || sd < best.sd) best = { g, sd };
  }
  if (!best) return;
  const spec = toCenterline(r, best.g);
  if (spec) setEnd(out, r, spec);
}

/** Calcula como cada fim de parede é cortado, levando em conta as demais paredes do nível. */
export function computeEnds(frames: WallFrame[]): Map<string, WallEnds> {
  const out = new Map<string, WallEnds>();
  for (const f of frames) {
    out.set(f.wall.id, { a: { kind: 'flat', t: 0 }, b: { kind: 'flat', t: f.length } });
  }
  const refs: EndRef[] = [];
  for (const f of frames) {
    if (!f.wall.noJoinStart) refs.push({ f, which: 'a', o: pointAt(f, 0, 0), dir: f.u });
    if (!f.wall.noJoinEnd) refs.push({ f, which: 'b', o: pointAt(f, f.length, 0), dir: { x: -f.u.x, y: -f.u.y } });
  }
  const grouped = new Set<EndRef>();
  for (const g of groupEnds(refs)) {
    if (g.length >= 2) {
      g.forEach((r) => grouped.add(r));
      resolveNode(out, g);
    }
  }
  for (const r of refs) if (!grouped.has(r)) tryTee(out, r, frames);
  return out;
}
