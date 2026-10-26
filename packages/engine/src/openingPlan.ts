import { partTransformed, slicePartsAtZ } from './openingModel.ts';
import {
  CLOSED,
  type LeafOpening,
  type OpeningModel,
  type OpeningPart,
  type PartBox,
  type PartMotion,
  type PartRole,
} from './openingModelTypes.ts';

/** Tom do traço na planta: `cut` é o perfil cortado (tinta forte), `ink` o desenho de tinta e `soft` o secundário. */
export type OpeningPlanTone = 'cut' | 'ink' | 'soft';

/** Papel do traço: o da peça do modelo, ou um símbolo da planta (arco, seta, marca). */
export type OpeningPlanRole = PartRole | 'swing' | 'arrow' | 'mark';

/** Ponto no sistema local do vão (`t` ao longo da parede, `s` na profundidade). */
export interface OpeningPlanPoint {
  t: number;
  s: number;
}

/** Um traço da planta da esquadria, em coordenadas locais do vão. */
export interface OpeningPlanPath {
  pts: OpeningPlanPoint[];
  closed: boolean;
  /** Fator sobre a espessura base do desenho (1 = traço principal). */
  weight: number;
  tone: OpeningPlanTone;
  dash?: [number, number];
  role: OpeningPlanRole;
}

/** Opções da planta: nível de detalhe, abertura, convenção de exibição e cota de corte (z local do modelo). */
export interface OpeningPlanOptions {
  detail: 'low' | 'mid' | 'high';
  /** Ângulo de abertura em planta (radianos), como `OpenState.angle`. */
  angle: number;
  planDisplay: 'symbolic' | 'projected';
  showSwing: boolean;
  swingStyle: 'arc' | 'dash' | 'line';
  /** Cota de corte no z local do modelo (0 = soleira do vão). */
  cutZ: number;
}

const EPS = 1e-9;
const ARC_STEP = Math.PI / 18;

const FRAME_ROLES: ReadonlySet<PartRole> = new Set<PartRole>([
  'jamb',
  'stop',
  'head',
  'sillFrame',
  'threshold',
  'track',
  'muntin',
  'pocket',
]);

const line = (pts: OpeningPlanPoint[], role: OpeningPlanRole, tone: OpeningPlanTone = 'ink', weight = 1, dash?: [number, number]): OpeningPlanPath => ({
  pts,
  closed: false,
  weight,
  tone,
  ...(dash ? { dash } : {}),
  role,
});

const polygon = (pts: OpeningPlanPoint[], role: OpeningPlanRole, tone: OpeningPlanTone = 'cut', weight = 1, dash?: [number, number]): OpeningPlanPath => ({
  pts,
  closed: true,
  weight,
  tone,
  ...(dash ? { dash } : {}),
  role,
});

/** Anel do retângulo da caixa (t0,s0) → (t1,s0) → (t1,s1) → (t0,s1). */
function boxRing(b: PartBox): OpeningPlanPoint[] {
  return [
    { t: b.t0, s: b.s0 },
    { t: b.t1, s: b.s0 },
    { t: b.t1, s: b.s1 },
    { t: b.t0, s: b.s1 },
  ];
}

function unionBox(a: PartBox | null, b: PartBox): PartBox {
  if (!a) return { ...b };
  return {
    t0: Math.min(a.t0, b.t0),
    t1: Math.max(a.t1, b.t1),
    s0: Math.min(a.s0, b.s0),
    s1: Math.max(a.s1, b.s1),
    z0: Math.min(a.z0, b.z0),
    z1: Math.max(a.z1, b.z1),
  };
}

/** Caixa da folha `index` (união das peças `leaf` dela); null se não houver. */
function leafBox(m: OpeningModel, index: number): PartBox | null {
  let out: PartBox | null = null;
  for (const part of m.parts) {
    if (part.role === 'leaf' && part.leaf === index) out = unionBox(out, part.box);
  }
  return out;
}

/** Movimento da folha `index` (a primeira peça com movimento), ou undefined. */
function leafMotion(m: OpeningModel, index: number): PartMotion | undefined {
  return m.parts.find((p) => p.role === 'leaf' && p.leaf === index && p.motion)?.motion;
}

/** Anel da caixa depois do movimento (face inferior; para giro em z e deslizamento é a mesma planta). */
function transformedRing(box: PartBox, motion: PartMotion | undefined, angle: number): OpeningPlanPoint[] {
  const synthetic: OpeningPart = { id: '__leaf', role: 'leaf', material: 'leaf', box, ...(motion ? { motion } : {}) };
  const ob = partTransformed(synthetic, { angle, slide: 0 });
  return ob.corners.slice(0, 4).map((p) => ({ t: p.t, s: p.s }));
}

function rotatePoint(p: OpeningPlanPoint, center: OpeningPlanPoint, phi: number): OpeningPlanPoint {
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dt = p.t - center.t;
  const ds = p.s - center.s;
  return { t: center.t + dt * cos - ds * sin, s: center.s + dt * sin + ds * cos };
}

/** Arco de `from` em torno de `center`, varrendo `sweep` radianos (o sinal define o sentido). */
function arcPoints(center: OpeningPlanPoint, from: OpeningPlanPoint, sweep: number): OpeningPlanPoint[] {
  const r = Math.hypot(from.t - center.t, from.s - center.s);
  if (r < EPS) return [];
  const a0 = Math.atan2(from.s - center.s, from.t - center.t);
  const steps = Math.max(8, Math.ceil(Math.abs(sweep) / ARC_STEP));
  const pts: OpeningPlanPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (sweep * i) / steps;
    pts.push({ t: center.t + Math.cos(a) * r, s: center.s + Math.sin(a) * r });
  }
  return pts;
}

/** Sinal do giro da folha, o mesmo de `partTransformed`: peça em `z` com movimento, ou a regra do lado. */
function openingSign(o: LeafOpening, motion: PartMotion | undefined): 1 | -1 {
  if (motion && motion.kind === 'rotate' && motion.axis === 'z') return motion.sign;
  return (o.side * (o.latchT > o.hingeT ? 1 : -1)) as 1 | -1;
}

/** Arco (ou reta) do fecho de `closedEnd` até a folha aberta, no estilo pedido. */
function addOpeningArc(out: OpeningPlanPath[], center: OpeningPlanPoint, closedEnd: OpeningPlanPoint, sweep: number, style: 'arc' | 'dash' | 'line'): void {
  if (Math.abs(sweep) < EPS) return;
  const openEnd = rotatePoint(closedEnd, center, sweep);
  if (style === 'line') {
    out.push(line([closedEnd, openEnd], 'swing', 'soft', 0.7));
    return;
  }
  const pts = arcPoints(center, closedEnd, sweep);
  if (pts.length >= 2) out.push(line(pts, 'swing', 'soft', 0.7, style === 'dash' ? [4, 3] : undefined));
}

/** Perfis do batente/caixilho cortados na cota `z` (peças fixas). */
function addFrameCut(out: OpeningPlanPath[], m: OpeningModel, z: number): void {
  for (const { part, ring } of slicePartsAtZ(m, z, CLOSED)) {
    if (FRAME_ROLES.has(part.role)) out.push(polygon(ring, part.role, 'cut', 1));
  }
}

/** Três linhas da janela (faces do caixilho e plano médio), de `-W/2` a `+W/2`. */
function addWindowLines(out: OpeningPlanPath[], m: OpeningModel): void {
  let s0 = -m.thickness / 2;
  let s1 = m.thickness / 2;
  const jamb = m.parts.find((p) => p.role === 'jamb') ?? m.parts.find((p) => p.role === 'sillFrame');
  if (jamb) {
    s0 = jamb.box.s0;
    s1 = jamb.box.s1;
  }
  const hw = m.width / 2;
  out.push(line([{ t: -hw, s: s0 }, { t: hw, s: s0 }], 'jamb', 'ink', 1));
  out.push(line([{ t: -hw, s: s1 }, { t: hw, s: s1 }], 'jamb', 'ink', 1));
  out.push(line([{ t: -hw, s: (s0 + s1) / 2 }, { t: hw, s: (s0 + s1) / 2 }], 'glass', 'ink', 0.8));
}

/** Pistas dos trilhos: duas linhas por trilho, ao longo do vão. */
function addTracks(out: OpeningPlanPath[], m: OpeningModel): void {
  for (const part of m.parts) {
    if (part.role !== 'track') continue;
    out.push(line([{ t: part.box.t0, s: part.box.s0 }, { t: part.box.t1, s: part.box.s0 }], 'track', 'soft', 0.6));
    out.push(line([{ t: part.box.t0, s: part.box.s1 }, { t: part.box.t1, s: part.box.s1 }], 'track', 'soft', 0.6));
  }
}

/** Seta de deslocamento das folhas de correr, no sentido do movimento. */
function addSlideArrow(out: OpeningPlanPath[], m: OpeningModel): void {
  const moving = m.parts.find((p) => p.role === 'leaf' && p.motion?.kind === 'slide' && p.motion.travel > 0)?.motion;
  const dir = moving && moving.kind === 'slide' && moving.dt !== 0 ? Math.sign(moving.dt) : 1;
  const hw = m.width / 2;
  const s = (m.core.s0 + m.core.s1) / 2;
  const a = { t: -hw * 0.6, s };
  const b = { t: hw * 0.6, s };
  const from = dir >= 0 ? a : b;
  const tip = dir >= 0 ? b : a;
  out.push(line([from, tip], 'arrow', 'ink', 0.8));
  const back = hw * 0.15;
  const head = hw * 0.08;
  out.push(line([{ t: tip.t - dir * back, s: s + head }, tip, { t: tip.t - dir * back, s: s - head }], 'arrow', 'ink', 0.8));
}

/** Vão livre: as duas bordas nas faces da parede, tracejadas (sem X, como na decisão 0024 §3). */
function addVoid(out: OpeningPlanPath[], m: OpeningModel): void {
  const hw = m.width / 2;
  out.push(line([{ t: -hw, s: -m.thickness / 2 }, { t: hw, s: -m.thickness / 2 }], 'mark', 'soft', 0.7, [6, 3]));
  out.push(line([{ t: -hw, s: m.thickness / 2 }, { t: hw, s: m.thickness / 2 }], 'mark', 'soft', 0.7, [6, 3]));
}

/** Janela fixa/maxim-ar/basculante: arco tracejado (maxim-ar) ou V (basculante) do lado de `flipFacing`. */
function addWindowOpening(out: OpeningPlanPath[], m: OpeningModel, o: LeafOpening): void {
  const hw = m.width / 2;
  const s = (m.core.s0 + m.core.s1) / 2;
  if (o.kind === 'top') {
    const pts: OpeningPlanPoint[] = [];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = -hw + (2 * hw * i) / steps;
      pts.push({ t, s: s + o.side * hw * 0.5 * (1 - (t / hw) ** 2) });
    }
    out.push(line(pts, 'swing', 'soft', 0.8, [4, 3]));
    return;
  }
  if (o.kind === 'bottom') {
    out.push(line([{ t: -hw, s }, { t: 0, s: s + o.side * hw * 0.5 }, { t: hw, s }], 'swing', 'soft', 0.8));
  }
}

/** Peças fora do corte que o nível alto mostra: alizar, peitoril, verga/contraverga e o vidro duplo. */
function addHighExtras(out: OpeningPlanPath[], m: OpeningModel, z: number): void {
  for (const { part, ring } of slicePartsAtZ(m, z, CLOSED)) {
    if (part.role === 'casing') out.push(polygon(ring, 'casing', 'ink', 0.8));
  }
  for (const part of m.parts) {
    if (part.role === 'sillBoard') {
      out.push(polygon(boxRing(part.box), 'sillBoard', 'soft', 0.7, [6, 3]));
    } else if (part.role === 'lintel' || part.role === 'sillBeam') {
      const above = part.box.z0 >= z - EPS;
      const below = part.box.z1 <= z + EPS;
      if (above || below) out.push(polygon(boxRing(part.box), part.role, 'soft', 0.7, [6, 3]));
      else out.push(polygon(boxRing(part.box), part.role, 'cut', 1));
    } else if (part.role === 'glass') {
      out.push(line([{ t: part.box.t0, s: part.box.s0 }, { t: part.box.t1, s: part.box.s0 }], 'glass', 'soft', 0.5));
      out.push(line([{ t: part.box.t0, s: part.box.s1 }, { t: part.box.t1, s: part.box.s1 }], 'glass', 'soft', 0.5));
    } else if (part.role === 'leaf' && part.leaf === undefined) {
      out.push(polygon(boxRing(part.box), 'leaf', 'cut', 1));
    }
  }
}

/** Desenho de uma porta (giro, dupla, pivotante, correr e vão livre) nos níveis baixo/médio/alto. */
function doorPaths(out: OpeningPlanPath[], m: OpeningModel, opts: OpeningPlanOptions): void {
  const level = opts.planDisplay === 'projected' ? 'high' : opts.detail;
  if (m.void) {
    addVoid(out, m);
    return;
  }
  if (level === 'low') {
    for (const o of m.openings) {
      const box = leafBox(m, o.leaf);
      if (!box) continue;
      const s = (box.s0 + box.s1) / 2;
      out.push(line([{ t: box.t0, s }, { t: box.t1, s }], 'leaf', 'ink', 1));
    }
    return;
  }
  addFrameCut(out, m, opts.cutZ);
  const sliding = m.openings.some((o) => o.kind === 'slide');
  if (sliding) {
    for (const o of m.openings) {
      const box = leafBox(m, o.leaf);
      if (box) out.push(polygon(boxRing(box), 'leaf', 'cut', 1));
    }
    addTracks(out, m);
    addSlideArrow(out, m);
  } else {
    for (const o of m.openings) {
      const box = leafBox(m, o.leaf);
      if (!box) continue;
      if (level === 'high') out.push(polygon(boxRing(box), 'leaf', 'cut', 1));
      const motion = leafMotion(m, o.leaf);
      out.push(polygon(transformedRing(box, motion, opts.angle), 'leaf', 'cut', 1));
      if (!opts.showSwing) continue;
      const sign = openingSign(o, motion);
      const center = { t: o.pivot.t, s: o.pivot.s };
      if (o.kind === 'pivot') {
        addOpeningArc(out, center, { t: box.t0, s: o.pivot.s }, sign * opts.angle, opts.swingStyle);
        addOpeningArc(out, center, { t: box.t1, s: o.pivot.s }, sign * opts.angle, opts.swingStyle);
      } else {
        addOpeningArc(out, center, { t: o.latchT, s: o.pivot.s }, sign * opts.angle, opts.swingStyle);
      }
    }
  }
  if (level === 'high') addHighExtras(out, m, opts.cutZ);
}

/** Desenho de uma janela (fixa, maxim-ar, basculante, correr e vão livre) nos níveis baixo/médio/alto. */
function windowPaths(out: OpeningPlanPath[], m: OpeningModel, opts: OpeningPlanOptions): void {
  const level = opts.planDisplay === 'projected' ? 'high' : opts.detail;
  if (m.void) {
    addVoid(out, m);
    return;
  }
  if (level === 'low') {
    addWindowLines(out, m);
    return;
  }
  addFrameCut(out, m, opts.cutZ);
  addWindowLines(out, m);
  const sliding = m.openings.some((o) => o.kind === 'slide');
  const opening = m.openings.find((o) => o.kind === 'top' || o.kind === 'bottom');
  if (sliding) {
    for (const o of m.openings) {
      const box = leafBox(m, o.leaf);
      if (box) out.push(polygon(boxRing(box), 'leaf', 'cut', 1));
    }
    addTracks(out, m);
    addSlideArrow(out, m);
  } else if (opening) {
    addWindowOpening(out, m, opening);
    if (level === 'high') {
      const box = leafBox(m, opening.leaf);
      if (box) out.push(polygon(boxRing(box), 'leaf', 'cut', 1));
    }
  } else if (level === 'high') {
    for (const o of m.openings) {
      const box = leafBox(m, o.leaf);
      if (box) out.push(polygon(boxRing(box), 'leaf', 'cut', 1));
    }
  }
  if (level === 'high') addHighExtras(out, m, opts.cutZ);
}

/**
 * Planta da esquadria a partir do modelo único (spec E §4.1), em coordenadas locais do vão. `low` só mostra a folha
 * fechada (e as três linhas da janela), `mid` corta os perfis e abre a folha com o arco, e `high` acrescenta a folha
 * fechada, alizar, peitoril, verga e o vidro duplo. `planDisplay = 'projected'` força o nível alto.
 */
export function openingPlanPaths(m: OpeningModel, opts: OpeningPlanOptions): OpeningPlanPath[] {
  const out: OpeningPlanPath[] = [];
  if (m.kind === 'door') doorPaths(out, m, opts);
  else windowPaths(out, m, opts);
  return out;
}
