import { describe, expect, it } from 'vitest';
import { DEFAULT_RAMP_TYPES, rampsOnLevel, type RampShape } from '@hestia/model';
import { planRamp, type RampPlan } from '@hestia/engine';
import { createRampFromPlan, draftRamp, rampRise, rampTypeId } from './rampCommands.ts';
import { makeEnv } from './testEnv.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;

function straightPlan(extra: Partial<Parameters<typeof planRamp>[0]> = {}): RampPlan {
  const r = planRamp({
    start: { x: 0, y: 0 },
    dir: { x: 1, y: 0 },
    H: 0.8,
    type,
    shape: 'straight',
    turn: 'left',
    width: 1.5,
    mode: 'slope',
    slope: 1 / 12,
    ...extra,
  });
  if ('error' in r) throw new Error(r.error);
  return r;
}

describe('rampTypeId e draftRamp', () => {
  it('tipo pedido se existe, senão o padrão do projeto', () => {
    const { store } = makeEnv();
    expect(rampTypeId(store.project, 'rmt_ada')).toBe('rmt_ada');
    expect(rampTypeId(store.project, 'nao_existe')).toBe('rmt_nbr9050');
    expect(rampTypeId(store.project)).toBe('rmt_nbr9050');
  });

  it('rascunho usa as opções de cota e a altura padrão sem nível acima', () => {
    const { store } = makeEnv();
    const d = draftRamp(store.project, { shape: 'straight', turn: 'left', mode: 'length' }, 'lv_1')!;
    expect(d.id).toBe('draft');
    expect(d.kind).toBe('ramp');
    expect(d.order).toBe(0);
    expect(d.topLevelId).toBeNull();
    expect(rampRise(store.project, d)).toBeCloseTo(0.8, 6);
  });
});

describe('createRampFromPlan', () => {
  it('cria a rampa com forma e inclinação alvo, seleciona e desfaz em um passo', () => {
    const { store, env, sel } = makeEnv();
    const shape: RampShape = 'straight';
    const r = createRampFromPlan(env, straightPlan(), {
      typeId: 'rmt_nbr9050',
      levelId: 'lv_0',
      shape,
      turn: 'left',
      inputMode: 'slope',
      slopeTarget: 1 / 12,
    });
    expect('id' in r).toBe(true);
    if (!('id' in r)) return;
    const ramp = store.project.elements[r.id];
    expect(ramp?.kind).toBe('ramp');
    expect(ramp && 'shape' in ramp ? ramp.shape : null).toBe('straight');
    expect(ramp && 'slopeTarget' in ramp ? ramp.slopeTarget : null).toBeCloseTo(1 / 12, 9);
    expect(ramp && 'inputMode' in ramp ? ramp.inputMode : null).toBe('slope');
    expect(sel()).toEqual([r.id]);
    expect(rampsOnLevel(store.project, 'lv_0')).toHaveLength(1);
    store.undo();
    expect(rampsOnLevel(store.project, 'lv_0')).toHaveLength(0);
  });

  it('recusa tipo inexistente', () => {
    const { env } = makeEnv();
    expect(createRampFromPlan(env, straightPlan(), {
      typeId: 'nao_existe',
      levelId: 'lv_0',
      shape: 'straight',
      turn: 'left',
      inputMode: 'slope',
      slopeTarget: 1 / 12,
    })).toEqual({ error: 'Tipo de rampa inexistente' });
  });
});
