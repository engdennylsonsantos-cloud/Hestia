import { describe, expect, it } from 'vitest';
import { type Vec2 } from '@hestia/geom';
import { planRampFree } from '@hestia/engine';
import { createEmptyProject, makeLevel, makeRamp, type Ramp } from '@hestia/model';
import { makeEnv } from './testEnv.ts';
import { gripHoldAt } from './selectGrips.ts';
import { rampGripAt, rampHandlePreview, rampHold } from './rampGrips.ts';
import type { PointerInfo } from './types.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const pointer = (raw: Vec2): PointerInfo => ({ raw, shift: false, ctrl: false, alt: false });
const type = createEmptyProject().rampTypes.rmt_nbr9050!;

function withFree() {
  const ctx = makeEnv();
  const path = [v(0, 0), v(8, 0), v(8, 10)];
  const plan = planRampFree(path, 1.2, type, { width: 1.5, mode: 'length' });
  if ('error' in plan) throw new Error(plan.error);
  ctx.store.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: 1.2 }) });
  const components = plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run' as const, ...x.run } : { id: `c${i}`, kind: 'landing' as const, ...x.landing }));
  ctx.store.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', components, shape: 'free', freePath: path, inputMode: 'length' }) });
  ctx.env.setSelection(['rp1']);
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  return { ...ctx, msgs, ramp: () => ctx.store.project.elements.rp1 as Ramp };
}

describe('alças da rampa livre', () => {
  it('acha o vértice do freePath só com a rampa livre selecionada', () => {
    const w = withFree();
    expect(rampGripAt(w.store.project, ['rp1'], v(8, 0.02), 0.01)).toMatchObject({ rampId: 'rp1', index: 1 });
    expect(rampGripAt(w.store.project, [], v(8, 0), 0.01)).toBeNull();
    expect(rampGripAt(w.store.project, ['rp1'], v(4, 0), 0.01)).toBeNull();
    expect(rampHandlePreview(w.store.project, ['rp1'])).toHaveLength(3);
  });

  it('está registrada na ferramenta Selecionar (gripHoldAt)', () => {
    const w = withFree();
    expect(gripHoldAt(w.env, v(8, 0))).not.toBeNull();
  });

  it('mover um vértice regenera a rampa em UMA transação desfazível', () => {
    const w = withFree();
    const before = w.ramp();
    const g = rampGripAt(w.store.project, ['rp1'], v(8, 0), 0.01)!;
    const hold = rampHold(w.env, g);
    const items = hold.drag(pointer(v(8, 1)), () => v(8, 1));
    expect(items.length).toBeGreaterThan(0);
    hold.release(pointer(v(8, 1)), () => {});
    expect(w.ramp().freePath![1]).toEqual(v(8, 1));
    expect(w.ramp().components).not.toEqual(before.components);
    w.store.undo();
    expect(w.ramp().freePath).toEqual(before.freePath);
    expect(w.ramp().components).toEqual(before.components);
  });

  it('trajeto recusado pelo motor não grava e avisa', () => {
    const w = withFree();
    const before = w.ramp();
    const hold = rampHold(w.env, rampGripAt(w.store.project, ['rp1'], v(8, 10), 0.01)!);
    hold.drag(pointer(v(8.001, 0.02)), () => v(8.001, 0.02));
    hold.release(pointer(v(8.001, 0.02)), () => {});
    expect(w.msgs.at(-1)).toMatch(/Não é possível mover o vértice/);
    expect(w.ramp()).toEqual(before);
  });
});
