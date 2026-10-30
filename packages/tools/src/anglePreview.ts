import { add, cross, dist, dot, len, mul, norm, sub, v2, type Vec2 } from '@hestia/geom';
import {
  areaPlanOf,
  formatQuantity,
  isCeiling,
  isFloor,
  isRoof,
  isSlab,
  levelRoomSeparators,
  planAnnotationsOf,
  projectGrids,
  unitsOf,
  wallsOnLevel,
  type Id,
  type Project,
  type ResolvedUnits,
} from '@hestia/model';
import { gridPath } from './gridGeom.ts';
import type { PreviewItem } from './types.ts';

export interface DraftLine {
  a: Vec2;
  b: Vec2;
}

export interface WallBand {
  a: Vec2;
  b: Vec2;
  thickness: number;
}

const distToSegment = (q: Vec2, a: Vec2, b: Vec2): number => {
  const d = sub(b, a);
  const l2 = dot(d, d);
  if (l2 < 1e-12) return dist(q, a);
  const t = Math.max(0, Math.min(1, dot(sub(q, a), d) / l2));
  return dist(q, add(a, mul(d, t)));
};

const segmentNear = (at: Vec2, seg: DraftLine, tol: number): boolean => distToSegment(at, seg.a, seg.b) <= tol;

const pushSegs = (out: DraftLine[], pts: Vec2[]): void => {
  for (let i = 1; i < pts.length; i++) if (dist(pts[i - 1]!, pts[i]!) > 1e-9) out.push({ a: pts[i - 1]!, b: pts[i]! });
};

/**
 * Linha existente conectada ao ponto: parede (eixo), grade, detalhe, separador e arestas de piso/laje/telhado/forro.
 * É a base do ângulo dinâmico de qualquer ferramenta de desenho de linha.
 */
export function connectedLineAt(p: Project, levelId: Id, at: Vec2, mpp: number, planId?: Id | null): DraftLine | null {
  const tol = Math.max(0.02, 12 * mpp);
  const candidates: DraftLine[] = [];
  for (const w of wallsOnLevel(p, levelId)) candidates.push({ a: w.a, b: w.b });
  for (const g of projectGrids(p)) pushSegs(candidates, gridPath(g));
  const level = p.levels.find((l) => l.id === levelId);
  const plan = planId ? areaPlanOf(p, planId) : undefined;
  const annotations = plan ? planAnnotationsOf(plan) : null;
  for (const l of annotations?.detailLines ?? level?.detailLines ?? []) candidates.push({ a: l.a, b: l.b });
  for (const r of levelRoomSeparators(p, levelId)) candidates.push({ a: r.a, b: r.b });
  for (const e of Object.values(p.elements)) {
    if (!(isFloor(e) || isSlab(e) || isRoof(e) || isCeiling(e))) continue;
    if (e.levelId !== levelId) continue;
    const b = 'boundary' in e ? e.boundary : [];
    for (let i = 0; i < b.length; i++) candidates.push({ a: b[i]!, b: b[(i + 1) % b.length]! });
    const holes = 'holes' in e ? e.holes : [];
    for (const h of holes) for (let i = 0; i < h.length; i++) candidates.push({ a: h[i]!, b: h[(i + 1) % h.length]! });
  }
  let best: { line: DraftLine; d: number } | null = null;
  for (const line of candidates) {
    if (!segmentNear(at, line, tol)) continue;
    const d = distToSegment(at, line.a, line.b);
    if (!best || d < best.d) best = { line, d };
  }
  return best?.line ?? null;
}

/** Direção da linha para longe do ponto de encontro. */
const away = (line: DraftLine, joint: Vec2): Vec2 => {
  const other = dist(line.a, joint) >= dist(line.b, joint) ? line.a : line.b;
  const d = sub(other, joint);
  return len(d) > 1e-9 ? norm(d) : norm(sub(line.b, line.a));
};

/** Tenta posições ao longo do arco para o texto não cair em cima da ponta em criação. */
function labelAt(center: Vec2, angle: number, sweep: number, radius: number, avoid: Vec2[], mpp: number, band?: WallBand): Vec2 {
  const clearance = Math.max(0.05, 26 * mpp);
  const free = (q: Vec2): boolean => avoid.every((p) => dist(q, p) > clearance) && (!band || distToSegment(q, band.a, band.b) > band.thickness / 2 + clearance);
  for (const f of [0, 0.18, -0.18, 0.34, -0.34]) {
    const a = angle + sweep * f;
    const at = add(center, v2(Math.cos(a) * (radius + Math.max(0.12, radius * 0.12)), Math.sin(a) * (radius + Math.max(0.12, radius * 0.12))));
    if (free(at)) return at;
  }
  const a = angle + sweep * 0.5;
  return add(center, v2(Math.cos(a) * (radius * 1.35), Math.sin(a) * (radius * 1.35)));
}

/**
 * Arco e valor do ângulo menor entre uma linha de referência e o trecho em criação. A referência pode ser o segmento
 * anterior da cadeia (`previous`) ou uma linha existente conectada ao ponto inicial. O texto procura uma posição livre
 * ao longo do arco para não colidir com a ponta da parede/linha em criação.
 */
export function draftAngleItems(opts: {
  previous?: DraftLine | null;
  joint: Vec2;
  current: Vec2;
  mpp: number;
  units: ResolvedUnits;
  avoid?: Vec2[];
  /** Faixa da parede que está sendo criada; o texto não pode cair dentro dela. */
  band?: WallBand;
}): PreviewItem[] {
  const { joint, current, mpp, units } = opts;
  if (!opts.previous || dist(joint, current) < 0.01) return [];
  const dirA = away(opts.previous, joint);
  const dirB = norm(sub(current, joint));
  if (len(dirB) < 1e-9) return [];
  const value = Math.acos(Math.max(-1, Math.min(1, dot(dirA, dirB))));
  if (value < 0.01 || value > Math.PI - 0.01) return [];
  const radius = Math.max(45 * mpp, Math.min(120 * mpp, dist(joint, current) * 0.75));
  const sign = cross(dirA, dirB) >= 0 ? 1 : -1;
  const start = Math.atan2(dirA.y, dirA.x);
  const out: PreviewItem[] = [];
  let prev = add(joint, mul(dirA, radius));
  const steps = 18;
  for (let i = 1; i <= steps; i++) {
    const a = start + (sign * value * i) / steps;
    const q = add(joint, v2(Math.cos(a) * radius, Math.sin(a) * radius));
    out.push({ kind: 'line', a: prev, b: q });
    prev = q;
  }
  const mid = start + (sign * value) / 2;
  const textAt = labelAt(joint, mid, sign * value, radius, [...(opts.avoid ?? []), current, joint], mpp, opts.band);
  out.push({ kind: 'label', at: textAt, text: formatQuantity(units, 'angle', value) });
  return out;
}

/** Ângulo entre dois segmentos, usando o ponto final do anterior como encontro. */
export function draftAngleItemsForConnection(
  p: Project,
  levelId: Id,
  planId: Id | null | undefined,
  joint: Vec2,
  current: Vec2,
  mpp: number,
  units: ResolvedUnits,
  band?: WallBand,
): PreviewItem[] {
  const previous = connectedLineAt(p, levelId, joint, mpp, planId);
  return draftAngleItems({ previous, joint, current, mpp, units, avoid: [current], ...(band ? { band } : {}) });
}

/** Atalho para ferramentas que já têm um segmento anterior no próprio rascunho. */
export const draftAngleItemsForPrevious = (previous: DraftLine | null | undefined, joint: Vec2, current: Vec2, mpp: number, units: ResolvedUnits): PreviewItem[] =>
  draftAngleItems({ previous, joint, current, mpp, units, avoid: [current] });

/** Usa o último segmento do esboço quando ele termina no ponto; senão procura uma linha existente conectada. */
export function draftAngleItemsForDraft(
  p: Project,
  levelId: Id,
  planId: Id | null | undefined,
  segs: ReadonlyArray<DraftLine>,
  joint: Vec2,
  current: Vec2,
  mpp: number,
  units: ResolvedUnits,
): PreviewItem[] {
  const last = segs[segs.length - 1];
  const previous = last && dist(last.b, joint) < 1e-4
    ? { a: last.a, b: last.b }
    : connectedLineAt(p, levelId, joint, mpp, planId);
  return draftAngleItems({ previous, joint, current, mpp, units, avoid: [current] });
}

/** Unidades do projeto, importadas aqui para as ferramentas não repetirem o cálculo. */
export const unitsForDraft = (p: Project): ResolvedUnits => unitsOf(p);
