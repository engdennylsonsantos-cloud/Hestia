import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { planStairFree } from '@hestia/engine';
import { createEmptyProject, makeLevel, makeStair, type Stair, type StairLanding, type StairRun } from '@hestia/model';
import { makeEnv } from './testEnv.ts';
import { gripHoldAt } from './selectGrips.ts';
import { stairFreeGripAt, stairFreeHandlePreview, stairFreeHold } from './stairFreeGrips.ts';
import { stairGripAt, stairHandlePreview } from './stairGrips.ts';
import { updateStairComponents } from './stairCommands.ts';
import type { PointerInfo } from './types.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const pointer = (raw: Vec2): PointerInfo => ({ raw, shift: false, ctrl: false, alt: false });
const type = createEmptyProject().stairTypes.stt_monolitica!;

const comps = (plan: ReturnType<typeof planStairFree>): Array<StairRun | StairLanding> => {
  if ('error' in plan) throw new Error(plan.error);
  return plan.parts.map((c, i) => (c.kind === 'run' ? { id: `c${i}`, kind: 'run', ...c.run, generatedBy: 'free' } : { id: `c${i}`, kind: 'landing', ...c.landing }));
};

function withFree(path: Vec2[] = [v(0, 0), v(3, 0), v(3, 2)], free = true) {
  const ctx = makeEnv();
  const plan = planStairFree(path, 2.8, type, { width: 1 });
  if ('error' in plan) throw new Error(plan.error);
  ctx.store.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: 2.8 }) });
  ctx.store.exec({
    type: 'addStair',
    stair: makeStair({
      id: 'st1',
      typeId: type.id,
      levelId: 'lv_0',
      topLevelId: 'lv_top',
      components: comps(plan),
      ...(free ? { freePath: plan.path } : {}),
    }),
  });
  ctx.env.setSelection(['st1']);
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  return { ...ctx, msgs, stair: () => ctx.store.project.elements.st1 as Stair };
}

describe('alças da escada livre', () => {
  it('acha o vértice do freePath só dentro da tolerância', () => {
    const w = withFree();
    expect(stairFreeGripAt(w.store.project, ['st1'], v(3, 0.02), 0.01)).toMatchObject({ stairId: 'st1', index: 1 });
    expect(stairFreeGripAt(w.store.project, [], v(3, 0), 0.01)).toBeNull();
    expect(stairFreeGripAt(w.store.project, ['st1'], v(1.5, 0), 0.01)).toBeNull();
    expect(stairFreeGripAt(w.store.project, ['st1'], v(3, 0.2), 0.01)).toBeNull();
    expect(stairFreeHandlePreview(w.store.project, ['st1'])).toHaveLength(3);
  });

  it('está registrada na ferramenta Selecionar (gripHoldAt)', () => {
    const w = withFree();
    expect(gripHoldAt(w.env, v(3, 0))).not.toBeNull();
  });

  it('mover um vértice regenera em UMA transação desfazível', () => {
    const w = withFree();
    const before = w.stair();
    const g = stairFreeGripAt(w.store.project, ['st1'], v(3, 0), 0.01)!;
    const hold = stairFreeHold(w.env, g);
    const items = hold.drag(pointer(v(3, 0.5)), () => v(3, 0.5));
    expect(items.length).toBeGreaterThan(0);
    hold.release(pointer(v(3, 0.5)), () => {});
    expect(w.stair().freePath![1]).toEqual(v(3, 0.5));
    expect(w.stair().components).not.toEqual(before.components);
    w.store.undo();
    expect(w.stair().freePath).toEqual(before.freePath);
    expect(w.stair().components).toEqual(before.components);
  });

  it('trajeto recusado pelo motor não grava e avisa', () => {
    const w = withFree();
    const before = w.stair();
    const last = before.freePath!.at(-1)!;
    const hold = stairFreeHold(w.env, stairFreeGripAt(w.store.project, ['st1'], last, 0.01)!);
    hold.drag(pointer(v(0.1, -0.01)), () => v(0.1, -0.01));
    hold.release(pointer(v(0.1, -0.01)), () => {});
    expect(w.msgs.at(-1)).toMatch(/Não é possível mover o vértice/);
    expect(w.stair()).toEqual(before);
  });

  it('as alças do croqui ignoram escada com freePath e continuam em escada sem', () => {
    const free = withFree();
    const s = free.stair();
    const q = (s.components[0] as StairRun).boundaryLeft[0]!.a;
    expect(stairGripAt(free.store.project, ['st1'], q, 0.01)).toBeNull();
    expect(stairHandlePreview(free.store.project, ['st1'])).toEqual([]);

    const plain = withFree([v(0, 0), v(5, 0)], false);
    const s2 = plain.stair();
    const q2 = (s2.components[0] as StairRun).boundaryLeft[0]!.a;
    expect(stairGripAt(plain.store.project, ['st1'], q2, 0.01)).not.toBeNull();
  });

  it('editar o croqui à mão descarta o freePath', () => {
    const w = withFree();
    const s = w.stair();
    const r = updateStairComponents(w.env, 'st1', s.components);
    if ('error' in r) throw new Error(r.error);
    expect(w.stair().freePath).toBeUndefined();
  });
});
