import {
  coreSpan,
  openingCasing,
  openingFamilyOf,
  openingFrame,
  openingFrameStyle,
  openingGrid,
  openingHandle,
  openingLeafSide,
  openingLeafStyle,
  openingLintel,
  openingSidelights,
  openingSillBeam,
  openingSillBoard,
  openingTransom,
  type Opening,
  type OpeningFrameStyle,
  type OpeningHandle,
  type OpeningLeafStyle,
  type OpeningType,
  type Project,
} from '@hestia/model';
import type { WallFrame } from './frame.ts';
import { buildNewDoorParts } from './openingModelDoorsNew.ts';
import type { OpeningGeometry } from './types.ts';
import type {
  LeafOpening,
  OpeningModel,
  OpeningPart,
  OpenState,
  PartBox,
  PartMaterial,
  PartMotion,
  PartRole,
} from './openingModelTypes.ts';

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
  const inner = innerT(c);
  const center = (inner.t0 + inner.t1) / 2;
  const innerHalf = Math.max(0, (inner.t1 - inner.t0) / 2);
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
  if (c.transom) z1 = Math.min(z1, c.H - c.J - c.transom.height - TRANSOM_BAR - GAP);
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

/** Almofadas, aletas ou grelhas sobre a folha (detalhe do estilo). */
function addLeafDetails(
  c: Ctx,
  index: number,
  t0: number,
  t1: number,
  sSpan: { s0: number; s1: number },
  z0: number,
  z1: number,
  motion: PartMotion,
): void {
  const opts: AddOptions = { motion, leaf: index };
  if (c.leafStyle === 'panel') {
    const mt = Math.min(0.08, (t1 - t0) * 0.1);
    const mz = Math.min(0.08, (z1 - z0) * 0.1);
    const gapPanel = 0.03;
    const a0 = t0 + mt;
    const a1 = t1 - mt;
    const b0 = z0 + mz;
    const b1 = z1 - mz;
    const colW = (a1 - a0 - gapPanel) / 2;
    const rowH = (b1 - b0 - gapPanel) / 2;
    if (colW > 0 && rowH > 0) {
      for (let col = 0; col < 2; col++) {
        for (let row = 0; row < 2; row++) {
          const p0 = a0 + col * (colW + gapPanel);
          const p1 = p0 + colW;
          const q0 = b0 + row * (rowH + gapPanel);
          const q1 = q0 + rowH;
          addPart(
            c,
            `leaf-${index}-panel-${col}-${row}`,
            'leafPanel',
            'leaf',
            box(p0, p1, sSpan.s0 - 0.006, sSpan.s1 + 0.006, q0, q1),
            opts,
          );
        }
      }
    }
    return;
  }
  if (c.leafStyle === 'louver') {
    const t0i = t0 + 0.05;
    const t1i = t1 - 0.05;
    if (t1i > t0i) {
      let z = z0 + 0.03;
      let k = 0;
      while (z + 0.035 <= z1 - 0.03) {
        addPart(c, `leaf-${index}-louver-${k}`, 'leafPanel', 'leaf', box(t0i, t1i, sSpan.s0, sSpan.s1, z, z + 0.035), opts);
        z += 0.055;
        k++;
      }
    }
    return;
  }
  if (c.leafStyle === 'grille') {
    const z0i = z0 + 0.03;
    const z1i = z1 - 0.03;
    if (z1i > z0i) {
      let t = t0 + 0.03;
      let k = 0;
      while (t + 0.025 <= t1 - 0.03) {
        addPart(c, `leaf-${index}-grille-${k}`, 'leafPanel', 'leaf', box(t, t + 0.025, sSpan.s0 - 0.003, sSpan.s1 + 0.003, z0i, z1i), opts);
        t += 0.08;
        k++;
      }
    }
  }
}

/** Maçaneta da folha, presa a ela (mesmo movimento), a 0,06 m do lado do trinco. */
function addHandle(
  c: Ctx,
  index: number,
  tCenter: number,
  sSpan: { s0: number; s1: number },
  z0: number,
  z1: number,
  latchT: number,
  motion: PartMotion,
): void {
  if (c.handle === 'none') return;
  const z = Math.min(Math.max(1.0, z0 + 0.05), z1 - 0.05);
  const sMid = (sSpan.s0 + sSpan.s1) / 2;
  const inward = Math.sign(tCenter - latchT) || 1;
  const tR = latchT + inward * 0.06;
  const opts: AddOptions = { motion, leaf: index };
  if (c.handle === 'pull') {
    const sCenter = sMid + c.side * (c.L / 2 + 0.015);
    addPart(c, `handle-${index}-pull`, 'handle', 'metal', box(-0.01, 0.01, sCenter - 0.015, sCenter + 0.015, z - 0.2, z + 0.2), opts);
    return;
  }
  if (c.handle === 'knob') {
    for (const face of [-1, 1] as const) {
      const sCenter = sMid + face * (c.L / 2 + 0.025);
      addPart(
        c,
        `handle-${index}-knob-${face < 0 ? 'a' : 'b'}`,
        'handle',
        'metal',
        box(tR - 0.025, tR + 0.025, sCenter - 0.025, sCenter + 0.025, z - 0.025, z + 0.025),
        opts,
      );
    }
    return;
  }
  for (const face of [-1, 1] as const) {
    const sCenter = sMid + face * (c.L / 2 + 0.006);
    addPart(
      c,
      `handle-${index}-rosette-${face < 0 ? 'a' : 'b'}`,
      'handle',
      'metal',
      box(tR - 0.025, tR + 0.025, sCenter - 0.006, sCenter + 0.006, z - 0.025, z + 0.025),
      opts,
    );
    const tHaste = tR + inward * 0.065;
    addPart(
      c,
      `handle-${index}-lever-${face < 0 ? 'a' : 'b'}`,
      'handle',
      'metal',
      box(tHaste - 0.065, tHaste + 0.065, sCenter - 0.006, sCenter + 0.006, z - 0.01, z + 0.01),
      opts,
    );
  }
}

/** Folha de porta: vazada (glass) ou sólida com os detalhes do estilo e a maçaneta. */
function addDoorLeaf(
  c: Ctx,
  index: number,
  t0: number,
  t1: number,
  sSpan: { s0: number; s1: number },
  z: { z0: number; z1: number },
  motion: PartMotion,
  latchT: number,
): void {
  const opts: AddOptions = { motion, leaf: index };
  const ta = Math.min(t0, t1);
  const tb = Math.max(t0, t1);
  if (c.leafStyle === 'glass') {
    const stile = 0.1;
    const bottom = 0.22;
    const innerL = ta + stile;
    const innerR = tb - stile;
    const innerZ0 = z.z0 + bottom;
    const innerZ1 = z.z1 - stile;
    addPart(c, `leaf-${index}-left`, 'leaf', 'leaf', box(ta, innerL, sSpan.s0, sSpan.s1, z.z0, z.z1), opts);
    addPart(c, `leaf-${index}-right`, 'leaf', 'leaf', box(innerR, tb, sSpan.s0, sSpan.s1, z.z0, z.z1), opts);
    addPart(c, `leaf-${index}-top`, 'leaf', 'leaf', box(innerL, innerR, sSpan.s0, sSpan.s1, innerZ1, z.z1), opts);
    addPart(c, `leaf-${index}-bottom`, 'leaf', 'leaf', box(innerL, innerR, sSpan.s0, sSpan.s1, z.z0, innerZ0), opts);
    const sMid = (sSpan.s0 + sSpan.s1) / 2;
    addPart(c, `glass-${index}`, 'glass', 'glass', box(innerL, innerR, sMid - c.G / 2, sMid + c.G / 2, innerZ0, innerZ1), opts);
  } else {
    addPart(c, `leaf-${index}`, 'leaf', 'leaf', box(ta, tb, sSpan.s0, sSpan.s1, z.z0, z.z1), opts);
    addLeafDetails(c, index, ta, tb, sSpan, z.z0, z.z1, motion);
  }
  addHandle(c, index, (ta + tb) / 2, sSpan, z.z0, z.z1, latchT, motion);
}

/** Folha de giro (uma ou duas), com a maçaneta e os detalhes do estilo. */
function addSwingLeaf(c: Ctx, index: number, t0: number, t1: number, hingeT: number, latchT: number): void {
  const span = leafS(c);
  const z = leafZ(c);
  // O sinal depende do lado da dobradiça: com a folha à direita do eixo (h = +1) o mesmo ângulo a levaria ao lado
  // oposto ao da abertura.
  const sign = (c.side * (hingeT < latchT ? 1 : -1)) as 1 | -1;
  const rotate: PartMotion = { kind: 'rotate', axis: 'z', t: hingeT, s: (span.s0 + span.s1) / 2, sign };
  addDoorLeaf(c, index, t0, t1, span, z, rotate, latchT);
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

/** Porta de giro de uma folha. */
function buildSwingDoor(c: Ctx): void {
  buildDoorFrame(c);
  const span = leafSpan(c);
  const hingeT = span.center + c.h * span.half;
  const latchT = span.center - c.h * span.half;
  addSwingLeaf(c, 0, latchT, hingeT, hingeT, latchT);
}

/** Porta dupla: duas folhas de `lh − 0,002`, dobradiças nas ombreiras, as duas para `side`. */
function buildDoubleDoor(c: Ctx): void {
  buildDoorFrame(c);
  const span = leafSpan(c);
  const leftHinge = span.center - span.half;
  const rightHinge = span.center + span.half;
  const centerL = span.center - 0.002;
  const centerR = span.center + 0.002;
  addSwingLeaf(c, 0, centerL, leftHinge, leftHinge, centerL);
  addSwingLeaf(c, 1, centerR, rightHinge, rightHinge, centerR);
}

/** Porta pivotante: folha inteira girando em torno do eixo vertical a W/4 da ombreira da dobradiça. */
function buildPivotDoor(c: Ctx): void {
  buildDoorFrame(c);
  const span = leafSpan(c);
  const z = leafZ(c);
  const sSpan = leafS(c);
  const axis = c.h * (c.hw / 2);
  const sMid = (sSpan.s0 + sSpan.s1) / 2;
  const sign = (c.side * c.h) as 1 | -1;
  const motion: PartMotion = { kind: 'rotate', axis: 'z', t: axis, s: sMid, sign };
  addDoorLeaf(c, 0, span.center - span.half, span.center + span.half, sSpan, z, motion, -axis);
  c.openings.push({
    leaf: 0,
    kind: 'pivot',
    side: c.side,
    hingeT: axis,
    latchT: -axis,
    pivot: { t: axis, s: sMid },
    radius: (3 * c.hw) / 2,
    z0: z.z0,
    z1: z.z1,
  });
}

/** Batente de correr: caixa J×D sem batedor, com trilhos metálicos no topo e no piso. */
function buildSlidingDoorFrame(c: Ctx): void {
  const body = { s0: c.C - c.D / 2, s1: c.C + c.D / 2 };
  for (const j of [-1, 1] as const) {
    addPart(c, `jamb-${j < 0 ? 'left' : 'right'}`, 'jamb', 'frame', box(j * (c.hw - c.J), j * c.hw, body.s0, body.s1, 0, c.H));
  }
  addPart(c, 'head', 'head', 'frame', box(-c.hw, c.hw, body.s0, body.s1, c.H - c.J, c.H));
  const inner = c.hw - c.J;
  addPart(c, 'track-head', 'track', 'metal', box(-inner, inner, body.s0, body.s1, c.H - c.J - GAP - 0.01, c.H - c.J - GAP));
  addPart(c, 'track-floor', 'track', 'metal', box(-inner, inner, body.s0, body.s1, 0, 0.01));
}

/** Porta de correr de duas folhas: pistas opostas, sobreposição central e uma folha que desliza. */
function buildSlidingDoor(c: Ctx): void {
  buildSlidingDoorFrame(c);
  const inner = innerT(c);
  const innerWidth = inner.t1 - inner.t0;
  const center0 = (inner.t0 + inner.t1) / 2;
  const leafW = (innerWidth + 0.06) / 2;
  const spacing = leafW - 0.06;
  const travel = leafW - 0.06;
  const z0 = 0.008;
  const z1 = c.transom ? c.H - c.J - c.transom.height - TRANSOM_BAR - GAP : c.H - c.J - GAP;
  const moving = c.h === 1 ? 0 : 1;
  for (let k = 0; k < 2; k++) {
    const center = center0 + (k - 0.5) * spacing;
    const sCenter = c.C + (k === 0 ? -1 : 1) * (c.L / 2 + 0.003);
    const motion: PartMotion =
      k === moving ? { kind: 'slide', dt: k === 1 ? -1 : 1, ds: 0, dz: 0, travel } : { kind: 'slide', dt: 0, ds: 0, dz: 0, travel: 0 };
    const latchT = center + (k <= 0 ? leafW / 2 : -leafW / 2);
    addDoorLeaf(c, k, center - leafW / 2, center + leafW / 2, { s0: sCenter - c.L / 2, s1: sCenter + c.L / 2 }, { z0, z1 }, motion, latchT);
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

/** Caixilho de janela: duas ombreiras, travessa e soleira, com a profundidade no núcleo. */
function buildWindowFrame(c: Ctx): void {
  const body = { s0: c.C - c.D / 2, s1: c.C + c.D / 2 };
  for (const j of [-1, 1] as const) {
    addPart(c, `jamb-${j < 0 ? 'left' : 'right'}`, 'jamb', 'frame', box(j * (c.hw - c.J), j * c.hw, body.s0, body.s1, 0, c.H));
  }
  addPart(c, 'head', 'head', 'frame', box(-c.hw, c.hw, body.s0, body.s1, c.H - c.J, c.H));
  addPart(c, 'sill-frame', 'sillFrame', 'frame', box(-c.hw, c.hw, body.s0, body.s1, 0, c.J));
}

/** Faixa interna em `t`, já descontadas as bandeiras laterais. */
function innerT(c: Ctx): { t0: number; t1: number } {
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
function windowInner(c: Ctx): { t0: number; t1: number; z0: number; z1: number } {
  let z1 = c.H - c.J;
  if (c.transom) z1 = Math.min(z1, c.H - c.J - c.transom.height - TRANSOM_BAR);
  const t = innerT(c);
  return { t0: t.t0, t1: t.t1, z0: c.J, z1 };
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
function buildWindowVoid(c: Ctx): void {
  const body = { s0: c.C - c.D / 2, s1: c.C + c.D / 2 };
  addPart(c, 'sill-frame', 'sillFrame', 'frame', box(-c.hw, c.hw, body.s0, body.s1, 0, c.J));
}

function buildWindow(c: Ctx): void {
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
      buildFixedWindow(c);
  }
}

function buildVoid(c: Ctx): void {
  if (c.t.kind === 'window') buildWindowVoid(c);
}

/** Bandeiras laterais: vidro fixo de cada lado marcado, com montante entre ele e a folha. */
function buildSidelights(c: Ctx): void {
  const s = c.sidelights;
  if (!s) return;
  const base = { t0: -c.hw + c.J, t1: c.hw - c.J };
  const z0 = c.t.kind === 'window' ? c.J : 0;
  let z1 = c.H - c.J;
  if (c.transom) z1 = Math.min(z1, c.H - c.J - c.transom.height - TRANSOM_BAR);
  const body = { s0: c.C - c.D / 2, s1: c.C + c.D / 2 };
  if (s.left) {
    addPart(c, 'sidelight-glass-left', 'glass', 'glass', box(base.t0, base.t0 + s.width, c.C - c.G / 2, c.C + c.G / 2, z0, z1));
    const m0 = base.t0 + s.width;
    addPart(c, 'sidelight-mullion-left', 'leaf', 'frame', box(m0, m0 + SIDELIGHT_MULLION, body.s0, body.s1, z0, z1));
  }
  if (s.right) {
    addPart(c, 'sidelight-glass-right', 'glass', 'glass', box(base.t1 - s.width, base.t1, c.C - c.G / 2, c.C + c.G / 2, z0, z1));
    const m1 = base.t1 - s.width;
    addPart(c, 'sidelight-mullion-right', 'leaf', 'frame', box(m1 - SIDELIGHT_MULLION, m1, body.s0, body.s1, z0, z1));
  }
}

/** Bandeira superior: travessa fixa de material de folha e vidro fixo acima; não gera item de abertura. */
function buildTransom(c: Ctx): void {
  const tr = c.transom;
  if (!tr) return;
  const inner = innerT(c);
  const barZ0 = c.H - c.J - tr.height - TRANSOM_BAR;
  const barZ1 = c.H - c.J - tr.height;
  addPart(c, 'transom-bar', 'leaf', 'leaf', box(inner.t0, inner.t1, c.C - c.L / 2, c.C + c.L / 2, barZ0, barZ1));
  addPart(c, 'transom-glass', 'glass', 'glass', box(inner.t0, inner.t1, c.C - c.G / 2, c.C + c.G / 2, barZ1, c.H - c.J));
}

/** Alizar em volta do vão, encostado nas duas faces da parede (3 caixas na porta, 4 na janela). */
function buildCasing(c: Ctx): void {
  const casing = openingCasing(c.t);
  if (!casing) return;
  const cw = casing.width;
  const ct = casing.thickness;
  for (const side of [-1, 1] as const) {
    const s0 = c.thickness / 2 + 0;
    const sCenter = side * (s0 + ct / 2);
    const tag = side < 0 ? 'a' : 'b';
    addPart(c, `casing-left-${tag}`, 'casing', 'casing', box(-c.hw - cw, -c.hw, sCenter - ct / 2, sCenter + ct / 2, 0, c.H + cw));
    addPart(c, `casing-right-${tag}`, 'casing', 'casing', box(c.hw, c.hw + cw, sCenter - ct / 2, sCenter + ct / 2, 0, c.H + cw));
    addPart(c, `casing-head-${tag}`, 'casing', 'casing', box(-c.hw - cw, c.hw + cw, sCenter - ct / 2, sCenter + ct / 2, c.H, c.H + cw));
    if (c.t.kind === 'window') {
      addPart(c, `casing-sill-${tag}`, 'casing', 'casing', box(-c.hw - cw, c.hw + cw, sCenter - ct / 2, sCenter + ct / 2, -cw, 0));
    }
  }
}

/** Peitoril saliente de janela: projeta além das duas faces, abaixo do vão. */
function buildSillBoard(c: Ctx): void {
  const sill = openingSillBoard(c.t);
  if (!sill) return;
  const half = c.thickness / 2 + sill.projection;
  addPart(c, 'sill-board', 'sillBoard', 'casing', box(-c.hw - 0.03, c.hw + 0.03, -half, half, -sill.thickness, 0));
}

/** Verga e contraverga de concreto, com transpasse além do vão. */
function buildLintelBeams(c: Ctx): void {
  const lintel = openingLintel(c.t);
  if (lintel) {
    addPart(c, 'lintel', 'lintel', 'concrete', box(-c.hw - lintel.over, c.hw + lintel.over, c.core.s0, c.core.s1, c.H, c.H + lintel.height));
  }
  const beam = openingSillBeam(c.t);
  if (beam) {
    addPart(c, 'sill-beam', 'sillBeam', 'concrete', box(-c.hw - beam.over, c.hw + beam.over, c.core.s0, c.core.s1, -beam.height, 0));
  }
}

function buildDoor(c: Ctx): void {
  const family = openingFamilyOf(c.t)?.id;
  const novas = buildNewDoorParts(c.p, c.o, c.g, c.f);
  if (novas) {
    c.parts.push(...novas.parts);
    c.openings.push(...novas.openings);
    return;
  }
  switch (family) {
    case 'door_double':
      buildDoubleDoor(c);
      break;
    case 'door_pivot':
      buildPivotDoor(c);
      break;
    case 'door_sliding':
      buildSlidingDoor(c);
      break;
    case 'door_void':
      buildVoid(c);
      break;
    default:
      buildSwingDoor(c);
  }
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
  if (g.leaves === 0) {
    // Vão livre: sem batente, folha ou vidro; só o acabamento que existir.
    buildVoid(c);
  } else if (c.t.kind === 'door') {
    buildDoor(c);
  } else {
    buildWindow(c);
  }
  if (g.leaves > 0) {
    buildSidelights(c);
    buildTransom(c);
  }
  buildCasing(c);
  buildSillBoard(c);
  buildLintelBeams(c);
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

/** Ponto no sistema local do vão. */
export interface ModelPoint {
  t: number;
  s: number;
  z: number;
}

/**
 * Caixa orientada depois do movimento: 8 vértices (base 0..3 e topo 4..7, no sentido t0s0, t1s0, t1s1, t0s1), o
 * centro e a caixa alinhada que a contém.
 */
export interface OrientedBox {
  corners: ModelPoint[];
  center: ModelPoint;
  bounds: PartBox;
}

/** Anel de corte a uma altura `z`, em (t, s). */
export interface SliceRing {
  part: OpeningPart;
  ring: Array<{ t: number; s: number }>;
}

/** Retângulo projetado numa vista: `u` é a horizontal (t na elevação, s no corte) e `z` a altura. */
export interface ProjectedRing {
  part: OpeningPart;
  ring: Array<{ u: number; z: number }>;
  /** Profundidade média no eixo de visão, para a ordem de pintura. */
  depth: number;
}

const BOX_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

function boxCorners(b: PartBox): ModelPoint[] {
  const { t0, t1, s0, s1, z0, z1 } = b;
  return [
    { t: t0, s: s0, z: z0 },
    { t: t1, s: s0, z: z0 },
    { t: t1, s: s1, z: z0 },
    { t: t0, s: s1, z: z0 },
    { t: t0, s: s0, z: z1 },
    { t: t1, s: s0, z: z1 },
    { t: t1, s: s1, z: z1 },
    { t: t0, s: s1, z: z1 },
  ];
}

/**
 * Painel `index` de uma cadeia dobrável: gira em torno da própria dobradiça de ângulo alternado (±θ) e a dobradiça anda
 * junto com o fim do painel anterior; a ponta livre recua ao dobrar. Com θ = 0 todo painel fica onde estava.
 */
function foldPoint(p: ModelPoint, m: Extract<PartMotion, { kind: 'fold' }>, theta: number): ModelPoint {
  let ht = m.tAnchor;
  let hs = m.s;
  for (let j = 0; j < m.index; j++) {
    const a = (j % 2 === 0 ? 1 : -1) * m.sign * theta;
    ht += m.panelWidth * m.dir * Math.cos(a);
    hs += m.panelWidth * Math.sin(a);
  }
  const alpha = (m.index % 2 === 0 ? 1 : -1) * m.sign * theta;
  const phi = m.dir * alpha;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dt = p.t - (m.tAnchor + m.dir * m.index * m.panelWidth);
  const ds = p.s - m.s;
  return { t: ht + dt * cos - ds * sin, s: hs + dt * sin + ds * cos, z: p.z };
}

function movePoint(p: ModelPoint, motion: PartMotion | undefined, state: OpenState): ModelPoint {
  if (!motion) return { ...p };
  if (motion.kind === 'slide') {
    const k = Math.min(1, Math.max(0, Number.isFinite(state.slide) ? state.slide : 0));
    return {
      t: p.t + motion.dt * motion.travel * k,
      s: p.s + motion.ds * motion.travel * k,
      z: p.z + motion.dz * motion.travel * k,
    };
  }
  const angle = Number.isFinite(state.angle) ? state.angle : 0;
  if (motion.kind === 'fold') return foldPoint(p, motion, angle);
  const phi = motion.sign * angle;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  if (motion.axis === 'z') {
    const dt = p.t - motion.t;
    const ds = p.s - motion.s;
    return { t: motion.t + dt * cos - ds * sin, s: motion.s + dt * sin + ds * cos, z: p.z };
  }
  const ds = p.s - motion.s;
  const dz = p.z - motion.z;
  return { t: p.t, s: motion.s + ds * cos - dz * sin, z: motion.z + ds * sin + dz * cos };
}

/** Caixa orientada da peça depois de aplicar o estado de abertura (`angle` em radianos, `slide` 0..1). */
export function partTransformed(part: OpeningPart, state: OpenState): OrientedBox {
  const corners = boxCorners(part.box).map((p) => movePoint(p, part.motion, state));
  let t0 = Infinity;
  let t1 = -Infinity;
  let s0 = Infinity;
  let s1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  let ct = 0;
  let cs = 0;
  let cz = 0;
  for (const p of corners) {
    t0 = Math.min(t0, p.t);
    t1 = Math.max(t1, p.t);
    s0 = Math.min(s0, p.s);
    s1 = Math.max(s1, p.s);
    z0 = Math.min(z0, p.z);
    z1 = Math.max(z1, p.z);
    ct += p.t;
    cs += p.s;
    cz += p.z;
  }
  return {
    corners,
    center: { t: ct / corners.length, s: cs / corners.length, z: cz / corners.length },
    bounds: { t0, t1, s0, s1, z0, z1 },
  };
}

function addUnique(list: Array<{ t: number; s: number }>, p: { t: number; s: number }): void {
  for (const q of list) if (Math.abs(q.t - p.t) < 1e-9 && Math.abs(q.s - p.s) < 1e-9) return;
  list.push(p);
}

function polygonArea(ring: Array<{ t: number; s: number }>): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p.t * q.s - q.t * p.s;
  }
  return a / 2;
}

function crossSection(corners: ModelPoint[], z: number): Array<{ t: number; s: number }> {
  const pts: Array<{ t: number; s: number }> = [];
  const eps = 1e-9;
  for (const [ia, ib] of BOX_EDGES) {
    const a = corners[ia]!;
    const b = corners[ib]!;
    const za = a.z - z;
    const zb = b.z - z;
    if (Math.abs(za) <= eps && Math.abs(zb) <= eps) {
      addUnique(pts, { t: a.t, s: a.s });
      addUnique(pts, { t: b.t, s: b.s });
    } else if (Math.abs(za) <= eps) {
      addUnique(pts, { t: a.t, s: a.s });
    } else if (Math.abs(zb) <= eps) {
      addUnique(pts, { t: b.t, s: b.s });
    } else if (za * zb < 0) {
      const k = za / (za - zb);
      addUnique(pts, { t: a.t + (b.t - a.t) * k, s: a.s + (b.s - a.s) * k });
    }
  }
  if (pts.length < 3) return [];
  let ct = 0;
  let cs = 0;
  for (const p of pts) {
    ct += p.t;
    cs += p.s;
  }
  ct /= pts.length;
  cs /= pts.length;
  pts.sort((p, q) => Math.atan2(p.s - cs, p.t - ct) - Math.atan2(q.s - cs, q.t - ct));
  return Math.abs(polygonArea(pts)) > 1e-12 ? pts : [];
}

/** Corte horizontal do modelo na altura `z`, no estado pedido: as peças que o plano atravessa com o anel (t, s). */
export function slicePartsAtZ(m: OpeningModel, z: number, state: OpenState): SliceRing[] {
  const out: SliceRing[] = [];
  for (const part of m.parts) {
    const ob = partTransformed(part, state);
    if (z < ob.bounds.z0 - 1e-9 || z > ob.bounds.z1 + 1e-9) continue;
    const ring = crossSection(ob.corners, z);
    if (ring.length) out.push({ part, ring });
  }
  return out;
}

function convexHull(points: Array<{ u: number; z: number }>): Array<{ u: number; z: number }> {
  const pts = [...points].sort((a, b) => a.u - b.u || a.z - b.z);
  const uniq: Array<{ u: number; z: number }> = [];
  for (const p of pts) {
    const last = uniq[uniq.length - 1];
    if (!last || Math.abs(last.u - p.u) > 1e-9 || Math.abs(last.z - p.z) > 1e-9) uniq.push(p);
  }
  if (uniq.length <= 2) return uniq;
  const cross = (o: { u: number; z: number }, a: { u: number; z: number }, b: { u: number; z: number }): number =>
    (a.u - o.u) * (b.z - o.z) - (a.z - o.z) * (b.u - o.u);
  const lower: Array<{ u: number; z: number }> = [];
  for (const p of uniq) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<{ u: number; z: number }> = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    const p = uniq[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/**
 * Projeção ortográfica das peças: `axis = 's'` é a elevação (horizontal em `t`, observada ao longo de `s`); `axis =
 * 't'` é o corte transversal (horizontal em `s`, observado ao longo de `t`).
 */
export function projectParts(m: OpeningModel, axis: 's' | 't', state: OpenState): ProjectedRing[] {
  const out: ProjectedRing[] = [];
  for (const part of m.parts) {
    const ob = partTransformed(part, state);
    let depth = 0;
    const projected = ob.corners.map((p) => {
      if (axis === 's') {
        depth += p.s;
        return { u: p.t, z: p.z };
      }
      depth += p.t;
      return { u: p.s, z: p.z };
    });
    const ring = convexHull(projected);
    if (ring.length < 3) continue;
    out.push({ part, ring, depth: depth / ob.corners.length });
  }
  return out;
}
