import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeLevel, makeRamp, type Project, type Ramp, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { RAMP_SLICE_LENGTH, resolveRamps, resolveRampsOnLevel, type ResolvedRamp } from './ramps.ts';

const type = { ...createEmptyProject().rampTypes.rmt_nbr9050! };
const okPlan = (r: ReturnType<typeof planRamp>): RampPlan => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

const componentsOf = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, idx) =>
    x.kind === 'run' ? { id: `c${idx}`, kind: 'run', ...x.run } : { id: `c${idx}`, kind: 'landing', ...x.landing },
  );

interface Build {
  components?: Array<StairRun | StairLanding>;
  H: number;
  mode?: 'length' | 'slope';
  slopeTarget?: number | null;
  width?: number;
}

/** Projeto com uma rampa resolvida: nível de topo explícito na cota `H`. */
function build(o: Build): { p: Project; rr: ResolvedRamp } {
  const plan = okPlan(
    planRamp({
      start: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      H: o.H,
      type,
      shape: 'straight',
      turn: 'left',
      width: o.width ?? 1.5,
      mode: o.mode ?? 'slope',
      slope: 1 / 12,
    }),
  );
  const mode = o.mode ?? 'slope';
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: o.H }) });
  s.exec({
    type: 'addRamp',
    ramp: makeRamp({
      id: 'rp1',
      typeId: type.id,
      levelId: 'lv_0',
      topLevelId: 'lv_top',
      components: o.components ?? componentsOf(plan),
      inputMode: mode,
      slopeTarget: mode === 'slope' ? (o.slopeTarget ?? 1 / 12) : null,
    }),
  });
  const rr = resolveRamps(s.project)[0]!;
  return { p: s.project, rr };
}

describe('resolveRamps — rampa reta de 2 lances (H=1,20)', () => {
  const { p, rr } = build({ H: 1.2 });

  it('distribui as cotas 0 → 0,60, patamar 0,60, 0,60 → 1,20', () => {
    expect(rr.flights).toHaveLength(2);
    expect(rr.flights[0]!.z0).toBeCloseTo(0, 9);
    expect(rr.flights[0]!.z1).toBeCloseTo(0.6, 9);
    expect(rr.landings[0]!.z).toBeCloseTo(0.6, 9);
    expect(rr.flights[1]!.z0).toBeCloseTo(0.6, 9);
    expect(rr.flights[1]!.z1).toBeCloseTo(1.2, 9);
  });

  it('inclinação, comprimentos e ausência de aviso de norma', () => {
    expect(rr.slope).toBeCloseTo(1 / 12, 6);
    expect(rr.flightsLength).toBeCloseTo(14.4, 6);
    expect(rr.pathLength).toBeCloseTo(15.6, 6);
    expect(rr.issues).toEqual([]);
  });

  it('fatias de ~10 cm com z crescente e última em 1,20', () => {
    const f0 = rr.slices.filter((s) => s.kind === 'flight' && s.componentIndex === rr.flights[0]!.componentIndex);
    expect(Math.abs(f0.length - 72)).toBeLessThanOrEqual(1);
    for (let i = 1; i < f0.length; i++) expect(f0[i]!.z).toBeGreaterThan(f0[i - 1]!.z);
    const f1 = rr.slices.filter((s) => s.kind === 'flight' && s.componentIndex === rr.flights[1]!.componentIndex);
    expect(f1[f1.length - 1]!.z).toBeCloseTo(1.2, 9);
    expect(RAMP_SLICE_LENGTH).toBe(0.1);
  });

  it('footprint cobre lances e patamar', () => {
    expect(rr.footprint.length).toBeGreaterThan(0);
    expect(rr.landings).toHaveLength(1);
    expect(rr.landings[0]!.minDim).toBeCloseTo(1.2, 6);
  });

  it('resolveRampsOnLevel filtra pelo nível de base', () => {
    expect(resolveRampsOnLevel(p, 'lv_0')).toHaveLength(1);
    expect(resolveRampsOnLevel(p, 'lv_1')).toHaveLength(0);
  });
});

describe('resolveRamps — bordas e erros', () => {
  it('lance com 3 espelhos → ramp-run-edges e sem flights', () => {
    const plan = okPlan(
      planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H: 0.8, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 }),
    );
    const comps = componentsOf(plan);
    const run = comps[0] as StairRun;
    const extra = { ...run.risers[0]!, a: { x: 4.8, y: -1 }, b: { x: 4.8, y: 1 } };
    const { rr } = build({ H: 0.8, components: [{ ...run, risers: [...run.risers, extra] }] });
    expect(rr.issues.map((i) => i.code)).toContain('ramp-run-edges');
    expect(rr.issues.find((i) => i.code === 'ramp-run-edges')!.severity).toBe('error');
    expect(rr.flights).toHaveLength(0);
  });

  it('sem lances → ramp-empty', () => {
    const p = createEmptyProject();
    const s = new ProjectStore(p);
    s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', height: 1 }) });
    expect(resolveRamps(s.project)[0]!.issues.map((i) => i.code)).toContain('ramp-empty');
  });

  it('tipo ausente não resolve', () => {
    const s = new ProjectStore(createEmptyProject());
    const r = makeRamp({ id: 'rp1', typeId: 'nope', levelId: 'lv_0' });
    s.project.elements.rp1 = { ...r, order: 1 } as Ramp;
    expect(resolveRamps(s.project)).toEqual([]);
  });
});
