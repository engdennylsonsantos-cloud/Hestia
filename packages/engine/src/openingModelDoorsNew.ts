import {
  coreSpan,
  openingFrame,
  openingFrameDepth,
  openingFrameStyle,
  openingHandle,
  openingLeafStyle,
  type Opening,
  type OpeningFrameStyle,
  type OpeningHandle,
  type OpeningLeafStyle,
  type OpeningType,
  type Project,
} from '@hestia/model';
import type { WallFrame } from './frame.ts';
import type { OpeningGeometry } from './types.ts';
import type { LeafOpening, OpeningPart, PartBox, PartMaterial, PartMotion, PartRole } from './openingModelTypes.ts';

/** Mesmas folgas da porta de giro (spec E §3). */
const GAP = 0.004;

interface Ctx {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  f: WallFrame;
  t: OpeningType;
  core: { s0: number; s1: number };
  C: number;
  Cd: number;
  hw: number;
  H: number;
  thickness: number;
  J: number;
  D: number;
  L: number;
  side: 1 | -1;
  h: 1 | -1;
  frameStyle: OpeningFrameStyle;
  leafStyle: OpeningLeafStyle;
  handle: OpeningHandle;
  parts: OpeningPart[];
  openings: LeafOpening[];
}

/** Núcleo da parede em `s` local, igual a `openingCore` do modelo (sem importar o módulo, para evitar ciclo). */
function coreOf(f: WallFrame): { s0: number; s1: number } {
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

function addPart(
  c: Ctx,
  id: string,
  role: PartRole,
  material: PartMaterial,
  b: PartBox,
  motion?: PartMotion,
  leaf?: number,
  dashed?: boolean,
): void {
  if (!validBox(b)) return;
  c.parts.push({ id, role, material, box: b, ...(motion ? { motion } : {}), ...(leaf !== undefined ? { leaf } : {}), ...(dashed ? { dashed } : {}) });
}

function makeCtx(p: Project, o: Opening, g: OpeningGeometry, f: WallFrame): Ctx | null {
  const t = p.openingTypes[o.typeId];
  if (!t) return null;
  const core = coreOf(f);
  const coreWidth = core.s1 - core.s0;
  const fr = openingFrame(t, coreWidth);
  const frameStyle = openingFrameStyle(t);
  const J = frameStyle === 'aduela' ? 0.03 : fr.frameWidth;
  const fd = openingFrameDepth(t, f.thickness, coreWidth);
  const mode = t.frameDepthMode ?? 'wall';
  const D = frameStyle === 'aduela' ? coreWidth : fd.depth;
  const Cd =
    frameStyle === 'aduela' || mode === 'core'
      ? (core.s0 + core.s1) / 2
      : mode === 'fixed'
        ? Math.min(f.thickness / 2 - D / 2, Math.max(-f.thickness / 2 + D / 2, (core.s0 + core.s1) / 2))
        : fd.centerOffset;
  return {
    p,
    o,
    g,
    f,
    t,
    core,
    C: (core.s0 + core.s1) / 2,
    Cd,
    hw: g.width / 2,
    H: g.height,
    thickness: f.thickness,
    J,
    D,
    L: fr.leafThickness,
    side: g.flipFacing ? -1 : 1,
    h: g.flipHand ? 1 : -1,
    frameStyle,
    leafStyle: openingLeafStyle(t),
    handle: openingHandle(t),
    parts: [],
    openings: [],
  };
}

/** Batente simples (caixa J × D, sem batedor): duas ombreiras e a travessa. */
function buildSimpleFrame(c: Ctx, jambs: Array<1 | -1> = [-1, 1]): void {
  const body = { s0: c.Cd - c.D / 2, s1: c.Cd + c.D / 2 };
  for (const j of jambs) {
    addPart(c, `jamb-${j < 0 ? 'left' : 'right'}`, 'jamb', 'frame', box(j * (c.hw - c.J), j * c.hw, body.s0, body.s1, 0, c.H));
  }
  addPart(c, 'head', 'head', 'frame', box(-c.hw, c.hw, body.s0, body.s1, c.H - c.J, c.H));
}

const leafS = (c: Ctx): { s0: number; s1: number } => ({ s0: c.Cd - c.L / 2, s1: c.Cd + c.L / 2 });
const leafZ = (c: Ctx): { z0: number; z1: number } => ({ z0: 0.008, z1: Math.max(0.008, c.H - c.J - GAP) });

/** Maçaneta presa à folha (mesmo movimento), a 0,06 m do lado do trinco. */
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
  if (c.handle === 'pull') {
    const sCenter = sMid + c.side * (c.L / 2 + 0.015);
    addPart(c, `handle-${index}-pull`, 'handle', 'metal', box(-0.01, 0.01, sCenter - 0.015, sCenter + 0.015, z - 0.2, z + 0.2), motion, index);
    return;
  }
  if (c.handle === 'knob') {
    for (const face of [-1, 1] as const) {
      const sCenter = sMid + face * (c.L / 2 + 0.025);
      addPart(c, `handle-${index}-knob-${face < 0 ? 'a' : 'b'}`, 'handle', 'metal', box(tCenter - 0.025, tCenter + 0.025, sCenter - 0.025, sCenter + 0.025, z - 0.025, z + 0.025), motion, index);
    }
    return;
  }
  for (const face of [-1, 1] as const) {
    const sCenter = sMid + face * (c.L / 2 + 0.006);
    addPart(c, `handle-${index}-rosette-${face < 0 ? 'a' : 'b'}`, 'handle', 'metal', box(tCenter - 0.025, tCenter + 0.025, sCenter - 0.006, sCenter + 0.006, z - 0.025, z + 0.025), motion, index);
    const tHaste = tCenter + inward * 0.065;
    addPart(c, `handle-${index}-lever-${face < 0 ? 'a' : 'b'}`, 'handle', 'metal', box(tHaste - 0.065, tHaste + 0.065, sCenter - 0.006, sCenter + 0.006, z - 0.01, z + 0.01), motion, index);
  }
}

/** Folha sólida com a espessura L no plano do núcleo; a maçaneta entra no lado do trinco. */
function addLeaf(
  c: Ctx,
  index: number,
  t0: number,
  t1: number,
  z: { z0: number; z1: number },
  motion: PartMotion,
  latchT: number,
  comMacaneta = true,
): void {
  const s = leafS(c);
  addPart(c, `leaf-${index}`, 'leaf', 'leaf', box(t0, t1, s.s0, s.s1, z.z0, z.z1), motion, index);
  if (comMacaneta) addHandle(c, index, (t0 + t1) / 2, s, z.z0, z.z1, latchT, motion);
}

/** Vai-e-vem: batente simples, uma folha (dobradiça em `h`) ou duas (uma em cada ombreira), giro nos dois sentidos. */
function buildDoubleAction(c: Ctx): void {
  buildSimpleFrame(c);
  const z = leafZ(c);
  const half = c.hw - c.J;
  const n = c.g.leaves >= 2 ? 2 : 1;
  const width = n === 1 ? 2 * half : half - 0.002;
  for (let i = 0; i < n; i++) {
    const j = n === 1 ? c.h : i === 0 ? -1 : 1;
    const hingeT = j * half;
    const latchT = hingeT - j * width;
    const sign = (c.side * (hingeT < latchT ? 1 : -1)) as 1 | -1;
    const motion: PartMotion = { kind: 'rotate', axis: 'z', t: hingeT, s: c.Cd, sign };
    addLeaf(c, i, hingeT, latchT, z, motion, latchT);
    c.openings.push({
      leaf: i,
      kind: 'side',
      both: true,
      side: c.side,
      hingeT,
      latchT,
      pivot: { t: hingeT, s: c.Cd },
      radius: width,
      z0: z.z0,
      z1: z.z1,
    });
  }
}

/**
 * Embutir: batente simples só com a travessa e a ombreira do lado da abertura da folha; a folha corre para a cavidade
 * no lado da dobradiça. A cavidade começa na face interna dessa ombreira para conter a folha toda no estado aberto.
 */
function buildPocketDoor(c: Ctx): void {
  buildSimpleFrame(c, [-c.h as 1 | -1]);
  const z = leafZ(c);
  const width = 2 * (c.hw - c.J);
  const travel = width;
  const motion: PartMotion = { kind: 'slide', dt: c.h, ds: 0, dz: 0, travel };
  addLeaf(c, 0, -width / 2, width / 2, z, motion, c.h * width, false);
  const pocketIn = c.core.s0 + 0.02;
  const pocketOut = c.core.s1 - 0.02;
  const inicio = c.h * (c.hw - c.J);
  addPart(c, 'pocket', 'pocket', 'frame', box(inicio, inicio + c.h * width, pocketIn, pocketOut, z.z0, z.z1), undefined, undefined, true);
  c.openings.push({
    leaf: 0,
    kind: 'slide',
    slideAxis: 't',
    side: 0,
    hingeT: 0,
    latchT: 0,
    pivot: { t: 0, s: c.Cd },
    radius: width,
    z0: z.z0,
    z1: z.z1,
  });
}

/** Cadeia de painéis articulados: uma ou duas, ancoradas nas ombreiras e fechando no centro. */
function addFoldChains(c: Ctx, panels: number, chains: Array<1 | -1>, firstLeaf: number): number {
  buildSimpleFrame(c);
  const z = leafZ(c);
  const lh = c.hw - c.J - GAP;
  const panelWidth = (2 * lh) / panels;
  const perChain = panels / chains.length;
  let leaf = firstLeaf;
  for (const anchorSide of chains) {
    const tAnchor = anchorSide * (c.hw - c.J);
    const dir = (-anchorSide) as 1 | -1;
    const sign = (dir * c.side) as 1 | -1;
    for (let i = 0; i < perChain; i++) {
      const a = tAnchor + dir * i * panelWidth;
      const b = a + dir * panelWidth;
      const motion: PartMotion = { kind: 'fold', tAnchor, dir, s: c.Cd, sign, index: i, panelWidth };
      addPart(c, `leaf-${leaf}`, 'leaf', 'leaf', box(a, b, c.Cd - c.L / 2, c.Cd + c.L / 2, z.z0, z.z1), motion, leaf);
      leaf++;
    }
    c.openings.push({
      leaf: leaf - perChain,
      kind: 'fold',
      side: c.side,
      hingeT: tAnchor,
      latchT: tAnchor + dir * perChain * panelWidth,
      pivot: { t: tAnchor, s: c.Cd },
      radius: perChain * panelWidth,
      z0: z.z0,
      z1: z.z1,
    });
  }
  if (panels === 2 || panels === 4) {
    addPart(c, 'track-head', 'track', 'metal', box(-c.hw + c.J, c.hw - c.J, c.Cd - c.D / 2, c.Cd + c.D / 2, c.H - c.J - GAP - 0.01, c.H - c.J - GAP));
  }
  return leaf;
}

/** Dobrável: 2 painéis em uma cadeia ou 4 em duas cadeias (uma em cada ombreira). */
function buildBifoldDoor(c: Ctx): void {
  const panels = c.g.leaves >= 4 ? 4 : 2;
  if (panels === 4) addFoldChains(c, 4, [1, -1], 0);
  else addFoldChains(c, 2, [c.h], 0);
}

/** Sanfonada: cadeia única de 9 painéis estreitos, sem maçaneta. */
function buildAccordionDoor(c: Ctx): void {
  addFoldChains(c, 9, [c.h], 0);
}

/** Portão seccionado: cinco faixas de folha que sobem, com almofadas de relevo e trilhos laterais. */
function buildGarageDoor(c: Ctx): void {
  buildSimpleFrame(c);
  const z = leafZ(c);
  const band = (z.z1 - z.z0) / 5;
  const s = leafS(c);
  const motion: PartMotion = { kind: 'slide', dt: 0, ds: 0, dz: 1, travel: c.H };
  for (let i = 0; i < 5; i++) {
    const z0 = z.z0 + i * band;
    const z1 = i === 4 ? z.z1 : z0 + band;
    addPart(c, `leaf-${i}`, 'leaf', 'leaf', box(-c.hw + c.J, c.hw - c.J, s.s0, s.s1, z0, z1), motion, i);
    const mz = Math.min(0.03, (z1 - z0) * 0.15);
    const mt = Math.min(0.06, (2 * (c.hw - c.J)) * 0.05);
    addPart(
      c,
      `leaf-${i}-panel`,
      'leafPanel',
      'leaf',
      box(-c.hw + c.J + mt, c.hw - c.J - mt, s.s0 - 0.006, s.s1 + 0.006, z0 + mz, z1 - mz),
      motion,
      i,
    );
  }
  const comprimento = Math.min(c.H, 2.5);
  const face = c.side * (c.thickness / 2);
  for (const j of [-1, 1] as const) {
    addPart(
      c,
      `track-${j < 0 ? 'left' : 'right'}`,
      'track',
      'metal',
      box(j * c.hw, j * (c.hw - 0.03), face, face + c.side * comprimento, 0, c.H),
      undefined,
      undefined,
      true,
    );
  }
  c.openings.push({
    leaf: 0,
    kind: 'overhead',
    slideAxis: 'z',
    side: c.side,
    hingeT: 0,
    latchT: 0,
    pivot: { t: 0, s: c.Cd },
    radius: c.H,
    z0: z.z0,
    z1: z.z1,
  });
}

/** Peças das famílias novas de porta (spec E §3.5); null nas famílias que não são desta tarefa. */
export function buildNewDoorParts(
  p: Project,
  o: Opening,
  g: OpeningGeometry,
  f: WallFrame,
): { parts: OpeningPart[]; openings: LeafOpening[] } | null {
  const c = makeCtx(p, o, g, f);
  if (!c) return null;
  switch (c.t.plan) {
    case 'dblact':
      buildDoubleAction(c);
      break;
    case 'pocket':
      buildPocketDoor(c);
      break;
    case 'bifold':
      buildBifoldDoor(c);
      break;
    case 'accordion':
      buildAccordionDoor(c);
      break;
    case 'garage':
      buildGarageDoor(c);
      break;
    default:
      return null;
  }
  return { parts: c.parts, openings: c.openings };
}
