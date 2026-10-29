import { describe, expect, it } from 'vitest';
import { dist, mid } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeLevel, makeRamp, type Project, type Ramp, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { regenRamp } from './rampEdit.ts';

const type = { ...createEmptyProject().rampTypes.rmt_nbr9050! };
const comps = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));

function project(): { p: Project; ramp: Ramp } {
  const plan = planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H: 1.2, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in plan) throw new Error(plan.error);
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: 1.2 }) });
  s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', components: comps(plan), inputMode: 'slope', slopeTarget: 1 / 12 }) });
  return { p: s.project, ramp: s.project.elements.rp1 as Ramp };
}

const runs = (components: Array<StairRun | StairLanding>): StairRun[] => components.filter((c): c is StairRun => c.kind === 'run');
const runLength = (run: StairRun): number => dist(mid(run.risers[0]!.a, run.risers[0]!.b), mid(run.risers[1]!.a, run.risers[1]!.b));

describe('regenRamp', () => {
  it('modo slope 5 %: H=1,20 → 1 lance de 24 m', () => {
    const { p, ramp } = project();
    const res = regenRamp(ramp, p, { mode: 'slope', slope: 0.05 });
    if ('error' in res) throw new Error(res.error);
    expect(res.inputMode).toBe('slope');
    expect(res.slopeTarget).toBe(0.05);
    expect(runs(res.components)).toHaveLength(1);
    expect(runLength(runs(res.components)[0]!)).toBeCloseTo(24, 6);
  });

  it('largura 2 mantém o comprimento e muda a largura', () => {
    const { p, ramp } = project();
    const res = regenRamp(ramp, p, { width: 2 });
    if ('error' in res) throw new Error(res.error);
    expect(res.components).toHaveLength(3);
    const rs = runs(res.components);
    expect(rs).toHaveLength(2);
    for (const r of rs) {
      expect(runLength(r)).toBeCloseTo(7.2, 6);
      expect(dist(r.risers[0]!.a, r.risers[0]!.b)).toBeCloseTo(2, 6);
    }
  });

  it('modo length 16 m: 2 lances de 7,40 m e slopeTarget null', () => {
    const { p, ramp } = project();
    const res = regenRamp(ramp, p, { mode: 'length', length: 16 });
    if ('error' in res) throw new Error(res.error);
    expect(res.inputMode).toBe('length');
    expect(res.slopeTarget).toBeNull();
    expect(res.components).toHaveLength(3);
    const rs = runs(res.components);
    expect(rs).toHaveLength(2);
    for (const r of rs) expect(runLength(r)).toBeCloseTo(7.4, 6);
  });

  it('reaproveita os ids antigos pela ordem', () => {
    const { p, ramp } = project();
    const res = regenRamp(ramp, p, { mode: 'length', length: 16 });
    if ('error' in res) throw new Error(res.error);
    expect(res.components.map((c) => c.id)).toEqual(ramp.components.map((c) => c.id));
  });
});
