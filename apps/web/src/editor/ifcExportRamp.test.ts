import { describe, expect, it } from 'vitest';
import { planRamp, rampBody, rampPieceVolume, rampQuantities, resolveRamps } from '@hestia/engine';
import {
  ProjectStore,
  createEmptyProject,
  makeLevel,
  makeRamp,
  type Project,
  type StairLanding,
  type StairRun,
} from '@hestia/model';
import { ifcGeometryOf } from './ifcExport.ts';

const type = createEmptyProject().rampTypes.rmt_nbr9050!;

const componentsOf = (plan: ReturnType<typeof planRamp>): Array<StairRun | StairLanding> => {
  if ('error' in plan) throw new Error(plan.error);
  return plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));
};

/** Rampa reta de 2 lances (H = 1,20, inclinação 1/12, largura 1,50): 7,20 + patamar 1,20 + 7,20. */
function twoFlightRamp(): Project {
  const plan = planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H: 1.2, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: 1.2 }) });
  s.exec({
    type: 'addRamp',
    ramp: makeRamp({
      id: 'rp1',
      typeId: type.id,
      levelId: 'lv_0',
      topLevelId: 'lv_top',
      components: componentsOf(plan),
      shape: 'straight',
      inputMode: 'slope',
      slopeTarget: 1 / 12,
    }),
  });
  return s.project;
}

describe('conferência dos quantitativos da rampa com o IFC', () => {
  const p = twoFlightRamp();
  const rr = resolveRamps(p)[0]!;

  it('o quantitativo dá 3,5212 m³ (2 lances de 7,20 m e patamar de 1,20 × 1,50)', () => {
    const q = rampQuantities(rr);
    expect(q.volume).toBeCloseTo(3.5212, 3);
    expect(q.flightArea).toBeCloseTo(21.6, 6);
    expect(q.landingArea).toBeCloseTo(1.8, 6);
  });

  it('a soma dos volumes dos prismas do IFC bate com o quantitativo', () => {
    const geo = ifcGeometryOf(p);
    const rampGeo = geo.ramps?.[0];
    expect(rampGeo).toBeDefined();
    expect(rampGeo!.flights).toHaveLength(2);
    expect(rampGeo!.landings).toHaveLength(1);

    const pieces = [
      ...rampGeo!.flights.map((f) => ({
        kind: 'flight' as const,
        componentIndex: f.componentIndex,
        polygon: f.prism.polygon[0]!,
        top: f.prism.top,
        bottom: f.prism.bottom,
      })),
      ...rampGeo!.landings.map((pr, i) => ({
        kind: 'landing' as const,
        componentIndex: i,
        polygon: pr.polygon[0]!,
        top: pr.top,
        bottom: pr.bottom,
      })),
    ];
    const sum = pieces.reduce((s, pc) => s + rampPieceVolume(pc), 0);
    const bodySum = rampBody(rr).pieces.reduce((s, pc) => s + rampPieceVolume(pc), 0);
    expect(sum).toBeCloseTo(rampQuantities(rr).volume, 6);
    expect(sum).toBeCloseTo(bodySum, 9);
    expect(sum).toBeCloseTo(3.5212, 3);
  });
});
