import { describe, expect, it } from 'vitest';
import { boxOf, multiArea, type Vec2 } from '@hestia/geom';
import {
  ProjectStore,
  createEmptyProject,
  makeRamp,
  makeSlab,
  type Project,
  type StairLanding,
  type StairRun,
} from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { resolveRamps, type ResolvedRamp } from './ramps.ts';
import { rampHoleRegion, rampOpeningRegion } from './rampOpenings.ts';
import { resolveSlabs } from './slabs.ts';

const type = { ...createEmptyProject().rampTypes.rmt_nbr9050! };
const box = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const comps = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));

function plan(H: number): RampPlan {
  const p = planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in p) throw new Error(p.error);
  return p;
}

function project(withRamp: boolean, elevation = 1.2): Project {
  const base = createEmptyProject();
  const s = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation } : l)) });
  if (withRamp) {
    s.exec({
      type: 'addRamp',
      ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', components: comps(plan(0.8)), openingMode: 'headroom' }),
    });
  }
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac15', levelId: 'lv_1', boundary: box(-1, -3, 11, 3) }) });
  return s.project;
}

describe('furo da rampa na laje', () => {
  const rr: ResolvedRamp = (() => {
    const p = project(true, 0.8);
    return resolveRamps(p)[0]!;
  })();

  it('headroom: a região começa em ~4,80 m do início (laje a 2,50, folga 2,10)', () => {
    const region = rampHoleRegion(rr, 2.5, 2.1);
    expect(region.length).toBeGreaterThan(0);
    const b = boxOf(region.flat(2));
    expect(b.minX).toBeCloseTo(4.8, 1);
    expect(b.maxX).toBeGreaterThan(9.5);
  });

  it('modo full = footprint; modo none = vazio', () => {
    const ramp = resolveRamps(project(true, 0.8))[0]!;
    const p = project(true, 0.8);
    const r = p.elements.rp1 as Parameters<typeof rampOpeningRegion>[0];
    const full = rampOpeningRegion({ ...r, openingMode: 'full', openingMargin: 0 }, ramp, 2.5);
    expect(multiArea(full)).toBeCloseTo(multiArea(rr.footprint), 6);
    expect(rampOpeningRegion({ ...r, openingMode: 'none' }, ramp, 2.5)).toEqual([]);
  });

  it('a laje do nível de topo fica menor com a rampa', () => {
    const withRamp = resolveSlabs(project(true), 'lv_1');
    const without = resolveSlabs(project(false), 'lv_1');
    expect(withRamp).toHaveLength(1);
    expect(without).toHaveLength(1);
    expect(multiArea(withRamp[0]!.polygon)).toBeLessThan(multiArea(without[0]!.polygon));
  });
});
