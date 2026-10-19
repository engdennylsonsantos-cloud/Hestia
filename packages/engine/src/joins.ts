import { arcTangentAt as arcTan, cross, dist, dot, intersectLines, mul, add, perp, type Vec2 } from '@hestia/geom';
import { coreSpan } from '@hestia/model';
import { endTangent, pointAt, toLocal, type WallFrame } from './frame.ts';

/** Tolerância padrão de junção (m); o projeto pode sobrescrever (Project.settings.joinTolerance). */
export const DEFAULT_JOIN_TOL = 0.02;
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
  /** Espessura dos acabamentos entre a face externa do canto e o núcleo (pareia núcleo com núcleo). */
  outerToCore: number;
}

export type EndSpec =
  /** Corte reto na posição t do eixo. `clip` recorta a camada num setor (nós de 3+ paredes). */
  | { kind: 'flat'; t: number; clip?: Vec2[] }
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
  // Paredes de tipos diferentes: as camadas se pareiam a partir do núcleo (docs/05 §1: a estrutura
  // se encontra com a estrutura; os acabamentos contornam o canto, cada um com a sua espessura).
  const dd = Math.max(0, Math.min(d - self.outerToCore + other.outerToCore, other.sHi - other.sLo));
  const sA = sOfDepth(self, d);
  const sB = sOfDepth(other, dd);
  const r = intersectLines(add(self.o, mul(self.n, sA)), self.u, add(other.o, mul(other.n, sB)), other.u);
  return r ? r.point : null;
}

const sideOf = (r: EndRef, towards: Vec2): MiterSide => {
  // Se o vizinho está à esquerda desta parede, a face externa do canto é a da direita (s menor).
  const sigma: 1 | -1 = dot(r.f.n, towards) > 0 ? -1 : 1;
  const core = coreSpan(r.f.type);
  // A face externa do tipo fica em sHi quando sign>0. Se a face externa do canto coincide com ela, o núcleo
  // começa a `core.from` dela; senão, a face do canto é a interna do tipo e o núcleo termina a `T - core.to`.
  const cornerIsExterior = sigma > 0 === r.f.sign > 0;
  const outerToCore = Math.max(0, cornerIsExterior ? core.from : r.f.thickness - core.to);
  const u = r.which === 'a' ? r.dir : { x: -r.dir.x, y: -r.dir.y }; // tangente a→b NA extremidade
  return { o: r.o, u, n: perp(u), sHi: r.f.sHi, sLo: r.f.sLo, sigma, outerToCore };
};

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

/** Ponto em que o eixo do ramal (tangente na extremidade) encontra a linha de centro da parede atravessada. */
function centerlineHit(branch: EndRef, through: WallFrame): Vec2 | null {
  const o = branch.o;
  const d = branch.dir;
  if (!through.arc) {
    const den = dot(d, through.n);
    if (Math.abs(den) < 0.05) return null;
    const lam = (through.sMid - dot(sub2(o, through.a), through.n)) / den;
    return { x: o.x + d.x * lam, y: o.y + d.y * lam };
  }
  // Círculo da linha de centro: |o + λd − C|² = ρ².
  const rho = through.arc.radius + through.arc.k * through.sMid;
  const w = sub2(o, through.arc.center);
  const bq = dot(w, d);
  const disc = bq * bq - (dot(w, w) - rho * rho);
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const l1 = -bq - sq;
  const l2 = -bq + sq;
  const lam = Math.abs(l1) <= Math.abs(l2) ? l1 : l2;
  return { x: o.x + d.x * lam, y: o.y + d.y * lam };
}

/** Ramal que termina no meio de outra parede: o fim vai até a linha de centro da parede atravessada. */
function toCenterline(branch: EndRef, through: WallFrame): EndSpec | null {
  const hit = centerlineHit(branch, through);
  if (!hit) return null;
  const t = toLocal(branch.f, hit).t;
  if (branch.which === 'a') return { kind: 'flat', t: Math.min(t, branch.f.length - 0.01) };
  return { kind: 'flat', t: Math.max(t, 0.01) };
}

const sub2 = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x - q.x, y: p.y - q.y });

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

/** Extensão (corte reto) necessária para cobrir o canto externo com `other`. */
function outerExtension(a: EndRef, b: EndRef): number {
  const sa = sideOf(a, b.dir);
  const sb = sideOf(b, a.dir);
  const p = miterPoint(sa, sb, 0);
  if (!p) return 0;
  return Math.max(0, -dot(sub2(p, a.o), a.dir));
}

const capExt = (ext: number, ...f: WallFrame[]): number => Math.min(ext, MITER_LIMIT * Math.max(0.05, ...f.map((x) => x.thickness)));

/** Junção de duas paredes segundo a configuração da mais antiga (docs/05 §9). */
function joinPair(out: Map<string, WallEnds>, a: EndRef, b: EndRef): void {
  const [first, second] = a.f.wall.order <= b.f.wall.order ? [a, b] : [b, a];
  const cfg = first.which === 'a' ? first.f.wall.joinStart : first.f.wall.joinEnd;
  const lead = cfg.flip ? second : first;
  const follower = cfg.flip ? first : second;
  switch (cfg.kind) {
    case 'miter':
      miterPair(out, a, b);
      return;
    case 'square':
      // Esquadro: cada extremidade é cortada a 90° e prolongada até cobrir o canto externo.
      setEnd(out, a, flatAt(a, capExt(outerExtension(a, b), a.f, b.f)));
      setEnd(out, b, flatAt(b, capExt(outerExtension(b, a), a.f, b.f)));
      return;
    case 'butt': {
      // Encosto: a parede dominante atravessa até o canto externo; a outra para no núcleo dela.
      setEnd(out, lead, flatAt(lead, capExt(outerExtension(lead, follower), lead.f, follower.f)));
      const spec = toCenterline(follower, lead.f);
      if (spec) setEnd(out, follower, spec);
      return;
    }
  }
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

const TWO_PI = Math.PI * 2;
const SECTOR_OVERLAP = 2e-5;

/** Largura da banda de uma extremidade medida à esquerda e à direita do sentido "saindo do nó". */
function sideExtents(r: EndRef): { dl: number; dr: number; nl: Vec2 } {
  const nl = perp(r.dir);
  return r.which === 'a' ? { dl: r.f.sHi, dr: -r.f.sLo, nl } : { dl: -r.f.sLo, dr: r.f.sHi, nl };
}

/**
 * Nó de 3+ paredes sem par colinear: cada parede ocupa o setor limitado pelas semirretas que saem do nó
 * e passam pelos cantos onde as faces vizinhas se cruzam. Cada camada é recortada nesse setor.
 */
function starNode(out: Map<string, WallEnds>, g: EndRef[]): void {
  const refs = [...g].sort((x, y) => Math.atan2(x.dir.y, x.dir.x) - Math.atan2(y.dir.y, y.dir.x));
  const n = refs.length;
  const center = refs[0]!.o;
  const corners: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = refs[i]!;
    const b = refs[(i + 1) % n]!;
    const ea = sideExtents(a);
    const eb = sideExtents(b);
    const pa = add(a.o, mul(ea.nl, ea.dl));
    const pb = add(b.o, mul(eb.nl, -eb.dr));
    const hit = intersectLines(pa, a.dir, pb, b.dir);
    if (!hit) return; // faces paralelas: deixa os cortes retos
    corners.push(hit.point);
  }
  const ext = Math.max(...corners.map((c) => dist(c, center))) * 1.5 + 0.5;
  const far = ext + Math.max(...refs.map((r) => r.f.length)) + 1;
  refs.forEach((r, i) => {
    const prev = corners[(i + n - 1) % n]!;
    const next = corners[i]!;
    // Os setores vizinhos se sobrepõem por δ rad: o pintor recorta a sobra e deixa as bordas exatamente
    // coincidentes (sem frestas numéricas entre as paredes do nó).
    const a0 = Math.atan2(prev.y - center.y, prev.x - center.x) - SECTOR_OVERLAP;
    let sweep = Math.atan2(next.y - center.y, next.x - center.x) - a0 + SECTOR_OVERLAP;
    while (sweep <= 0) sweep += TWO_PI;
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 4)));
    const clip: Vec2[] = [center];
    for (let k = 0; k <= steps; k++) {
      const ang = a0 + (sweep * k) / steps;
      clip.push({ x: center.x + Math.cos(ang) * far, y: center.y + Math.sin(ang) * far });
    }
    const t = r.which === 'a' ? -ext : r.f.length + ext;
    setEnd(out, r, { kind: 'flat', t, clip });
  });
}

function resolveNode(out: Map<string, WallEnds>, g: EndRef[]): void {
  if (g.length === 2) {
    const [a, b] = g as [EndRef, EndRef];
    if (Math.abs(cross(a.dir, b.dir)) < COLLINEAR_SIN) return; // continuação ou sobreposição: corte reto
    joinPair(out, a, b);
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
  starNode(out, g);
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
  const spec = toCenterline(r, host);
  if (spec) setEnd(out, r, spec);
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
    out.set(f.wall.id, { a: { kind: 'flat', t: 0 }, b: { kind: 'flat', t: f.length } });
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
