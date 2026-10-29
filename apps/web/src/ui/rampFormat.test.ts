import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, formatRampRatio, makeLevel, makeRamp, type StairLanding, type StairRun } from '@hestia/model';
import { planRamp, rampQuantities, resolveRamps } from '@hestia/engine';
import { percentFieldToSlope, rampSummaryLines, slopeToPercentField } from './rampFormat.ts';

const type = { ...createEmptyProject().rampTypes.rmt_nbr9050! };

describe('rampFormat', () => {
  it('converte a inclinação entre fração e campo em %', () => {
    expect(percentFieldToSlope(8.33)).toBeCloseTo(0.0833, 10);
    expect(slopeToPercentField(percentFieldToSlope(8.33))).toBeCloseTo(8.33, 10);
  });

  it('resumo da rampa de 2 lances (H=1,20)', () => {
    const plan = planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H: 1.2, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
    if ('error' in plan) throw new Error(plan.error);
    const components: Array<StairRun | StairLanding> = plan.parts.map((x, i) =>
      x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing },
    );
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: 1.2 }) });
    s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', components, inputMode: 'slope', slopeTarget: 1 / 12 }) });
    const rr = resolveRamps(s.project)[0]!;
    const lines = rampSummaryLines(rr, rampQuantities(rr));
    const value = (label: string): string | undefined => lines.find((l) => l.label === label)?.value;
    expect(value('Desnível')).toBe('1,20 m');
    expect(value('Inclinação')).toBe('8,33 % (1:12)');
    expect(value('Lances')).toBe('2');
    expect(value('Patamares')).toBe('1');
    expect(value('Comprimento do percurso')).toBe('15,60 m');
    expect(value('Área')).toBe('23,40 m²');
    expect(value('Volume')).toBe('3,52 m³');
    expect(formatRampRatio(rr.slope)).toBe('1:12');
  });
});
