import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeLevel, makeRamp, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { resolveRamps, type ResolvedRamp } from './ramps.ts';
import { pieceBottomZ, planeZ, rampBody } from './rampBody.ts';

const type = { ...createEmptyProject().rampTypes.rmt_nbr9050! };
const comps = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));

function build(H: number): { rr: ResolvedRamp } {
  const plan = planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in plan) throw new Error(plan.error);
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: H }) });
  s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', components: comps(plan), inputMode: 'slope', slopeTarget: 1 / 12 }) });
  return { rr: resolveRamps(s.project)[0]! };
}

describe('rampBody', () => {
  it('1 lance: topo de 0 a 0,80 e fundo 0,150519 abaixo (vertical)', () => {
    const { rr } = build(0.8);
    const { pieces } = rampBody(rr);
    expect(pieces).toHaveLength(1);
    const piece = pieces[0]!;
    const f = rr.flights[0]!;
    expect(piece.kind).toBe('flight');
    expect(planeZ(piece.top, f.start.x, f.start.y)).toBeCloseTo(0, 6);
    expect(planeZ(piece.top, f.end.x, f.end.y)).toBeCloseTo(0.8, 6);
    const mid = { x: (f.start.x + f.end.x) / 2, y: (f.start.y + f.end.y) / 2 };
    expect(planeZ(piece.top, mid.x, mid.y) - pieceBottomZ(piece, mid.x, mid.y)).toBeCloseTo(0.1505199, 6);
  });

  it('2 lances: peças de lance inclinadas e patamar plano', () => {
    const { rr } = build(1.2);
    const { pieces } = rampBody(rr);
    expect(pieces.filter((p) => p.kind === 'flight')).toHaveLength(2);
    const landing = pieces.find((p) => p.kind === 'landing')!;
    expect(landing).toBeDefined();
    const l = rr.landings[0]!;
    expect(planeZ(landing.top, l.polygon[0]!.x, l.polygon[0]!.y)).toBeCloseTo(0.6, 6);
    expect(planeZ(landing.bottom, l.polygon[0]!.x, l.polygon[0]!.y)).toBeCloseTo(0.45, 6);
  });

  it('rampa com erro não gera peças', () => {
    const { rr } = build(1.2);
    expect(rampBody({ ...rr, issues: [{ code: 'x', severity: 'error', message: '', rampId: rr.id }] })).toEqual({ pieces: [] });
  });
});
