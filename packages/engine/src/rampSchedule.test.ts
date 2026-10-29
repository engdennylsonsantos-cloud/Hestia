import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeLevel, makeRamp, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, type RampPlan } from './rampPlan.ts';
import { buildRampSchedule, filterRampRows, rampScheduleToCsv, sumRampRows } from './rampSchedule.ts';

const type = { ...createEmptyProject().rampTypes.rmt_nbr9050! };
const comps = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));

function project(): ReturnType<typeof createEmptyProject> {
  const plan = planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H: 1.2, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in plan) throw new Error(plan.error);
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: 1.2 }) });
  s.exec({
    type: 'addRamp',
    ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', mark: 'R1', components: comps(plan), inputMode: 'slope', slopeTarget: 1 / 12 }),
  });
  return s.project;
}

describe('rampSchedule', () => {
  const p = project();
  const schedule = buildRampSchedule(p);

  it('uma rampa → uma linha com lances, inclinação e volume', () => {
    expect(schedule.rows).toHaveLength(1);
    const row = schedule.rows[0]!;
    expect(row.rampId).toBe('rp1');
    expect(row.mark).toBe('R1');
    expect(row.flightCount).toBe(2);
    expect(row.slope).toBeCloseTo(1 / 12, 6);
    expect(row.rise).toBeCloseTo(1.2, 6);
    expect(row.pathLength).toBeCloseTo(15.6, 6);
    expect(row.width).toBeCloseTo(1.5, 6);
    expect(row.volume).toBeCloseTo(3.5212, 3);
    expect(row.baseLevelName).toBe('Térreo');
    expect(row.topLevelName).toBe('Topo');
    expect(schedule.totals.count).toBe(1);
    expect(schedule.totals.volume).toBeCloseTo(3.5212, 3);
  });

  it('filtros e somatórios', () => {
    expect(filterRampRows(schedule.rows, { typeId: type.id })).toHaveLength(1);
    expect(filterRampRows(schedule.rows, { typeId: 'outro' })).toHaveLength(0);
    expect(filterRampRows(schedule.rows, { levelId: 'lv_0' })).toHaveLength(1);
    expect(sumRampRows([])).toEqual({ count: 0, planArea: 0, volume: 0 });
  });

  it('CSV começa com o cabeçalho do contrato', () => {
    const csv = rampScheduleToCsv(schedule.rows, schedule.totals);
    const first = csv.replace(/^\uFEFF/, '').split('\r\n')[0]!;
    expect(first).toBe('Marca;Tipo;Código;Nível base;Nível topo;Lances;Inclinação (%);Desnível (m);Comprimento (m);Largura (m);Área (m²);Volume (m³)');
    expect(csv).toContain('R1;');
    expect(csv).toContain('8,33');
  });
});
