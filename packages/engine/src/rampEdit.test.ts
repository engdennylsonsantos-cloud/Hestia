import { describe, expect, it } from 'vitest';
import { dist, mid, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeLevel, makeRamp, type Project, type Ramp, type StairLanding, type StairRun, type Command } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { planRampFree } from './rampFree.ts';
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

describe('regenRamp: rampa livre', () => {
  const path0: Vec2[] = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 7 }];

  function freeProject(mode: 'slope' | 'length' = 'slope', H = 1.2, path = path0): { s: ProjectStore; ramp: Ramp } {
    const plan = planRampFree(path, H, type, { width: 1.5, mode, slope: mode === 'slope' ? 1 / 12 : undefined });
    if ('error' in plan) throw new Error(plan.error);
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: H }) });
    s.exec({
      type: 'addRamp',
      ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', components: comps(plan), shape: 'free', freePath: path, inputMode: mode, slopeTarget: mode === 'slope' ? 1 / 12 : null }),
    });
    return { s, ramp: s.project.elements.rp1 as Ramp };
  }
  const ok = <T>(r: T | { error: string }): T => {
    if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error);
    return r as T;
  };
  const rise = (c: Ramp['components']): number => runs(c).length;

  it('largura 2 mantém os vértices e muda a largura dos lances', () => {
    const { s, ramp: r0 } = freeProject();
    // O 1º ajuste (modo slope) encaixa o último vértice no topo; a largura não mexe nos vértices interiores (o fim só se ajusta ao desnível).
    const fit = ok(regenRamp(r0, s.project, {}));
    const ramp = { ...r0, freePath: fit.freePath, components: fit.components };
    const res = ok(regenRamp(ramp, s.project, { width: 2 }));
    expect(res.freePath).toHaveLength(3);
    expect(res.freePath![0]).toEqual({ x: 0, y: 0 });
    expect(res.freePath![1]).toEqual({ x: 8, y: 0 });
    for (const r of runs(res.components)) expect(dist(r.risers[0]!.a, r.risers[0]!.b)).toBeCloseTo(2, 6);
    expect(res.components.map((c) => c.id).slice(0, 2)).toEqual(ramp.components.map((c) => c.id).slice(0, 2));
  });

  it('modo slope: mudar a inclinação altera o último trecho', () => {
    const { s, ramp } = freeProject('slope', 1.2, [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 20 }]);
    const a = ok(regenRamp(ramp, s.project, { slope: 1 / 12 }));
    const b = ok(regenRamp(ramp, s.project, { slope: 0.05 }));
    expect(a.freePath![0]).toEqual({ x: 0, y: 0 });
    expect(b.freePath![1]).toEqual({ x: 8, y: 0 });
    expect(b.freePath![2]!.x).toBeCloseTo(8, 6);
    // 5 % pede mais rampa: o último trecho fica mais longo que com 1/12
    expect(b.freePath![2]!.y).toBeGreaterThan(a.freePath![2]!.y + 1);
    expect(b.slopeTarget).toBe(0.05);
    expect(rise(b.components)).toBeGreaterThan(0);
  });

  it('modo length: mudar o comprimento altera a inclinação', () => {
    const { s, ramp } = freeProject('length');
    const res1 = ok(regenRamp(ramp, s.project, { length: 15 }));
    const res2 = ok(regenRamp(ramp, s.project, { length: 20 }));
    expect(res1.slopeTarget).toBeNull();
    expect(res1.freePath![2]!.y).toBeCloseTo(7, 6);
    expect(res2.freePath![2]!.y).toBeCloseTo(12, 6);
    const total = (r: ReturnType<typeof ok<typeof res1>>): number => runs(r.components).reduce((a, x) => a + runLength(x), 0);
    // mais comprimento = lances mais longos para o mesmo desnível (inclinação menor)
    expect(total(res2)).toBeGreaterThan(total(res1));
  });

  it('trocar para o modo length sem comprimento usa o trajeto como está', () => {
    const { s, ramp } = freeProject();
    const res = ok(regenRamp(ramp, s.project, { mode: 'length' }));
    expect(res.inputMode).toBe('length');
    expect(res.freePath).toEqual(path0);
  });

  it('novo freePath (mover vértice) regenera a partir dele', () => {
    const { s, ramp } = freeProject();
    const moved: Vec2[] = [{ x: 0, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 7 }];
    const res = ok(regenRamp(ramp, s.project, { freePath: moved }));
    expect(res.freePath![1]).toEqual({ x: 8, y: 1 });
    expect(res.freePath).toHaveLength(3);
  });

  it('mover, girar e espelhar a rampa mantém o resultado coerente ao regenerar', () => {
    const { s, ramp } = freeProject('length');
    const base = ok(regenRamp(ramp, s.project, { width: 1.8 }));
    const lens = (c: Ramp['components']): number[] => runs(c).map(runLength);
    for (const transform of [
      { kind: 'translate', d: { x: 5, y: -3 } },
      { kind: 'rotate', about: { x: 1, y: 1 }, angle: Math.PI / 3 },
      { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 0, y: 1 } },
    ] as Array<Extract<Command, { type: 'transform' }>['transform']>) {
      const t = freeProject('length');
      t.s.exec({ type: 'transform', ids: ['rp1'], transform });
      const moved = t.s.project.elements.rp1 as Ramp;
      const res = ok(regenRamp(moved, t.s.project, { width: 1.8 }));
      expect(res.freePath).toEqual(moved.freePath);
      expect(res.freePath).not.toEqual(path0);
      const a = lens(res.components);
      const b = lens(base.components);
      expect(a).toHaveLength(b.length);
      a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, 4));
    }
  });

  it('round-trip: regenerar sem mudanças reproduz os componentes', () => {
    const { s, ramp } = freeProject('length');
    const res = ok(regenRamp(ramp, s.project, {}));
    expect(res.components).toEqual(ramp.components);
    expect(res.freePath).toEqual(path0);
  });
});
