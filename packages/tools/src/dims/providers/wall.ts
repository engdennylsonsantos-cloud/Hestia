import { dot, mul, type Vec2 } from '@hestia/geom';
import { frameOfWall, pointAt, toLocal, wallPlaneAt, wallPlanes, type WallFrame } from '@hestia/engine';
import {
  WALL_DIM_REFS,
  isWall,
  isWallDimRef,
  type Id,
  type WallDimRef,
} from '@hestia/model';
import { axisGaps, type AxisGap } from './wallAxisGaps.ts';
import type { DimContext, DimEditResult, DimEnd, DimProvider, TempDim } from '../types.ts';

/** Parede a cotar: vão até a perpendicular mais próxima (ou, sem ela, até a paralela mais próxima). */
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
  const planes = wallPlanes(host);
  let nearest: ParallelGap | null = null;
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
    // O lado define qual face da hospedeira está voltada para a vizinha (eixo e eixo do núcleo não dependem dele).
    const side: 1 | -1 = loc.s >= host.sMid ? 1 : -1;
    const hostPlane = wallPlaneAt(planes, ref, side);
    const distance = Math.abs(loc.s - hostPlane);
    if (distance < EPS) continue;
    const t = Math.max(0, Math.min(host.length, loc.t));
    const gap: ParallelGap = { side, otherS: loc.s, distance, t };
    if (!nearest || distance < nearest.distance) nearest = gap;
  }
  return nearest ? [nearest] : [];
}

/** Cota da ponta da parede até a perpendicular mais próxima: editar translada a parede ao longo do eixo (hospedados acompanham). */
function axisDim(frame: WallFrame, gap: AxisGap, ref: WallDimRef): TempDim {
  const atEnd = gap.end === 'b' ? frame.length : 0;
  const a = pointAt(frame, atEnd, frame.sMid);
  const b = pointAt(frame, gap.targetT, frame.sMid);
  const edit = (value: number): DimEditResult => {
    if (!(value > 0)) return { error: 'Digite uma distância maior que zero.' };
    // A ponta b se afasta do alvo recuando para −u; a ponta a, avançando para +u.
    const shift = (gap.end === 'b' ? 1 : -1) * (gap.distance - value);
    return { commands: [{ type: 'transform', ids: [frame.wall.id], transform: { kind: 'translate', d: mul(frame.u, shift) } }] };
  };
  const slot = gap.end === 'b' ? 'axisB' : 'axisA';
  return {
    key: `${PROVIDER_ID}:${frame.wall.id}:${slot}`,
    a,
    b,
    offset: DIM_OFFSET,
    value: gap.distance,
    // A ponta da parede cotada não depende da referência: só o plano da perpendicular a usa.
    ends: [
      { at: a, slot: `${slot}Self`, kind: 'wall', current: ref, options: [ref] },
      { at: b, slot, kind: 'wall', current: ref, options: WALL_DIM_REFS },
    ],
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

/**
 * Cotas de uma parede: da ponta até a perpendicular mais próxima (por ponta) e, só se não houver perpendicular, até a
 * paralela mais próxima. O comprimento da própria parede nunca é cota temporária.
 */
export const wallDimProvider: DimProvider<WallDimSubject> = {
  id: PROVIDER_ID,
  compute(ctx, subject) {
    const frame = frameOfWall(ctx.project, subject.wallId);
    if (!frame) return [];
    const ref = wallRefFor(ctx, 'wall');
    const axis = axisGaps(ctx.project, frame, ref);
    if (axis.length > 0) return axis.map((g) => axisDim(frame, g, ref));
    return nearestParallel(ctx, frame, ref).map((g) => gapDim(frame, g, ref));
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
