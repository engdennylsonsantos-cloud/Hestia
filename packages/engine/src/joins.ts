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

/** Duas paredes se encontram em altura (faixas verticais se sobrepõem). Sem faixa conhecida, assume que sim. */
function zOverlap(a: WallFrame, b: WallFrame): boolean {
  if (!a.z || !b.z) return true;
  return a.z.z0 < b.z.top - 1e-6 && b.z.z0 < a.z.top - 1e-6;
}

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
      if (!zOverlap(refs[i]!.f, refs[j]!.f)) continue;
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
    if (f === me || !zOverlap(me, f)) continue;
    if (dist(f.a, o) <= tol) out.push({ wallId: f.wall.id, end: 'a' });
    if (dist(f.b, o) <= tol) out.push({ wallId: f.wall.id, end: 'b' });
  }
  return out;
}

/**
 * Canto com a extremidade de outra parede: a ponta cai sobre a tampa da outra (até a tolerância do plano da
 * extremidade, e até meia espessura para os lados, incluindo a face externa). Pega o caso de desenhar pela face: o eixo
 * fica a meia espessura do eixo vizinho, então a junção por eixo não encontra par, mas a geometria mostra um canto (J-01).
 * Ponta mais longe do plano da tampa não é canto: fica como T ou livre.
 */
function cornerHostOf(r: EndRef, refs: EndRef[], tol: number, taken: Set<EndRef>): EndRef | null {
  let best: { h: EndRef; d: number } | null = null;
  for (const h of refs) {
    if (h.f === r.f || taken.has(h) || !zOverlap(r.f, h.f)) continue;
    if (Math.abs(cross(r.dir, h.dir)) < COLLINEAR_SIN) continue;
    const loc = toLocal(h.f, r.o);
    const tEnd = h.which === 'a' ? 0 : h.f.length;
    if (Math.abs(loc.t - tEnd) > tol) continue;
    if (Math.abs(loc.s - h.f.sMid) > h.f.thickness / 2 + tol) continue;
    const d = dist(r.o, h.o);
    if (!best || d < best.d) best = { h, d };
  }
  return best ? best.h : null;
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
    if (g === r.f || !zOverlap(r.f, g)) continue;
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
  // Sem par pelo eixo: se a ponta cai na zona de extremidade de outra parede, é canto com ela (mesma regra do motor).
  const refs = refsOf(frames);
  const me = refs.find((r) => r.f === f && r.which === which);
  const corner = me ? cornerHostOf(me, refs, tol, new Set()) : null;
  if (corner) return { kind: 'pair', partners: [{ wallId: corner.f.wall.id, end: corner.which }] };
  const o = which === 'a' ? f.a : f.b;
  const tg = endTangent(f, which);
  const host = findTee({ f, which, o, dir: which === 'a' ? tg : { x: -tg.x, y: -tg.y } }, frames, tol);
  return host ? { kind: 'tee', hostId: host.wall.id } : { kind: 'free' };
}

/** Extremidades que podem se unir (as de `noJoin` ficam de fora), com o ponto e a direção de cada uma. */
function refsOf(frames: WallFrame[]): EndRef[] {
  const refs: EndRef[] = [];
  for (const f of frames) {
    if (!f.wall.noJoinStart) refs.push({ f, which: 'a', o: pointAt(f, 0, 0), dir: endTangent(f, 'a') });
    if (!f.wall.noJoinEnd) refs.push({ f, which: 'b', o: pointAt(f, f.length, 0), dir: ((u) => ({ x: -u.x, y: -u.y }))(endTangent(f, 'b')) });
  }
  return refs;
}

/** Calcula como cada fim de parede é cortado, levando em conta as demais paredes do nível. */
export function computeEnds(frames: WallFrame[], tol = DEFAULT_JOIN_TOL): Map<string, WallEnds> {
  const out = new Map<string, WallEnds>();
  for (const f of frames) {
    out.set(f.wall.id, { a: flatEnd(0), b: flatEnd(f.length) });
  }
  const refs = refsOf(frames);
  const grouped = new Set<EndRef>();
  for (const g of groupEnds(refs, tol)) {
    if (g.length >= 2) {
      g.forEach((r) => grouped.add(r));
      resolveNode(out, g);
    }
  }
  // Canto por geometria: ponta livre na zona de extremidade de outra parede livre forma canto com ela, não T.
  for (const r of refs) {
    if (grouped.has(r)) continue;
    const h = cornerHostOf(r, refs, tol, grouped);
    if (!h) continue;
    grouped.add(r);
    grouped.add(h);
    resolveNode(out, [r, h]);
  }
  for (const r of refs) if (!grouped.has(r)) tryTee(out, r, frames, tol);
  return out;
}
