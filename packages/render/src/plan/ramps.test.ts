import { describe, expect, it } from 'vitest';
import { pointInMulti } from '@hestia/geom';
import { createEmptyProject, makeLevel, makeRamp, ProjectStore, type Project, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, resolveRamps, type RampPlan, type ResolvedRamp } from '@hestia/engine';
import { belowRampOps, rampFills, RAMP_CUT_HEIGHT, rampSlopeText } from './ramps.ts';
import { LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';

const VIEW: Viewport = { cx: 0.5, cy: 1.5, zoom: 100, width: 800, height: 600 };
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

/** Pontas de seta: traço aberto de 3 pontos (a haste tem 2, a linha de corte também). */
const heads = (ops: ReturnType<typeof rampFills>) => ops.strokes.filter((s) => !s.closed && s.pts.length === 3);

describe('rampa na planta (§4.1)', () => {
  it('cota de corte acima do topo: todas as fatias cortadas, sem tracejado, 1 seta e 1 rótulo de inclinação', () => {
    const { p, rr } = build(0.8);
    const ops = rampFills(p, [rr], LIGHT, false, 'medium', VIEW);
    expect(RAMP_CUT_HEIGHT).toBe(1.2);
    expect(ops.strokes.some((s) => s.dash)).toBe(false);
    expect(ops.fills.every((f) => f.alpha === 1)).toBe(true);
    expect(heads(ops)).toHaveLength(1);
    expect(ops.strokes.filter((s) => !s.closed)).toHaveLength(2);
    expect(ops.labels.filter((l) => l.text === '8,33 % (1:12)')).toHaveLength(1);
    expect(rampSlopeText(1 / 12)).toBe('8,33 % (1:12)');
  });

  it('cota de corte a 0,40 m: linha transversal no meio do lance (4,80 m) e partes tracejadas acima', () => {
    const { p, rr } = build(0.8);
    const ops = rampFills(p, [rr], LIGHT, false, 'medium', VIEW, { cutZ: 0.4, topZ: 3 });
    const cut = ops.strokes.filter((s) => !s.closed && s.pts.length === 2 && Math.abs(s.pts[0]!.y - s.pts[1]!.y) > 1);
    expect(cut).toHaveLength(1);
    expect((cut[0]!.pts[0]!.x + cut[0]!.pts[1]!.x) / 2).toBeCloseTo(4.8, 2);
    expect(ops.strokes.some((s) => s.dash)).toBe(true);
    expect(ops.fills.some((f) => f.alpha === 0.35)).toBe(true);
  });

  it('dois lances: duas setas, dois rótulos e o patamar preenchido', () => {
    const { p, rr } = build(1.2);
    const ops = rampFills(p, [rr], LIGHT, false, 'medium', VIEW);
    expect(heads(ops)).toHaveLength(2);
    expect(ops.labels.filter((l) => l.text === '8,33 % (1:12)')).toHaveLength(2);
    const l = rr.landings[0]!;
    const c = {
      x: l.polygon.reduce((s, q) => s + q.x, 0) / l.polygon.length,
      y: l.polygon.reduce((s, q) => s + q.y, 0) / l.polygon.length,
    };
    expect(ops.fills.some((f) => pointInMulti(c, f.polygons))).toBe(true);
  });

  it('grosseiro: só o preenchimento da pegada, sem rótulo nem seta', () => {
    const { p, rr } = build(0.8);
    const ops = rampFills(p, [rr], LIGHT, false, 'coarse', VIEW);
    expect(ops.fills).toHaveLength(1);
    expect(ops.strokes).toHaveLength(0);
    expect(ops.labels).toHaveLength(0);
  });

  it('intervalo de vista: a rampa abaixo do topo sai; a que começa acima não sai', () => {
    const { p, rr } = build(0.8);
    const inView = rampFills(p, [rr], LIGHT, false, 'medium', VIEW, { cutZ: 0.4, topZ: 0.9 });
    expect(inView.fills.length).toBeGreaterThan(0);
    const above = rampFills(p, [rr], LIGHT, false, 'medium', VIEW, { cutZ: 0, topZ: -0.1 });
    expect(above.fills).toHaveLength(0);
    expect(above.strokes).toHaveLength(0);
    expect(above.labels).toHaveLength(0);
  });

  it('subpavimento: só a pegada, esmaecida na cor de referência', () => {
    const { rr } = build(0.8);
    const ops = belowRampOps([rr], LIGHT);
    expect(ops.fills).toHaveLength(1);
    expect(ops.fills[0]!.color).toBe(LIGHT.underlay);
    expect(ops.labels).toHaveLength(0);
  });
});
