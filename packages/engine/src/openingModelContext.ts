import {
  coreSpan,
  openingFrame,
  openingFrameStyle,
  openingGrid,
  openingHandle,
  openingLeafSide,
  openingLeafStyle,
  openingSidelights,
  openingTransom,
  type Opening,
  type OpeningFrameStyle,
  type OpeningHandle,
  type OpeningLeafStyle,
  type OpeningType,
  type Project,
} from '@hestia/model';
import type { WallFrame } from './frame.ts';
import type { OpeningGeometry } from './types.ts';
import type {
  LeafOpening,
  OpeningPart,
  PartBox,
  PartMaterial,
  PartMotion,
  PartRole,
} from './openingModelTypes.ts';

/** Folga padrão da esquadria (m). */
export const GAP = 0.004;
/** Largura do batedor/rebaixo (m). */
export const OVERLAP = 0.015;
/** Largura do montante entre a bandeira lateral e a folha (m). */
export const SIDELIGHT_MULLION = 0.04;
/** Espessura da travessa da bandeira superior (m). */
export const TRANSOM_BAR = 0.04;

export interface Ctx {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  f: WallFrame;
  t: OpeningType;
  core: { s0: number; s1: number };
  C: number;
  hw: number;
  H: number;
  thickness: number;
  J: number;
  D: number;
  L: number;
  G: number;
  side: 1 | -1;
  h: 1 | -1;
  frameStyle: OpeningFrameStyle;
  leafStyle: OpeningLeafStyle;
  handle: OpeningHandle;
  leafSide: 'swing' | 'opposite';
  grid: { cols: number; rows: number };
  transom: { height: number; fixed: boolean } | null;
  sidelights: { left: boolean; right: boolean; width: number } | null;
  parts: OpeningPart[];
  openings: LeafOpening[];
}

/** Núcleo da parede em `s` local (DEC-1), sempre com `s0 < s1`. */
export function openingCore(f: WallFrame): { s0: number; s1: number } {
  const cs = coreSpan(f.type);
  const dir = Math.sign(f.sInt - f.sExt) || 1;
  const a = f.sExt + dir * cs.from - f.sMid;
  const b = f.sExt + dir * cs.to - f.sMid;
  return { s0: Math.min(a, b), s1: Math.max(a, b) };
}

export function box(t0: number, t1: number, s0: number, s1: number, z0: number, z1: number): PartBox {
  return {
    t0: Math.min(t0, t1),
    t1: Math.max(t0, t1),
    s0: Math.min(s0, s1),
    s1: Math.max(s0, s1),
    z0: Math.min(z0, z1),
    z1: Math.max(z0, z1),
  };
}

const validBox = (b: PartBox): boolean => b.t1 - b.t0 > 1e-9 && b.s1 - b.s0 > 1e-9 && b.z1 - b.z0 > 1e-9;

export interface AddOptions {
  motion?: PartMotion;
  leaf?: number;
  dashed?: boolean;
}

export function addPart(c: Ctx, id: string, role: PartRole, material: PartMaterial, b: PartBox, opts: AddOptions = {}): void {
  if (!validBox(b)) return;
  c.parts.push({ id, role, material, box: b, ...opts });
}

/** Contexto de um vão; a folha é montada por família em `buildDoor`/`buildWindow`. */
export function makeCtx(p: Project, o: Opening, g: OpeningGeometry, f: WallFrame): Ctx | null {
  const t = p.openingTypes[o.typeId];
  if (!t) return null;
  const core = openingCore(f);
  const coreWidth = core.s1 - core.s0;
  const fr = openingFrame(t, coreWidth);
  const frameStyle = openingFrameStyle(t);
  const J = frameStyle === 'aduela' ? 0.03 : fr.frameWidth;
  const D = frameStyle === 'aduela' ? coreWidth : fr.frameDepth;
  return {
    p,
    o,
    g,
    f,
    t,
    core,
    C: (core.s0 + core.s1) / 2,
    hw: g.width / 2,
    H: g.height,
    thickness: f.thickness,
    J,
    D,
    L: fr.leafThickness,
    G: fr.glassThickness,
    side: g.flipFacing ? -1 : 1,
    h: g.flipHand ? 1 : -1,
    frameStyle,
    leafStyle: openingLeafStyle(t),
    handle: openingHandle(t),
    leafSide: openingLeafSide(t),
    grid: openingGrid(t),
    transom: openingTransom(t),
    sidelights: openingSidelights(t),
    parts: [],
    openings: [],
  };
}

/** Faixa da folha em `t` (centro e meia-largura), já descontadas as bandeiras laterais. */
export function leafSpan(c: Ctx): { center: number; half: number } {
  if (c.frameStyle === 'block') return { center: 0, half: c.hw - GAP };
  const inner = innerT(c);
  const center = (inner.t0 + inner.t1) / 2;
  const innerHalf = Math.max(0, (inner.t1 - inner.t0) / 2);
  const half = c.frameStyle === 'rebate' || c.frameStyle === 'aduela' ? innerHalf + OVERLAP - GAP : innerHalf - GAP;
  return { center, half: Math.max(0, half) };
}

/** Faixa `s` da folha no batente: do lado da abertura ('swing') ou o oposto. */
export function leafS(c: Ctx): { s0: number; s1: number } {
  if (c.frameStyle === 'simple' || c.frameStyle === 'block') return { s0: c.C - c.L / 2, s1: c.C + c.L / 2 };
  const lside = c.leafSide === 'opposite' ? -c.side : c.side;
  const start = c.C + lside * (c.D / 2 - (c.L + GAP));
  return { s0: start, s1: start + lside * c.L };
}

/** Faixa `s` do batedor: no lado oposto ao da abertura (espelhada com `leafSide = 'opposite'`). */
export function stopS(c: Ctx): { s0: number; s1: number } {
  const stopSide = c.leafSide === 'opposite' ? c.side : -c.side;
  const start = c.C + stopSide * (c.D / 2);
  const end = start - stopSide * (c.D - (c.L + GAP));
  return { s0: start, s1: end };
}

/** Altura (z) da folha fechada, já descontada a bandeira superior e o vão livre de batente. */
export function leafZ(c: Ctx): { z0: number; z1: number } {
  const z0 = 0.008;
  let z1 =
    c.frameStyle === 'block'
      ? c.H - GAP
      : c.frameStyle === 'simple'
        ? c.H - c.J - GAP
        : c.H - c.J + OVERLAP - GAP;
  if (c.transom) z1 = Math.min(z1, c.H - c.J - c.transom.height - TRANSOM_BAR - GAP);
  return { z0, z1: Math.max(z0, z1) };
}

/** Faixa interna em `t`, já descontadas as bandeiras laterais. */
export function innerT(c: Ctx): { t0: number; t1: number } {
  let t0 = -c.hw + c.J;
  let t1 = c.hw - c.J;
  if (c.sidelights) {
    const w = c.sidelights.width + SIDELIGHT_MULLION;
    if (c.sidelights.left) t0 += w;
    if (c.sidelights.right) t1 -= w;
  }
  return { t0, t1 };
}

/** Área interna do caixilho (t e z), já descontado o perímetro. */
export function windowInner(c: Ctx): { t0: number; t1: number; z0: number; z1: number } {
  let z1 = c.H - c.J;
  if (c.transom) z1 = Math.min(z1, c.H - c.J - c.transom.height - TRANSOM_BAR);
  const t = innerT(c);
  return { t0: t.t0, t1: t.t1, z0: c.J, z1 };
}
