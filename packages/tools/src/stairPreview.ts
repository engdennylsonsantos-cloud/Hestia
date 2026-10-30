import { add, applyTransform, mul, type Transform, type Vec2 } from '@hestia/geom';
import { arrivalFrameFrom, arrivalUnderside, sampleChain, sampleCurve, stairRunSteps } from '@hestia/engine';
import type { Id, Project, Stair, StairCurve, StairLanding, StairRun, StairType } from '@hestia/model';
import type { PreviewItem } from './types.ts';
import { runSketch, type RunDraft, type StairPart, type StairTone } from './stairSketchState.ts';

/** Segmentos de prévia de uma reta ou de um arco (amostrado com erro de corda de 0,3 mm). */
export function curveItems(c: StairCurve, tone: StairTone | undefined, dashed = false): PreviewItem[] {
  const pts = sampleCurve(c);
  const out: PreviewItem[] = [];
  for (let i = 1; i < pts.length; i++) out.push({ kind: 'line', a: pts[i - 1]!, b: pts[i]!, dashed, tone });
  return out;
}

export function chainItems(cs: StairCurve[], tone: StairTone | undefined, dashed = false): PreviewItem[] {
  return cs.flatMap((c) => curveItems(c, tone, dashed));
}

/** Prévia dos componentes em ordem: limites, espelhos, caminhada (lances) e contorno (patamares). */
export function partsPreview(parts: StairPart[], dashed = false): PreviewItem[] {
  const out: PreviewItem[] = [];
  for (const p of parts) {
    if (p.kind === 'landing') {
      if (p.landing.boundary.length) out.push({ kind: 'polygon', ring: sampleChain(p.landing.boundary), dashed, tone: 'landing' });
      continue;
    }
    out.push(...runPreview(p.run, dashed));
  }
  return out;
}

function runPreview(r: RunDraft, dashed: boolean): PreviewItem[] {
  return [
    ...chainItems(r.boundaryLeft, 'boundary', dashed),
    ...chainItems(r.boundaryRight, 'boundary', dashed),
    ...chainItems(r.risers, 'riser', dashed),
    ...chainItems(r.path, 'path', dashed),
  ];
}

/**
 * Contexto da prévia dos degraus: o mesmo que decide a chegada no modelo (decisão 0012 §2). Só o lance monolítico que
 * fecha o nível tem chegada, e só quando nenhuma laje/piso do nível de topo cobre o último espelho.
 */
export interface TreadPreviewContext {
  /** Projeto: a laje ou o piso que cobre o último espelho é o que dispensa o degrau de chegada. */
  project: Project;
  /** Tipo da escada criada/editada: só o estilo monolítico tem chegada (montada e poste, não). */
  type: StairType | null;
  /** Nível de topo explícito, como no modelo; `null` = sem cobertura (a chegada fecha no próprio `topZ`). */
  topLevelId: Id | null;
  /** Nº de espelhos N do croqui: a chegada vem depois do último espelho do lance de topo. */
  risers: number;
  /** Altura real do espelho h = H ÷ N (m); `null` = sem prévia. */
  riserHeight: number | null;
}

/**
 * Degraus calculados (`stairRunSteps`) de cada lance válido, com a altura real do espelho, mais a chegada quando ela é um
 * degrau da própria escada. Sem erro, sem prévia.
 *
 * Chegada (decisão 0012 §2): no lance monolítico que fecha o nível, a frente sai dos dois últimos espelhos
 * (`arrivalFrameFrom`, até 0,30 m). Se uma laje ou piso do nível de topo cobre essa faixa (`arrivalUnderside`), a escada
 * termina no último espelho e não há degrau a mais; sem cobertura, a escada criada ganha um piso de chegada flush com o
 * nível (`topZ`) e a prévia mostra o mesmo (WYSIWYG).
 */
export function treadItems(parts: StairPart[], ctx: TreadPreviewContext): PreviewItem[] {
  const { riserHeight } = ctx;
  if (riserHeight === null) return [];
  const out: PreviewItem[] = [];
  let top: Array<{ a: Vec2; b: Vec2 }> | null = null;
  parts.forEach((p, i) => {
    if (p.kind !== 'run') return;
    const steps = stairRunSteps(runSketch(p.run), { baseZ: 0, riserHeight });
    for (const t of steps.treads) out.push({ kind: 'polygon', ring: t.polygon, tone: 'tread' });
    // Só o último componente pode ser o lance de topo; os espelhos vêm na ordem de subida e aparados como no modelo.
    if (i === parts.length - 1) top = steps.risers;
  });
  const arrival = arrivalPreviewRing(parts, top, ctx);
  if (arrival) out.push({ kind: 'polygon', ring: arrival, tone: 'tread' });
  return out;
}

/**
 * Anel da chegada para a prévia, ou null quando ela não é um degrau: estilo não monolítico, último componente não é um
 * lance, espelhos insuficientes, contagem diferente de N (o lance não fecha o croqui) ou laje/piso cobrindo o último
 * espelho. Puro e barato: só os dois últimos espelhos (já calculados para os degraus) e a cobertura do nível, sem
 * `resolveStairs` nem booleanas.
 */
function arrivalPreviewRing(parts: StairPart[], top: Array<{ a: Vec2; b: Vec2 }> | null, ctx: TreadPreviewContext): Vec2[] | null {
  const { project, type, topLevelId, risers } = ctx;
  if (type?.runStyle !== 'monolithic' || !(risers > 0) || !top) return null;
  const total = parts.reduce((n, p) => n + (p.kind === 'run' ? p.run.risers.length : 0), 0);
  if (total !== risers) return null;
  const frame = top.length >= 2 ? arrivalFrameFrom(top[top.length - 1]!, top[top.length - 2]!) : null;
  if (!frame || arrivalUnderside(project, frame, topLevelId) !== null) return null;
  const { a, b, u, length } = frame;
  return [a, b, add(b, mul(u, length)), add(a, mul(u, length))];
}

/** Prévia tracejada da escada sob uma transformação (mover, girar, espelhar), como os fantasmas das paredes. */
export function ghostStairItems(s: Stair, t: Transform): PreviewItem[] {
  const map = (c: StairCurve): StairCurve => ({ a: applyTransform(t, c.a), b: applyTransform(t, c.b), sag: t.kind === 'mirror' ? -c.sag : c.sag });
  const parts: StairPart[] = s.components.map((c): StairPart => {
    if (c.kind === 'landing') return { kind: 'landing', landing: { boundary: c.boundary.map(map) } };
    return { kind: 'run', run: { boundaryLeft: c.boundaryLeft.map(map), boundaryRight: c.boundaryRight.map(map), risers: c.risers.map(map), path: c.path.map(map) } };
  });
  return partsPreview(parts, true);
}

/** Prévia de componentes do modelo (alças, arrasto). */
export function componentsPreview(cs: Array<StairRun | StairLanding>, dashed = false): PreviewItem[] {
  return partsPreview(
    cs.map((c): StairPart => (c.kind === 'landing' ? { kind: 'landing', landing: { boundary: c.boundary } } : { kind: 'run', run: c })),
    dashed,
  );
}
