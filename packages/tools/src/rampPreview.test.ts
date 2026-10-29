import { describe, expect, it } from 'vitest';
import { DEFAULT_RAMP_TYPES, makeRamp, type Ramp } from '@hestia/model';
import { planRamp } from '@hestia/engine';
import { ghostRampItems, rampPartsPreview } from './rampPreview.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;

describe('prévia da rampa', () => {
  it('um plano reto de 1 lance gera ao menos um polígono de piso', () => {
    const plan = planRamp({
      start: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      H: 0.8,
      type,
      shape: 'straight',
      turn: 'left',
      width: 1.5,
      mode: 'slope',
      slope: 1 / 12,
    });
    if ('error' in plan) throw new Error(plan.error);
    const items = rampPartsPreview(plan);
    expect(items.some((i) => i.kind === 'polygon' && i.tone === 'tread')).toBe(true);
    expect(items.some((i) => i.kind === 'line' && i.tone === 'boundary')).toBe(true);
  });

  it('o fantasma desloca os pontos do croqui', () => {
    const plan = planRamp({
      start: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      H: 0.8,
      type,
      shape: 'straight',
      turn: 'left',
      width: 1.5,
      mode: 'slope',
      slope: 1 / 12,
    });
    if ('error' in plan) throw new Error(plan.error);
    const ramp = makeRamp({
      id: 'rp',
      typeId: type.id,
      levelId: 'lv_0',
      components: plan.parts.map((part, i) => (part.kind === 'run' ? { id: `c${i}`, kind: 'run', ...part.run } : { id: `c${i}`, kind: 'landing', ...part.landing })),
    }) as Ramp;
    const first = ramp.components[0]!;
    if (first.kind !== 'run') throw new Error('esperava um lance');
    const a = first.boundaryLeft[0]!.a;
    const shifted = ghostRampItems(ramp, { kind: 'translate', d: { x: 2, y: 1 } }).find((i) => i.kind === 'line');
    expect(shifted?.kind === 'line' ? shifted.a : null).toEqual({ x: a.x + 2, y: a.y + 1 });
  });
});
