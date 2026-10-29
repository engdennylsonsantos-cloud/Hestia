import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { planRamp, planRampFree, rampIssueList, type RampPlan } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeLevel, makeRamp, type Ramp, type StairLanding, type StairRun } from '@hestia/model';
import { adjustRamp } from './rampActions.ts';

const type = createEmptyProject().rampTypes.rmt_nbr9050!;
const comps = (plan: RampPlan): Array<StairRun | StairLanding> =>
  plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));

/** Projeto com um nível de topo a `H` m e uma rampa reta (slope 1/12) ou livre (trajeto dado). */
function setup(H: number, free?: Vec2[]): { store: ProjectStore; id: string } {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: H }) });
  const plan = free
    ? planRampFree(free, H, type, { width: 1.5, mode: 'slope', slope: 1 / 12 })
    : planRamp({ start: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, H, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in plan) throw new Error(plan.error);
  store.exec({
    type: 'addRamp',
    ramp: makeRamp({
      id: 'rp1', typeId: type.id, levelId: 'lv_0', topLevelId: 'lv_top', components: comps(plan), inputMode: 'slope', slopeTarget: 1 / 12,
      ...(free ? { shape: 'free' as const, freePath: free } : {}),
    }),
  });
  return { store, id: 'rp1' };
}
const rampOf = (s: ProjectStore): Ramp => s.project.elements.rp1 as Ramp;
const problems = (s: ProjectStore) => rampIssueList(s.project).filter((i) => i.severity === 'error' || i.severity === 'warning');

describe('adjustRamp (botão Ajustar)', () => {
  it('rampa reta com inclinação acima da norma fica dentro da norma, em 1 transação, e Ctrl+Z desfaz', () => {
    const { store, id } = setup(1.2);
    store.exec({ type: 'updateElements', ids: [id], patch: { slopeTarget: 0.2 } });
    const before = rampOf(store);
    const r = adjustRamp(store, id);
    expect('message' in r && r.message).toMatch(/^Ajustado: /);
    expect(rampOf(store).slopeTarget).toBeLessThanOrEqual(1 / 12 + 1e-9);
    expect(problems(store)).toEqual([]);
    store.undo();
    expect(rampOf(store).slopeTarget).toBe(before.slopeTarget);
    expect(rampOf(store).components).toEqual(before.components);
  });

  it('rampa livre: ajusta os componentes, fica dentro da norma e Ctrl+Z desfaz', () => {
    const path: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }];
    const { store, id } = setup(1.0, path);
    const before = rampOf(store).components;
    const r = adjustRamp(store, id);
    expect('message' in r && r.message).toMatch(/^Ajustado: /);
    expect(rampOf(store).components).not.toEqual(before);
    expect(problems(store)).toEqual([]);
    store.undo();
    expect(rampOf(store).components).toEqual(before);
  });

  it('rampa inexistente devolve erro', () => {
    const { store } = setup(1.2);
    expect(adjustRamp(store, 'nope')).toEqual({ error: 'Rampa inexistente.' });
  });
});
