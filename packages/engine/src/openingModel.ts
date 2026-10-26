import {
  coreSpan,
  openingFamilyOf,
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
import type { LeafOpening, OpeningModel, OpeningPart, PartBox, PartMaterial, PartMotion, PartRole } from './openingModelTypes.ts';

/** Folga padrão da esquadria (m). */
const GAP = 0.004;
/** Largura do batedor/rebaixo (m). */
const OVERLAP = 0.015;
/** Largura do montante entre a bandeira lateral e a folha (m). */
const SIDELIGHT_MULLION = 0.04;
/** Espessura da travessa da bandeira superior (m). */
const TRANSOM_BAR = 0.04;

interface Ctx {
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

function box(t0: number, t1: number, s0: number, s1: number, z0: number, z1: number): PartBox {
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

interface AddOptions {
  motion?: PartMotion;
  leaf?: number;
  dashed?: boolean;
}

function addPart(c: Ctx, id: string, role: PartRole, material: PartMaterial, b: PartBox, opts: AddOptions = {}): void {
  if (!validBox(b)) return;
  c.parts.push({ id, role, material, box: b, ...opts });
}

/** Contexto de um vão; a folha é montada por família em `buildDoor`/`buildWindow`. */
function makeCtx(p: Project, o: Opening, g: OpeningGeometry, f: WallFrame): Ctx | null {
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
function leafSpan(c: Ctx): { center: number; half: number } {
  if (c.frameStyle === 'block') return { center: 0, half: c.hw - GAP };
  let innerL = -c.hw + c.J;
  let innerR = c.hw - c.J;
  if (c.sidelights) {
    const w = c.sidelights.width + SIDELIGHT_MULLION;
    if (c.sidelights.left) innerL += w;
    if (c.sidelights.right) innerR -= w;
  }
  const center = (innerL + innerR) / 2;
  const innerHalf = Math.max(0, (innerR - innerL) / 2);
  const half = c.frameStyle === 'rebate' || c.frameStyle === 'aduela' ? innerHalf + OVERLAP - GAP : innerHalf - GAP;
  return { center, half: Math.max(0, half) };
}

/** Faixa `s` da folha no batente: do lado da abertura ('swing') ou o oposto. */
function leafS(c: Ctx): { s0: number; s1: number } {
  if (c.frameStyle === 'simple' || c.frameStyle === 'block') return { s0: c.C - c.L / 2, s1: c.C + c.L / 2 };
  const lside = c.leafSide === 'opposite' ? -c.side : c.side;
  const start = c.C + lside * (c.D / 2 - (c.L + GAP));
  return { s0: start, s1: start + lside * c.L };
}

/** Faixa `s` do batedor: no lado oposto ao da abertura (espelhada com `leafSide = 'opposite'`). */
function stopS(c: Ctx): { s0: number; s1: number } {
  const stopSide = c.leafSide === 'opposite' ? c.side : -c.side;
  const start = c.C + stopSide * (c.D / 2);
  const end = start - stopSide * (c.D - (c.L + GAP));
  return { s0: start, s1: end };
}

/** Altura (z) da folha fechada, já descontada a bandeira superior e o vão livre de batente. */
function leafZ(c: Ctx): { z0: number; z1: number } {
  const z0 = 0.008;
  let z1 =
    c.frameStyle === 'block'
      ? c.H - GAP
      : c.frameStyle === 'simple'
        ? c.H - c.J - GAP
        : c.H - c.J + OVERLAP - GAP;
  if (c.transom) z1 = Math.min(z1, c.H - c.J - c.transom.height - TRANSOM_BAR);
  return { z0, z1: Math.max(z0, z1) };
}

/** Batente de porta: ombreiras e travessa; com rebaixo (batedor) ou caixa única. */
function buildDoorFrame(c: Ctx): void {
  if (c.frameStyle === 'block') return;
  const body = { s0: c.C - c.D / 2, s1: c.C + c.D / 2 };
  for (const j of [-1, 1] as const) {
    const name = j < 0 ? 'left' : 'right';
    if (c.frameStyle === 'simple') {
      addPart(c, `jamb-${name}`, 'jamb', 'frame', box(j * (c.hw - c.J), j * c.hw, body.s0, body.s1, 0, c.H));
      continue;
    }
    addPart(c, `jamb-${name}`, 'jamb', 'frame', box(j * (c.hw - c.J + OVERLAP), j * c.hw, body.s0, body.s1, 0, c.H));
    const stop = stopS(c);
    addPart(c, `stop-${name}`, 'stop', 'frame', box(j * (c.hw - c.J), j * (c.hw - c.J + OVERLAP), stop.s0, stop.s1, 0, c.H));
  }
  if (c.frameStyle === 'simple') {
    addPart(c, 'head', 'head', 'frame', box(-c.hw, c.hw, body.s0, body.s1, c.H - c.J, c.H));
    return;
  }
  addPart(c, 'head', 'head', 'frame', box(-c.hw, c.hw, body.s0, body.s1, c.H - c.J + OVERLAP, c.H));
  const stop = stopS(c);
  addPart(c, 'stop-head', 'stop', 'frame', box(-c.hw, c.hw, stop.s0, stop.s1, c.H - c.J, c.H - c.J + OVERLAP));
}

/** Folha de giro (uma ou duas), com a maçaneta e os detalhes do estilo. */
function addSwingLeaf(c: Ctx, index: number, t0: number, t1: number, hingeT: number, latchT: number): void {
  const span = leafS(c);
  const z = leafZ(c);
  // O sinal depende do lado da dobradiça: com a folha à direita do eixo (h = +1) o mesmo ângulo a levaria ao lado
  // oposto ao da abertura.
  const sign = (c.side * (hingeT < latchT ? 1 : -1)) as 1 | -1;
  const rotate: PartMotion = { kind: 'rotate', axis: 'z', t: hingeT, s: (span.s0 + span.s1) / 2, sign };
  addPart(c, `leaf-${index}`, 'leaf', 'leaf', box(t0, t1, span.s0, span.s1, z.z0, z.z1), { motion: rotate, leaf: index });
  c.openings.push({
    leaf: index,
    kind: 'side',
    side: c.side,
    hingeT,
    latchT,
    pivot: { t: hingeT, s: (span.s0 + span.s1) / 2 },
    radius: Math.abs(t1 - t0),
    z0: z.z0,
    z1: z.z1,
  });
}

/** Porta de giro de uma folha (etapa atual do núcleo). */
function buildSwingDoor(c: Ctx): void {
  buildDoorFrame(c);
  const span = leafSpan(c);
  const hingeT = span.center + c.h * span.half;
  const latchT = span.center - c.h * span.half;
  addSwingLeaf(c, 0, latchT, hingeT, hingeT, latchT);
}

export function buildOpeningModel(p: Project, o: Opening, g: OpeningGeometry, f: WallFrame): OpeningModel {
  const c = makeCtx(p, o, g, f);
  if (!c) {
    return {
      kind: o.kind,
      width: g.width,
      height: g.height,
      thickness: f.thickness,
      core: openingCore(f),
      parts: [],
      openings: [],
      void: g.leaves === 0,
    };
  }
  const family = openingFamilyOf(c.t)?.id;
  if (g.leaves === 0) {
    // Vão livre: sem batente, folha ou vidro; só o acabamento que existir.
  } else if (c.t.kind === 'door') {
    if (family === 'door_swing' || family === 'door_double') buildSwingDoor(c);
  }
  return {
    kind: c.t.kind,
    width: c.hw * 2,
    height: c.H,
    thickness: c.thickness,
    core: c.core,
    parts: c.parts,
    openings: c.openings,
    void: g.leaves === 0,
  };
}
