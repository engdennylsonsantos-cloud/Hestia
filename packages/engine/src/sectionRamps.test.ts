import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeLevel, makeRamp, ProjectStore, type Project, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { resolveRamps, type ResolvedRamp } from './ramps.ts';
import { computeSection } from './section.ts';

const TYPE = createEmptyProject().rampTypes.rmt_nbr9050!;

const componentsOf = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));

function build(H = 0.8): { p: Project; rr: ResolvedRamp } {
  const plan = planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H, type: TYPE, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in plan) throw new Error(plan.error);
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: H }) });
  store.exec({
    type: 'addRamp',
    ramp: makeRamp({ id: 'rp1', typeId: TYPE.id, levelId: 'lv_0', topLevelId: 'lv_top', components: componentsOf(plan), inputMode: 'slope', slopeTarget: 1 / 12 }),
  });
  const p = store.project;
  return { p, rr: resolveRamps(p)[0]! };
}

const TOL = 1e-6;

describe('rampa no corte (§4.3)', () => {
  it('linha longitudinal sobre o eixo: 1 quadrilátero, topo de 0 a 0,80 e fundo 0,150519 abaixo', () => {
    const { p, rr } = build(0.8);
    const r = computeSection(p, { a: { x: -1, y: 0 }, b: { x: 11, y: 0 }, depth: 2 });
    expect(r.cut).toHaveLength(1);
    const region = r.cut[0]!;
    expect(region.sources.some((s) => s.rampId === rr.id)).toBe(true);
    expect(region.polygons).toHaveLength(1);
    const ring = region.polygons[0]![0]!;
    const xs = ring.map((q) => q.x);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const atLo = ring.filter((q) => Math.abs(q.x - lo) < TOL).map((q) => q.y);
    const atHi = ring.filter((q) => Math.abs(q.x - hi) < TOL).map((q) => q.y);
    expect(Math.max(...atLo)).toBeCloseTo(0, 6);
    expect(Math.max(...atHi)).toBeCloseTo(0.8, 6);
    expect(Math.max(...atLo) - Math.min(...atLo)).toBeCloseTo(0.1505199, 5);
    expect(Math.max(...atHi) - Math.min(...atHi)).toBeCloseTo(0.1505199, 5);
  });

  it('linha transversal a 4,80 m: retângulo de largura 1,50 e topo em 0,40', () => {
    const { p } = build(0.8);
    const r = computeSection(p, { a: { x: 4.8, y: -1 }, b: { x: 4.8, y: 1 }, depth: 2 });
    expect(r.cut).toHaveLength(1);
    const ring = r.cut[0]!.polygons[0]![0]!;
    const xs = ring.map((q) => q.x);
    const ys = ring.map((q) => q.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1.5, 6);
    expect(Math.max(...ys)).toBeCloseTo(0.4, 6);
  });

  it('linha fora da rampa: sem corte', () => {
    const { p } = build(0.8);
    const r = computeSection(p, { a: { x: 20, y: -10 }, b: { x: 20, y: 10 }, depth: 2 });
    expect(r.cut).toHaveLength(0);
  });

  it('cotas extremas do corte: fundo em −0,1505 e topo em 0,80', () => {
    const { p } = build(0.8);
    const r = computeSection(p, { a: { x: -1, y: 0 }, b: { x: 11, y: 0 }, depth: 2 });
    expect(r.zMin).toBeCloseTo(-0.1505199, 5);
    expect(r.zMax).toBeCloseTo(0.8, 6);
  });
});
