import { openingFamilyOf } from '@hestia/model';
import { buildWindowNew } from './openingModelWindowsNew.ts';
import type { PartMotion } from './openingModelTypes.ts';
import {
  GAP,
  addPart,
  box,
  windowInner,
  type AddOptions,
  type Ctx,
} from './openingModelContext.ts';

/** Caixilho de janela: duas ombreiras, travessa e soleira, com a profundidade no núcleo. */
function buildWindowFrame(c: Ctx): void {
  const body = { s0: c.C - c.D / 2, s1: c.C + c.D / 2 };
  for (const j of [-1, 1] as const) {
    addPart(c, `jamb-${j < 0 ? 'left' : 'right'}`, 'jamb', 'frame', box(j * (c.hw - c.J), j * c.hw, body.s0, body.s1, 0, c.H));
  }
  addPart(c, 'head', 'head', 'frame', box(-c.hw, c.hw, body.s0, body.s1, c.H - c.J, c.H));
  addPart(c, 'sill-frame', 'sillFrame', 'frame', box(-c.hw, c.hw, body.s0, body.s1, 0, c.J));
}

/** Moldura de folha de janela (4 peças `leaf`) com o vidro dentro; move junto com a folha. */
function addWindowLeaf(
  c: Ctx,
  index: number,
  t0: number,
  t1: number,
  z0: number,
  z1: number,
  sCenter: number,
  motion: PartMotion | undefined,
): void {
  const lw = Math.max(0.025, c.J * 0.6);
  const s0 = sCenter - c.L / 2;
  const s1 = sCenter + c.L / 2;
  const opts: AddOptions = { motion, leaf: index };
  addPart(c, `leaf-${index}-left`, 'leaf', 'leaf', box(t0, t0 + lw, s0, s1, z0, z1), opts);
  addPart(c, `leaf-${index}-right`, 'leaf', 'leaf', box(t1 - lw, t1, s0, s1, z0, z1), opts);
  addPart(c, `leaf-${index}-top`, 'leaf', 'leaf', box(t0 + lw, t1 - lw, s0, s1, z1 - lw, z1), opts);
  addPart(c, `leaf-${index}-bottom`, 'leaf', 'leaf', box(t0 + lw, t1 - lw, s0, s1, z0, z0 + lw), opts);
  const gt0 = t0 + lw;
  const gt1 = t1 - lw;
  const gz0 = z0 + lw;
  const gz1 = z1 - lw;
  addPart(c, `glass-${index}`, 'glass', 'glass', box(gt0, gt1, sCenter - c.G / 2, sCenter + c.G / 2, gz0, gz1), opts);
  const depth = Math.min(c.D * 0.6, c.D - 0.001);
  const half = 0.0125;
  for (let i = 1; i < c.grid.cols; i++) {
    const t = gt0 + ((gt1 - gt0) * i) / c.grid.cols;
    addPart(c, `muntin-${index}-v-${i - 1}`, 'muntin', 'frame', box(t - half, t + half, sCenter - depth / 2, sCenter + depth / 2, gz0, gz1), opts);
  }
  for (let i = 1; i < c.grid.rows; i++) {
    const z = gz0 + ((gz1 - gz0) * i) / c.grid.rows;
    addPart(c, `muntin-${index}-h-${i - 1}`, 'muntin', 'frame', box(gt0, gt1, sCenter - depth / 2, sCenter + depth / 2, z - half, z + half), opts);
  }
}

/** Montantes e travessas que dividem o vidro em `cols × rows` painéis iguais. */
function addGridMuntins(c: Ctx, t0: number, t1: number, z0: number, z1: number): void {
  const depth = Math.min(c.D * 0.6, c.D - 0.001);
  const half = 0.0125;
  for (let i = 1; i < c.grid.cols; i++) {
    const t = t0 + ((t1 - t0) * i) / c.grid.cols;
    addPart(c, `muntin-v-${i - 1}`, 'muntin', 'frame', box(t - half, t + half, c.C - depth / 2, c.C + depth / 2, z0, z1));
  }
  for (let i = 1; i < c.grid.rows; i++) {
    const z = z0 + ((z1 - z0) * i) / c.grid.rows;
    addPart(c, `muntin-h-${i - 1}`, 'muntin', 'frame', box(t0, t1, c.C - depth / 2, c.C + depth / 2, z - half, z + half));
  }
}

/** Janela fixa: caixilho e vidro com as divisões do tipo. */
function buildFixedWindow(c: Ctx): void {
  buildWindowFrame(c);
  const inner = windowInner(c);
  addPart(c, 'glass-0', 'glass', 'glass', box(inner.t0, inner.t1, c.C - c.G / 2, c.C + c.G / 2, inner.z0, inner.z1));
  addGridMuntins(c, inner.t0, inner.t1, inner.z0, inner.z1);
  c.openings.push({
    leaf: 0,
    kind: 'fixed',
    side: 0,
    hingeT: 0,
    latchT: 0,
    pivot: { t: 0, s: c.C },
    radius: 0,
    z0: inner.z0,
    z1: inner.z1,
  });
}

/** Maxim-ar e basculante: moldura de folha com vidro, girando no topo (maxim-ar) ou na base (basculante). */
function buildTiltWindow(c: Ctx, kind: 'top' | 'bottom'): void {
  buildWindowFrame(c);
  const inner = windowInner(c);
  const t0 = inner.t0 + GAP;
  const t1 = inner.t1 - GAP;
  const z1 = kind === 'top' ? inner.z1 : inner.z1 - GAP;
  const z0 = kind === 'top' ? inner.z0 + GAP : inner.z0;
  const sign = (kind === 'top' ? c.side : -c.side) as 1 | -1;
  const motion: PartMotion = { kind: 'rotate', axis: 't', s: c.C, z: kind === 'top' ? z1 : z0, sign };
  addWindowLeaf(c, 0, t0, t1, z0, z1, c.C, motion);
  c.openings.push({
    leaf: 0,
    kind,
    side: c.side,
    hingeT: 0,
    latchT: 0,
    pivot: { t: 0, s: c.C },
    radius: z1 - z0,
    z0,
    z1,
  });
}

/** Janela de correr de 2 ou 3 folhas em pistas defasadas, com montantes/trilhos. */
function buildSlidingWindow(c: Ctx): void {
  buildWindowFrame(c);
  const inner = windowInner(c);
  const n = Math.max(1, c.g.leaves);
  const center0 = (inner.t0 + inner.t1) / 2;
  const innerHalf = (inner.t1 - inner.t0) / 2;
  const leafW = (2 * innerHalf + (n - 1) * 0.05) / n;
  const spacing = leafW - 0.05;
  const pitch = Math.max(c.L, 0.02) + 0.004;
  const travel = leafW - 0.05;
  const z0 = inner.z0 + GAP;
  const z1 = inner.z1 - GAP;
  const body = { s0: c.C - c.D / 2, s1: c.C + c.D / 2 };
  addPart(c, 'track-head', 'track', 'metal', box(inner.t0, inner.t1, body.s0, body.s1, c.H - c.J - GAP - 0.01, c.H - c.J - GAP));
  addPart(c, 'track-sill', 'track', 'metal', box(inner.t0, inner.t1, body.s0, body.s1, c.J, c.J + 0.01));
  for (let k = 0; k < n; k++) {
    const center = center0 + (k - (n - 1) / 2) * spacing;
    const sCenter = c.C + (k - (n - 1) / 2) * pitch;
    const moving = k % 2 === 1;
    const motion: PartMotion | undefined = moving ? { kind: 'slide', dt: -1, ds: 0, dz: 0, travel } : undefined;
    addWindowLeaf(c, k, center - leafW / 2, center + leafW / 2, z0, z1, sCenter, motion);
    c.openings.push({
      leaf: k,
      kind: 'slide',
      side: 0,
      hingeT: 0,
      latchT: 0,
      pivot: { t: 0, s: sCenter },
      radius: leafW,
      z0,
      z1,
    });
  }
}

/** Vão livre de janela: só a soleira (sem batente, folha ou vidro). */
export function buildWindowVoid(c: Ctx): void {
  const body = { s0: c.C - c.D / 2, s1: c.C + c.D / 2 };
  addPart(c, 'sill-frame', 'sillFrame', 'frame', box(-c.hw, c.hw, body.s0, body.s1, 0, c.J));
}

export function buildWindow(c: Ctx): void {
  const family = openingFamilyOf(c.t)?.id;
  switch (family) {
    case 'window_casement':
      buildTiltWindow(c, 'top');
      break;
    case 'window_tilt':
      buildTiltWindow(c, 'bottom');
      break;
    case 'window_sliding':
      buildSlidingWindow(c);
      break;
    case 'window_void':
      buildWindowVoid(c);
      break;
    default:
      if (!buildWindowNew(c, family)) buildFixedWindow(c);
  }
}

export function buildVoid(c: Ctx): void {
  if (c.t.kind === 'window') buildWindowVoid(c);
}
