import { applyTransform, type Transform } from '@hestia/geom';
import { stairRunSteps } from '@hestia/engine';
import type { Ramp, StairCurve, StairLanding } from '@hestia/model';
import type { PreviewItem } from './types.ts';
import { partsPreview } from './stairPreview.ts';
import { runSketch, type StairPart } from './stairSketchState.ts';
import type { RampPlan } from '@hestia/engine';

/** Componentes do plano no formato da prévia (lance ou patamar). */
const previewParts = (plan: RampPlan): StairPart[] =>
  plan.parts.map((p): StairPart => (p.kind === 'run' ? { kind: 'run', run: p.run } : { kind: 'landing', landing: p.landing }));

/**
 * Prévia da rampa em criação: as linhas do croqui (limites, bordas, caminhada e patamares) e o polígono de cada lance,
 * pintado como piso. O patamar já sai do croqui com o tom de patamar.
 */
export function rampPartsPreview(plan: RampPlan): PreviewItem[] {
  const out = partsPreview(previewParts(plan));
  let flight = 0;
  for (const p of plan.parts) {
    if (p.kind !== 'run') continue;
    const rise = plan.rises[flight] ?? 0;
    flight += 1;
    const { treads } = stairRunSteps(runSketch(p.run), { baseZ: 0, riserHeight: rise });
    const tread = treads[0];
    if (tread) out.push({ kind: 'polygon', ring: tread.polygon, tone: 'tread' });
  }
  return out;
}

/** Prévia tracejada da rampa sob uma transformação (mover, girar, espelhar), como a da escada. */
export function ghostRampItems(r: Ramp, t: Transform): PreviewItem[] {
  const map = (c: StairCurve): StairCurve => ({ a: applyTransform(t, c.a), b: applyTransform(t, c.b), sag: t.kind === 'mirror' ? -c.sag : c.sag });
  const parts: StairPart[] = r.components.map((c): StairPart => {
    if (c.kind === 'landing') {
      const landing: { boundary: StairLanding['boundary'] } = { boundary: c.boundary.map(map) };
      return { kind: 'landing', landing };
    }
    return { kind: 'run', run: { boundaryLeft: c.boundaryLeft.map(map), boundaryRight: c.boundaryRight.map(map), risers: c.risers.map(map), path: c.path.map(map) } };
  });
  return partsPreview(parts, true);
}
