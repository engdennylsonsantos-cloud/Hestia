import { describe, expect, it } from 'vitest';
import { DEFAULT_RAMP_TYPES } from '@hestia/model';
import { planRamp } from '@hestia/engine';
import { pickRampAt, rampEndpoints, rampIdsInBox, rampSnapPoints, selectedRamps } from './rampPick.ts';
import { createRampFromPlan } from './rampCommands.ts';
import { makeEnv } from './testEnv.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;

/** Rampa reta de 1 lance, de (0,0) a (9,60,0), com 1,50 m de largura. */
function setup() {
  const ctx = makeEnv();
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
  const r = createRampFromPlan(ctx.env, plan, {
    typeId: type.id,
    levelId: 'lv_0',
    shape: 'straight',
    turn: 'left',
    inputMode: 'slope',
    slopeTarget: 1 / 12,
  });
  if (!('id' in r)) throw new Error(r.error);
  return { ...ctx, id: r.id };
}

describe('seleção da rampa', () => {
  it('ponto dentro do contorno de um lance seleciona a rampa; ponto fora não', () => {
    const ctx = setup();
    expect(pickRampAt(ctx.store.project, 'lv_0', { x: 5, y: 0 }, 0.01)).toBe(ctx.id);
    expect(pickRampAt(ctx.store.project, 'lv_0', { x: 5, y: 0.6 }, 0.01)).toBe(ctx.id);
    expect(pickRampAt(ctx.store.project, 'lv_0', { x: 5, y: 5 }, 0.01)).toBeNull();
    expect(pickRampAt(ctx.store.project, 'lv_0', { x: 30, y: 0 }, 0.01)).toBeNull();
  });

  it('a janela pega a rampa que cabe dentro e ignora a que está longe', () => {
    const ctx = setup();
    expect(rampIdsInBox(ctx.store.project, 'lv_0', { x: -1, y: -2 }, { x: 11, y: 2 })).toEqual([ctx.id]);
    expect(rampIdsInBox(ctx.store.project, 'lv_0', { x: 30, y: 30 }, { x: 40, y: 40 })).toEqual([]);
  });

  it('selectedRamps só pega rampas, e os pontos de captura saem das extremidades', () => {
    const ctx = setup();
    expect(selectedRamps(ctx.store.project, [ctx.id, 'nao_existe'])).toEqual([ctx.id]);
    const ramp = ctx.store.project.elements[ctx.id]!;
    if (ramp.kind !== 'ramp') throw new Error('esperava uma rampa');
    expect(rampEndpoints(ramp).length).toBeGreaterThan(0);
    expect(rampSnapPoints(ctx.store.project, 'lv_0')).toEqual(rampEndpoints(ramp));
  });
});
