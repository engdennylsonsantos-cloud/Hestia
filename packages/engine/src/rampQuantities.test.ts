import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeLevel, makeRamp, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { resolveRamps, type ResolvedRamp } from './ramps.ts';
import { rampQuantities } from './rampQuantities.ts';

const type = { ...createEmptyProject().rampTypes.rmt_nbr9050! };
const comps = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));

function build(H: number): ResolvedRamp {
  const plan = planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in plan) throw new Error(plan.error);
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: H }) });
  s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', components: comps(plan), inputMode: 'slope', slopeTarget: 1 / 12 }) });
  return resolveRamps(s.project)[0]!;
}

describe('rampQuantities', () => {
  it('1 lance de 9,60 m × 1,50 m: áreas e volume', () => {
    const q = rampQuantities(build(0.8));
    expect(q.flightCount).toBe(1);
    expect(q.landingCount).toBe(0);
    expect(q.slope).toBeCloseTo(1 / 12, 6);
    expect(q.width).toBeCloseTo(1.5, 6);
    expect(q.rise).toBeCloseTo(0.8, 6);
    expect(q.flightArea).toBeCloseTo(14.4, 6);
    expect(q.landingArea).toBeCloseTo(0, 9);
    expect(q.planArea).toBeCloseTo(14.4, 6);
    expect(q.surfaceArea).toBeCloseTo(14.4499, 3);
    expect(q.volumeFlights).toBeCloseTo(2.16748, 4);
    expect(q.volumeLandings).toBeCloseTo(0, 9);
    expect(q.volume).toBeCloseTo(2.1675, 3);
  });

  it('2 lances + patamar 1,20 × 1,50', () => {
    const q = rampQuantities(build(1.2));
    expect(q.flightCount).toBe(2);
    expect(q.landingCount).toBe(1);
    expect(q.flightsLength).toBeCloseTo(14.4, 6);
    expect(q.pathLength).toBeCloseTo(15.6, 6);
    expect(q.flightArea).toBeCloseTo(21.6, 6);
    expect(q.landingArea).toBeCloseTo(1.8, 6);
    expect(q.surfaceArea).toBeCloseTo(21.6 * Math.sqrt(1 + 1 / 144) + 1.8, 6);
    expect(q.volumeLandings).toBeCloseTo(0.27, 6);
    expect(q.volumeFlights).toBeCloseTo(3.25123, 4);
    expect(q.volume).toBeCloseTo(3.5212, 3);
    expect(q.volumeByMaterial[type.materialId]).toBeCloseTo(q.volume, 6);
  });

  it('erro de croqui → tudo zero', () => {
    const rr = build(1.2);
    const q = rampQuantities({ ...rr, issues: [{ code: 'x', severity: 'error', message: '', rampId: rr.id }] });
    expect(q.volume).toBe(0);
    expect(q.planArea).toBe(0);
    expect(q.volumeByMaterial).toEqual({});
  });
});
