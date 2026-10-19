import {
  closestOnSegment,
  dist,
  dot,
  intersectSegments,
  len,
  mid,
  norm,
  sub,
  v2,
  type Vec2,
} from '@hestia/geom';
import { openingsOfWall, wallsOnLevel, type Id, type Project } from '@hestia/model';
import type { Guide, Inference, SnapKind } from './types.ts';

export interface InferContext {
  project: Project;
  levelId: Id;
  /** Metros por pixel: define a tolerância visual (~10 px). */
  mpp: number;
  gridStep: number;
  /** Ponto anterior (para ortogonal, perpendicular e comprimento). */
  from?: Vec2;
  orthoLock?: boolean;
  /** Ignorar estes elementos (por exemplo, os que estão sendo movidos). */
  ignore?: Set<Id>;
  /** Desliga a atração para a grade (ex.: inserir aberturas). */
  noGrid?: boolean;
  /** Candidato exclusivo: só pontos sobre paredes. */
  onWallsOnly?: boolean;
}

const TOL_PX = 10;

interface Cand {
  point: Vec2;
  kind: SnapKind;
  score: number;
  guides?: Guide[];
  hostId?: Id;
}

const PRIORITY: Record<SnapKind, number> = {
  endpoint: 0,
  intersection: 1,
  midpoint: 2,
  perpendicular: 3,
  alignment: 4,
  nearest: 5,
  ortho: 6,
  grid: 7,
  none: 9,
};

/**
 * Motor de inferência único (docs/01 §8): função pura que devolve o melhor ponto e as guias.
 * Todas as ferramentas o consomem; o cursor "adivinha" o que o usuário quer.
 */
export function infer(cursor: Vec2, ctx: InferContext): Inference {
  const tol = TOL_PX * ctx.mpp;
  const walls = wallsOnLevel(ctx.project, ctx.levelId).filter((w) => !ctx.ignore?.has(w.id));
  const cands: Cand[] = [];
  const add = (c: Cand): void => {
    cands.push(c);
  };

  const ends: Vec2[] = [];
  for (const w of walls) {
    ends.push(w.a, w.b);
    for (const p of [w.a, w.b]) {
      const d = dist(cursor, p);
      if (d <= tol) add({ point: p, kind: 'endpoint', score: d });
    }
    const m = mid(w.a, w.b);
    const dm = dist(cursor, m);
    if (dm <= tol) add({ point: m, kind: 'midpoint', score: dm });
    const c = closestOnSegment(cursor, w.a, w.b);
    const dc = dist(cursor, c);
    if (dc <= tol) add({ point: c, kind: 'nearest', score: dc + tol * 0.5, hostId: w.id });
    if (ctx.from) {
      const ab = sub(w.b, w.a);
      const abLen = len(ab);
      const t = abLen > 1e-9 ? dot(sub(ctx.from, w.a), norm(ab)) : -1;
      if (t > 0 && t < abLen) {
        const foot = closestOnSegment(ctx.from, w.a, w.b);
        const dp = dist(cursor, foot);
        if (dp <= tol && dist(foot, ctx.from) > 1e-6) {
          add({ point: foot, kind: 'perpendicular', score: dp, guides: [{ from: ctx.from, to: foot, kind: 'perpendicular' }] });
        }
      }
    }
  }
  // Interseções de eixos.
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const p = intersectSegments(walls[i]!.a, walls[i]!.b, walls[j]!.a, walls[j]!.b);
      if (!p) continue;
      const d = dist(cursor, p);
      if (d <= tol) add({ point: p, kind: 'intersection', score: d });
    }
  }
  if (ctx.onWallsOnly) return pickBest(cands, cursor, [], undefined);

  // Alinhamento horizontal/vertical com extremidades e com o ponto anterior.
  const refs = ctx.from ? [...ends, ctx.from] : ends;
  let ax: Vec2 | null = null;
  let ay: Vec2 | null = null;
  for (const r of refs) {
    if (Math.abs(cursor.x - r.x) <= tol && (!ax || Math.abs(cursor.x - r.x) < Math.abs(cursor.x - ax.x))) ax = r;
    if (Math.abs(cursor.y - r.y) <= tol && (!ay || Math.abs(cursor.y - r.y) < Math.abs(cursor.y - ay.y))) ay = r;
  }
  if (ax || ay) {
    const p = v2(ax ? ax.x : cursor.x, ay ? ay.y : cursor.y);
    const guides: Guide[] = [];
    if (ax) guides.push({ from: ax, to: p, kind: 'alignment' });
    if (ay) guides.push({ from: ay, to: p, kind: 'alignment' });
    add({ point: p, kind: 'alignment', score: dist(cursor, p) + tol * 0.25, guides });
  }

  // Ortogonal a partir do ponto anterior: sempre ativo quando próximo, travado com Shift/opção.
  if (ctx.from) {
    const d = sub(cursor, ctx.from);
    const l = len(d);
    if (l > 1e-6) {
      const horiz = Math.abs(d.y) <= Math.abs(d.x);
      const snapped = horiz ? v2(cursor.x, ctx.from.y) : v2(ctx.from.x, cursor.y);
      const off = horiz ? Math.abs(d.y) : Math.abs(d.x);
      if (ctx.orthoLock || off <= tol * 0.7) {
        add({ point: snapped, kind: 'ortho', score: ctx.orthoLock ? 0 : off + tol * 0.4, guides: [{ from: ctx.from, to: snapped, kind: 'ortho' }] });
      }
    }
  }

  return pickBest(cands, cursor, [], ctx.noGrid ? undefined : ctx.gridStep);
}

function pickBest(cands: Cand[], cursor: Vec2, guides: Guide[], grid: number | undefined): Inference {
  let best: Cand | null = null;
  for (const c of cands) {
    if (!best) best = c;
    else if (PRIORITY[c.kind] < PRIORITY[best.kind] || (PRIORITY[c.kind] === PRIORITY[best.kind] && c.score < best.score)) best = c;
  }
  // Pontos de alta prioridade vencem; alinhamento só vence se nada de geometria real estiver perto.
  if (best) return { point: best.point, kind: best.kind, guides: best.guides ?? guides, hostId: best.hostId };
  if (grid && grid > 0) {
    return { point: v2(Math.round(cursor.x / grid) * grid, Math.round(cursor.y / grid) * grid), kind: 'grid', guides };
  }
  return { point: cursor, kind: 'none', guides };
}

/** Parede mais próxima do cursor dentro da tolerância (para hospedar aberturas). */
export function hostUnder(cursor: Vec2, p: Project, levelId: Id, mpp: number): { wallId: Id; offset: number; point: Vec2 } | null {
  let best: { wallId: Id; offset: number; point: Vec2; d: number } | null = null;
  for (const w of wallsOnLevel(p, levelId)) {
    const c = closestOnSegment(cursor, w.a, w.b);
    const d = dist(cursor, c);
    const half = 0.3 + 10 * mpp;
    if (d > half) continue;
    if (!best || d < best.d) best = { wallId: w.id, offset: dist(w.a, c), point: c, d };
  }
  return best ? { wallId: best.wallId, offset: best.offset, point: best.point } : null;
}

/** Aberturas já existentes numa parede, para evitar sobreposição ao inserir. */
export function occupiedRanges(p: Project, wallId: Id, ignoreId?: Id): Array<[number, number]> {
  return openingsOfWall(p, wallId)
    .filter((o) => o.id !== ignoreId)
    .map((o) => {
      const t = p.openingTypes[o.typeId];
      const h = (t?.width ?? 0.8) / 2;
      return [o.offset - h, o.offset + h] as [number, number];
    });
}
