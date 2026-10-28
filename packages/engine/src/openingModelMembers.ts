import type { ResolvedCell, ResolvedLayout, ResolvedMember } from '@hestia/model';
import { GAP, OVERLAP, addPart, box, type Ctx } from './openingModelContext.ts';
import type { PartProfile } from './openingModelTypes.ts';

/*
 * Membros do quadro único da composição (spec F1 §3). Cada membro vem de `resolveLayout` (extensão em t/z, sem
 * sobreposição: juntas de topo) e ocupa a faixa `s` do batente do conjunto (`Cd` ± `D/2`). A seção é orientada para a
 * célula vizinha de cada lado: folha = rebaixo do batedor (`OVERLAP`, profundidade folha + folga) na face da folha;
 * vidro/painel = fenda do vidro (espessura do vidro, profundidade do rebaixo do perfil).
 */

const EPS = 1e-6;
export type Edge = 'left' | 'right' | 'bottom' | 'top';

/** O que há de um lado de um membro: há folha? espessura do maior vidro/painel (0 = nenhum). */
export interface SideFlags {
  leaf: boolean;
  glassT: number;
}

const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => Math.min(a1, b1) - Math.max(a0, b0) > EPS;
const vertical = (m: ResolvedMember): boolean => m.role === 'jamb' || m.role === 'mullion';

/** Células encostadas no lado `after` (maior t ou z) ou `before` do membro. */
function cellsAt(l: ResolvedLayout, m: ResolvedMember, after: boolean): ResolvedCell[] {
  return l.cells.filter((x) => {
    const u = x.luz;
    if (vertical(m)) return overlaps(u.z0, u.z1, m.rect.z0, m.rect.z1) && Math.abs(after ? u.t0 - m.rect.t1 : u.t1 - m.rect.t0) < EPS;
    return overlaps(u.t0, u.t1, m.rect.t0, m.rect.t1) && Math.abs(after ? u.z0 - m.rect.z1 : u.z1 - m.rect.z0) < EPS;
  });
}

const thicknessOf = (x: ResolvedCell, fallback: number): number =>
  x.content.kind === 'glass' ? x.content.glass.thickness : x.content.kind === 'panel' ? x.content.thickness : fallback;

/** Marcas de um lado do membro, olhando TODAS as células que o tocam (um membro pode tocar várias). */
export function sideFlags(l: ResolvedLayout, m: ResolvedMember, after: boolean, fallbackT: number): SideFlags {
  const hit = cellsAt(l, m, after);
  const solid = hit.filter((x) => x.content.kind === 'glass' || x.content.kind === 'panel');
  return {
    leaf: hit.some((x) => x.content.kind === 'leaf'),
    glassT: solid.length ? Math.max(...solid.map((x) => thicknessOf(x, fallbackT))) : 0,
  };
}

/** Membros que encostam na borda `edge` da luz da célula (para a extensão do vidro no rebaixo). */
export function edgeMembers(l: ResolvedLayout, cell: ResolvedCell, edge: Edge): ResolvedMember[] {
  const u = cell.luz;
  return l.members.filter((m) => {
    const r = m.rect;
    if (edge === 'left') return vertical(m) && overlaps(u.z0, u.z1, r.z0, r.z1) && Math.abs(r.t1 - u.t0) < EPS;
    if (edge === 'right') return vertical(m) && overlaps(u.z0, u.z1, r.z0, r.z1) && Math.abs(r.t0 - u.t1) < EPS;
    if (edge === 'bottom') return !vertical(m) && overlaps(u.t0, u.t1, r.t0, r.t1) && Math.abs(r.z1 - u.z0) < EPS;
    return !vertical(m) && overlaps(u.t0, u.t1, r.t0, r.t1) && Math.abs(r.z0 - u.z1) < EPS;
  });
}

/** Rebaixo na borda do membro: de `a` a `b` (em s), entrando `depth` no membro. */
interface Pocket {
  a: number;
  b: number;
  depth: number;
}

/** Rebaixos de um lado: batedor da folha (face da folha) e/ou fenda do vidro (centrada em `Cd`). */
function pocketsOf(c: Ctx, m: ResolvedMember, f: SideFlags): Pocket[] {
  const out: Pocket[] = [];
  if (f.leaf) {
    const lside = c.leafSide === 'opposite' ? -c.side : c.side;
    const a = c.Cd + lside * (c.D / 2 - (c.L + GAP));
    const b = c.Cd + lside * (c.D / 2);
    out.push({ a: Math.min(a, b), b: Math.max(a, b), depth: OVERLAP });
  }
  const r = m.profile.glassRebate;
  if (f.glassT > 0 && r && r.depth > 0) out.push({ a: c.Cd - f.glassT / 2, b: c.Cd + f.glassT / 2, depth: r.depth });
  return out;
}

/** Degraus da borda: (s, profundidade) ao longo de [lo, hi], pegando o maior rebaixo que cobre cada trecho. */
function edgeSteps(pockets: Pocket[], lo: number, hi: number): Array<[number, number]> {
  const cuts = [...new Set([lo, hi, ...pockets.flatMap((p) => [p.a, p.b]).filter((x) => x > lo + EPS && x < hi - EPS)])].sort((x, y) => x - y);
  const segs: Array<{ from: number; to: number; d: number }> = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const mid = (cuts[i]! + cuts[i + 1]!) / 2;
    const d = Math.max(0, ...pockets.filter((p) => p.a < mid && mid < p.b).map((p) => p.depth));
    const last = segs[segs.length - 1];
    if (last && Math.abs(last.d - d) < EPS) last.to = cuts[i + 1]!;
    else segs.push({ from: cuts[i]!, to: cuts[i + 1]!, d });
  }
  return segs.flatMap((g) => [[g.from, g.d], [g.to, g.d]] as Array<[number, number]>);
}

const area = (pts: Array<[number, number]>): number =>
  pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * p[1], 0) / 2;

/**
 * Seção do membro. `lo`/`hi` são as bordas (t ou z) e `pl`/`ph` os rebaixos de cada uma; o plano é 'ts' (ombreira, montante) ou
 * 'sz' (travessa, peitoril). Sem rebaixo nenhum devolve undefined (a peça é a própria caixa).
 */
function sectionOf(plane: 'ts' | 'sz', lo: number, hi: number, pl: Pocket[], ph: Pocket[], s0: number, s1: number): PartProfile | undefined {
  if (!pl.length && !ph.length) return undefined;
  const low = edgeSteps(pl, s0, s1).map(([s, d]): [number, number] => [lo + d, s]);
  const high = edgeSteps(ph, s0, s1).map(([s, d]): [number, number] => [hi - d, s]).reverse();
  const raw = [...low, ...high];
  const pts = raw.filter((p, i) => {
    const q = raw[(i + 1) % raw.length]!;
    return Math.abs(p[0] - q[0]) > 1e-9 || Math.abs(p[1] - q[1]) > 1e-9;
  });
  const oriented = plane === 'ts' ? pts : pts.map(([pos, s]): [number, number] => [s, pos]);
  return { plane, pts: area(oriented) < 0 ? [...oriented].reverse() : oriented };
}

/** Peça de um membro, na faixa `s` do batente do conjunto, com a seção voltada às células vizinhas. */
function addMember(c: Ctx, l: ResolvedLayout, m: ResolvedMember, id: string, role: 'jamb' | 'head' | 'sillFrame' | 'mullion' | 'transom'): void {
  const r = m.rect;
  const s0 = c.Cd - c.D / 2;
  const s1 = c.Cd + c.D / 2;
  const b = box(r.t0, r.t1, s0, s1, r.z0, r.z1);
  const rebate = c.frameStyle === 'rebate' || c.frameStyle === 'aduela';
  let profile: PartProfile | undefined;
  if (rebate) {
    const pb = pocketsOf(c, m, sideFlags(l, m, false, c.G));
    const pa = pocketsOf(c, m, sideFlags(l, m, true, c.G));
    profile = vertical(m) ? sectionOf('ts', r.t0, r.t1, pb, pa, s0, s1) : sectionOf('sz', r.z0, r.z1, pb, pa, s0, s1);
  }
  addPart(c, id, role, 'frame', b, profile ? { profile } : {});
}

/**
 * Peças dos membros do quadro (spec §3, §3.4 e contrato de nomes): `jamb-left`, `jamb-right`, `head`, `sill-frame`
 * (janela) ou `threshold` (porta), `mullion-<k>` (t crescente, depois z) e `transom-<k>` (z crescente). Estilo `block`: nenhum.
 */
export function buildMembers(c: Ctx, l: ResolvedLayout): void {
  if (c.frameStyle === 'block') return;
  const by = (role: ResolvedMember['role']) => l.members.filter((m) => m.role === role);
  for (const m of by('jamb')) addMember(c, l, m, m.id, 'jamb');
  for (const m of by('head')) addMember(c, l, m, 'head', 'head');
  for (const m of by('sill')) addMember(c, l, m, 'sill-frame', 'sillFrame');
  for (const m of by('threshold')) {
    addPart(c, 'threshold', 'threshold', 'frame', box(m.rect.t0, m.rect.t1, c.Cd - c.D / 2, c.Cd + c.D / 2, m.rect.z0, m.rect.z1));
  }
  by('mullion')
    .sort((a, b) => a.rect.t0 - b.rect.t0 || a.rect.z0 - b.rect.z0)
    .forEach((m, k) => addMember(c, l, m, `mullion-${k}`, 'mullion'));
  by('transom')
    .sort((a, b) => a.rect.z0 - b.rect.z0 || a.rect.t0 - b.rect.t0)
    .forEach((m, k) => addMember(c, l, m, `transom-${k}`, 'transom'));
}
