import { dot, mul, type Vec2 } from '@hestia/geom';
import { frameOfWall, pointAt, toLocal, wallPlaneAt, wallPlanes, type WallFrame } from '@hestia/engine';
import {
  WALL_DIM_REFS,
  isWall,
  isWallDimRef,
  type Id,
  type WallDimRef,
} from '@hestia/model';
import { resizeWallCommands } from '../../lengthEdit.ts';
import { hostedConflicts } from '../validate.ts';
import type { DimContext, DimEditResult, DimEnd, DimProvider, TempDim } from '../types.ts';

/** Parede a cotar: comprimento e distância às paralelas vizinhas. */
export interface WallDimSubject {
  wallId: Id;
}

const PROVIDER_ID = 'wall';
const DIM_OFFSET = 0.25;
const EPS = 1e-6;
const PARALLEL_TOL = 0.999;

/** Chave global (troca rápida): vale para todas as pontas de parede. */
export const WALL_REF_KEY = `${PROVIDER_ID}:wall`;

const slotKey = (slot: string): string => `${PROVIDER_ID}:${slot}`;

function wallRefFor(ctx: DimContext, slot: string): WallDimRef {
  const v = ctx.overrides[slotKey(slot)] ?? ctx.overrides[WALL_REF_KEY];
  return isWallDimRef(v) ? v : ctx.settings.wallRef;
}

const lengthEnd = (at: Vec2, slot: string): DimEnd => ({
  at,
  slot,
  kind: 'wall',
  current: 'axis',
  options: WALL_DIM_REFS,
});

/** Distância entre duas paredes retas paralelas, nos planos da referência escolhida (em `s` da hospedeira). */
interface ParallelGap {
  side: 1 | -1;
  /** `s`, na hospedeira, do plano da vizinha. */
  otherS: number;
  /** Comprimento do vão medido. */
  distance: number;
  /** `t` na hospedeira em que a cota é desenhada (meio da sobreposição, ou o meio da hospedeira). */
  t: number;
}

function nearestParallel(ctx: DimContext, host: WallFrame, ref: WallDimRef): ParallelGap[] {
  const hostPlane = wallPlaneAt(wallPlanes(host), ref, 1);
  let left: ParallelGap | null = null;
  let right: ParallelGap | null = null;
  for (const e of Object.values(ctx.project.elements)) {
    if (!isWall(e) || e.id === host.wall.id || e.levelId !== ctx.levelId) continue;
    const other = frameOfWall(ctx.project, e.id);
    if (!other || host.arc || other.arc) continue;
    const cos = Math.abs(dot(host.u, other.u));
    if (cos < PARALLEL_TOL) continue;
    // A face da vizinha voltada para a hospedeira.
    const towardHost = toLocal(other, pointAt(host, host.length / 2, host.sMid)).s >= 0 ? 1 : -1;
    const otherPlane = wallPlaneAt(wallPlanes(other), ref, towardHost);
    const probe = pointAt(other, other.length / 2, otherPlane);
    const loc = toLocal(host, probe);
    const distance = Math.abs(loc.s - hostPlane);
    if (distance < EPS) continue;
    const side: 1 | -1 = loc.s > hostPlane ? 1 : -1;
    const t = Math.max(0, Math.min(host.length, loc.t));
    const gap: ParallelGap = { side, otherS: loc.s, distance, t };
    if (side > 0) {
      if (!right || distance < right.distance) right = gap;
    } else if (!left || distance < left.distance) left = gap;
  }
  return [left, right].filter((g): g is ParallelGap => g !== null);
}

/** Cota do comprimento da parede (edita a extremidade `b`, mantendo `a`, e valida as esquadrias). */
function lengthDim(ctx: DimContext, frame: WallFrame): TempDim {
  const a = pointAt(frame, 0, frame.sMid);
  const b = pointAt(frame, frame.length, frame.sMid);
  const edit = (value: number): DimEditResult => {
    if (!(value > 0)) return { error: 'Digite um comprimento maior que zero.' };
    const why = hostedConflicts(ctx.project, frame.wall.id, { length: value });
    if (why) return { error: why };
    const r = resizeWallCommands(ctx.project, ctx.levelId, frame.wall.id, value);
    return 'error' in r ? r : { commands: r.commands };
  };
  return {
    key: `${PROVIDER_ID}:${frame.wall.id}:length`,
    a,
    b,
    offset: DIM_OFFSET,
    value: frame.length,
    ends: [lengthEnd(a, 'lengthA'), lengthEnd(b, 'lengthB')],
    edit,
  };
}

/** Cota perpendicular até a paralela vizinha: editar translada a parede selecionada (hospedados acompanham). */
function gapDim(frame: WallFrame, gap: ParallelGap, ref: WallDimRef): TempDim {
  const hostPlane = wallPlaneAt(wallPlanes(frame), ref, gap.side);
  const a = pointAt(frame, gap.t, hostPlane);
  const b = pointAt(frame, gap.t, gap.otherS);
  const edit = (value: number): DimEditResult => {
    if (!(value > 0)) return { error: 'Digite uma distância maior que zero.' };
    const delta = value - gap.distance;
    const d = mul(frame.n, gap.side * delta);
    return { commands: [{ type: 'transform', ids: [frame.wall.id], transform: { kind: 'translate', d } }] };
  };
  return {
    key: `${PROVIDER_ID}:${frame.wall.id}:${gap.side > 0 ? 'right' : 'left'}`,
    a,
    b,
    offset: DIM_OFFSET * (gap.side > 0 ? 1 : -1),
    value: gap.distance,
    ends: [
      { at: a, slot: gap.side > 0 ? 'gapRightA' : 'gapLeftA', kind: 'wall', current: ref, options: WALL_DIM_REFS },
      { at: b, slot: gap.side > 0 ? 'gapRightB' : 'gapLeftB', kind: 'wall', current: ref, options: WALL_DIM_REFS },
    ],
    edit,
  };
}

/** Comprimento e distâncias perpendiculares às paralelas vizinhas de uma parede. */
export const wallDimProvider: DimProvider<WallDimSubject> = {
  id: PROVIDER_ID,
  compute(ctx, subject) {
    const frame = frameOfWall(ctx.project, subject.wallId);
    if (!frame) return [];
    const ref = wallRefFor(ctx, 'wall');
    return [lengthDim(ctx, frame), ...nearestParallel(ctx, frame, ref).map((g) => gapDim(frame, g, ref))];
  },
  selectionSubject(project, id) {
    const w = project.elements[id];
    return w && isWall(w) ? { wallId: w.id } : null;
  },
};

/** Cota de leitura do segmento em desenho (comprimento da parede antes de criar). */
export function segmentLengthDim(a: Vec2, b: Vec2): TempDim {
  const value = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    key: `${PROVIDER_ID}:draft:length`,
    a,
    b,
    offset: DIM_OFFSET,
    value,
    ends: [lengthEnd(a, 'draftA'), lengthEnd(b, 'draftB')],
  };
}
