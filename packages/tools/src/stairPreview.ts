import { applyTransform, type Transform } from '@hestia/geom';
import { sampleChain, sampleCurve, stairRunSteps } from '@hestia/engine';
import type { Stair, StairCurve, StairLanding, StairRun } from '@hestia/model';
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

/** Degraus calculados (`stairRunSteps`) de cada lance válido, com a altura real do espelho. Sem erro, sem prévia. */
export function treadItems(parts: StairPart[], riserHeight: number | null): PreviewItem[] {
  if (riserHeight === null) return [];
  const out: PreviewItem[] = [];
  for (const p of parts) {
    if (p.kind !== 'run') continue;
    const { treads } = stairRunSteps(runSketch(p.run), { baseZ: 0, riserHeight });
    for (const t of treads) out.push({ kind: 'polygon', ring: t.polygon, tone: 'tread' });
  }
  return out;
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
