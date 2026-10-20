import { cross, dist, dot, arcTangentAt as arcTan } from '@hestia/geom';
import { endTangent, pointAt, toLocal, type WallFrame } from './frame.ts';
import type { EndRef, WallEnds } from './joinTypes.ts';
import { flatEnd, setEnd, both, buttAgainst } from './joinSides.ts';
import { joinPair, toCenterline } from './joinPair.ts';
import { nodeOfWalls } from './joinNode.ts';

export type { EndSpec, MiterSide, SideSpec, WallEnds } from './joinTypes.ts';
export { miterBreaks, miterPoint } from './joinSides.ts';

/** Tolerância padrão de junção (m); o projeto pode sobrescrever (Project.settings.joinTolerance). */
export const DEFAULT_JOIN_TOL = 0.02;
/** ~2° — abaixo disso as paredes são consideradas colineares. */
const COLLINEAR_SIN = 0.035;

function groupEnds(refs: EndRef[], tol: number): EndRef[][] {
  const parent = refs.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    return r;
  };
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      if (refs[i]!.f === refs[j]!.f) continue;
      if (dist(refs[i]!.o, refs[j]!.o) <= tol) parent[find(i)] = find(j);
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

/** Extremidades de outras paredes no mesmo ponto: serve à interface (alterar a junção dos dois lados). */
export function endPartners(frames: WallFrame[], wallId: string, which: 'a' | 'b', tol = DEFAULT_JOIN_TOL): Array<{ wallId: string; end: 'a' | 'b' }> {
  const me = frames.find((f) => f.wall.id === wallId);
  if (!me) return [];
  const o = which === 'a' ? me.a : me.b;
  const out: Array<{ wallId: string; end: 'a' | 'b' }> = [];
  for (const f of frames) {
    if (f === me) continue;
    if (dist(f.a, o) <= tol) out.push({ wallId: f.wall.id, end: 'a' });
    if (dist(f.b, o) <= tol) out.push({ wallId: f.wall.id, end: 'b' });
  }
  return out;
}

function resolveNode(out: Map<string, WallEnds>, g: EndRef[]): void {
  if (g.length === 2) {
    const [a, b] = g as [EndRef, EndRef];
    if (Math.abs(cross(a.dir, b.dir)) < COLLINEAR_SIN) return; // continuação ou sobreposição: corte reto
    joinPair(out, a, b);
    return;
  }
  // 3+ paredes: procura um par colinear (parede "passante" dividida no nó).
  const pares: Array<[number, number]> = [];
  for (let i = 0; i < g.length; i++) {
    for (let j = i + 1; j < g.length; j++) {
      if (Math.abs(cross(g[i]!.dir, g[j]!.dir)) < COLLINEAR_SIN && dot(g[i]!.dir, g[j]!.dir) < 0) pares.push([i, j]);
    }
  }
  const pair = pares.length === 1 ? pares[0]! : null;
  if (pair) {
    const through = g[pair[0]]!.f;
    g.forEach((r, i) => {
      if (i === pair![0] || i === pair![1]) return;
      const spec = buttAgainst(r, through) ?? toCenterline(r, through);
      if (spec) setEnd(out, r, both(spec));
    });
    return;
  }
  nodeOfWalls(out, g);
}

function findTee(r: EndRef, frames: WallFrame[], tol: number): WallFrame | null {
  let best: { g: WallFrame; sd: number } | null = null;
  for (const g of frames) {
    if (g === r.f) continue;
    const loc = toLocal(g, r.o);
    const sd = Math.abs(loc.s - g.sMid);
    if (loc.t < -tol || loc.t > g.length + tol) continue;
    if (sd > g.thickness / 2 + tol) continue;
    const gt = g.arc ? arcTan(g.arc, loc.t) : g.u;
    if (Math.abs(cross(r.dir, gt)) < 0.1) continue;
    if (!best || sd < best.sd) best = { g, sd };
  }
  return best ? best.g : null;
}

/** Fim isolado que cai dentro de outra parede vira junção em T. */
function tryTee(out: Map<string, WallEnds>, r: EndRef, frames: WallFrame[], tol: number): void {
  const host = findTee(r, frames, tol);
  if (!host) return;
  const spec = buttAgainst(r, host) ?? toCenterline(r, host);
  if (spec) setEnd(out, r, both(spec));
}

export type JoinStatus =
  | { kind: 'free' }
  | { kind: 'disallowed' }
  /** Duas paredes no mesmo ponto: a configuração de junção se aplica. */
  | { kind: 'pair'; partners: Array<{ wallId: string; end: 'a' | 'b' }> }
  /** Três ou mais paredes no mesmo ponto. */
  | { kind: 'node'; partners: Array<{ wallId: string; end: 'a' | 'b' }> }
  /** Extremidade encostando no meio de outra parede (encosto fixo). */
  | { kind: 'tee'; hostId: string };

/** Situação de uma extremidade de parede, para a interface mostrar o que se pode configurar. */
export function joinStatus(frames: WallFrame[], wallId: string, which: 'a' | 'b', tol = DEFAULT_JOIN_TOL): JoinStatus {
  const f = frames.find((x) => x.wall.id === wallId);
  if (!f) return { kind: 'free' };
  if (which === 'a' ? f.wall.noJoinStart : f.wall.noJoinEnd) return { kind: 'disallowed' };
  const partners = endPartners(frames, wallId, which, tol).filter((p) => {
    const other = frames.find((x) => x.wall.id === p.wallId)!;
    return !(p.end === 'a' ? other.wall.noJoinStart : other.wall.noJoinEnd);
  });
  if (partners.length === 1) return { kind: 'pair', partners };
  if (partners.length > 1) return { kind: 'node', partners };
  const o = which === 'a' ? f.a : f.b;
  const tg = endTangent(f, which);
  const host = findTee({ f, which, o, dir: which === 'a' ? tg : { x: -tg.x, y: -tg.y } }, frames, tol);
  return host ? { kind: 'tee', hostId: host.wall.id } : { kind: 'free' };
}

/** Calcula como cada fim de parede é cortado, levando em conta as demais paredes do nível. */
export function computeEnds(frames: WallFrame[], tol = DEFAULT_JOIN_TOL): Map<string, WallEnds> {
  const out = new Map<string, WallEnds>();
  for (const f of frames) {
    out.set(f.wall.id, { a: flatEnd(0), b: flatEnd(f.length) });
  }
  const refs: EndRef[] = [];
  for (const f of frames) {
    if (!f.wall.noJoinStart) refs.push({ f, which: 'a', o: pointAt(f, 0, 0), dir: endTangent(f, 'a') });
    if (!f.wall.noJoinEnd) refs.push({ f, which: 'b', o: pointAt(f, f.length, 0), dir: ((u) => ({ x: -u.x, y: -u.y }))(endTangent(f, 'b')) });
  }
  const grouped = new Set<EndRef>();
  for (const g of groupEnds(refs, tol)) {
    if (g.length >= 2) {
      g.forEach((r) => grouped.add(r));
      resolveNode(out, g);
    }
  }
  for (const r of refs) if (!grouped.has(r)) tryTee(out, r, frames, tol);
  return out;
}
