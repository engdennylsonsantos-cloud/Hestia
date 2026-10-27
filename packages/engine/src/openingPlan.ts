import type { LeafOpening, OpeningModel } from './openingModelTypes.ts';
import {
  addFrameCut,
  addHighExtras,
  addHingedPlan,
  addHungLines,
  addLouverPlan,
  addNewDoorPlan,
  addOpeningArc,
  addPivotWinPlan,
  addTracks,
  boxRing,
  leafBox,
  leafMotion,
  line,
  openingSign,
  polygon,
  transformedRing,
  type OpeningPlanOptions,
  type OpeningPlanPath,
  type OpeningPlanPoint,
} from './openingPlanNew.ts';

export type {
  OpeningPlanOptions,
  OpeningPlanPath,
  OpeningPlanPoint,
  OpeningPlanRole,
  OpeningPlanTone,
} from './openingPlanNew.ts';

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

/** Desenho de uma porta (giro, dupla, pivotante, correr e vão livre) nos níveis baixo/médio/alto. */
function doorPaths(out: OpeningPlanPath[], m: OpeningModel, opts: OpeningPlanOptions): void {
  const level = opts.planDisplay === 'projected' ? 'high' : opts.detail;
  if (m.void) {
    addVoid(out, m);
    return;
  }
  if (addNewDoorPlan(out, m, opts)) return;
  addFrameCut(out, m, opts.cutZ);
  const sliding = m.openings.some((o) => o.kind === 'slide');
  if (sliding) {
    // Correr mantém o desenho próprio (folhas fechadas + pistas + seta).
    for (const o of m.openings) {
      const box = leafBox(m, o.leaf);
      if (box) out.push(polygon(boxRing(box), 'leaf', 'cut', 1));
    }
    addTracks(out, m);
    addSlideArrow(out, m);
  } else {
    // Folhas de giro: só a folha ABERTA, em todos os níveis (spec E3 §6); a fechada não é desenhada.
    for (const o of m.openings) {
      const box = leafBox(m, o.leaf);
      if (!box) continue;
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
  const hung = m.openings.some((o) => o.kind === 'slide' && o.slideAxis === 'z');
  if (level === 'low') {
    if (hung) addHungLines(out, m);
    else addWindowLines(out, m);
    return;
  }
  addFrameCut(out, m, opts.cutZ);
  if (hung) {
    addHungLines(out, m);
    if (level === 'high') addHighExtras(out, m, opts.cutZ);
    return;
  }
  addWindowLines(out, m);
  if (m.openings.some((o) => o.kind === 'louver')) {
    addLouverPlan(out, m);
    if (level === 'high') addHighExtras(out, m, opts.cutZ);
    return;
  }
  if (m.openings.some((o) => o.kind === 'side')) {
    addHingedPlan(out, m, opts);
    if (level === 'high') addHighExtras(out, m, opts.cutZ);
    return;
  }
  if (m.openings.some((o) => o.kind === 'pivot')) {
    addPivotWinPlan(out, m, opts);
    if (level === 'high') addHighExtras(out, m, opts.cutZ);
    return;
  }
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
    // Maxim-ar/basculante: só o símbolo de abertura, sem a folha fechada (spec E3 §6).
    addWindowOpening(out, m, opening);
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
