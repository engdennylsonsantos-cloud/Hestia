import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { measureFreeStair, planStairFree } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeLevel, makeStair, type Stair, type StairLanding, type StairRun } from '@hestia/model';
import { adjustStairFree, applyStairFreeRegen, patchStairFree } from './stairFreeActions.ts';

const type = createEmptyProject().stairTypes.stt_monolitica!;
const v = (x: number, y: number): Vec2 => ({ x, y });

const comps = (plan: ReturnType<typeof planStairFree>): Array<StairRun | StairLanding> => {
  if ('error' in plan) throw new Error(plan.error);
  return plan.parts.map((c, i) => (c.kind === 'run' ? { id: `c${i}`, kind: 'run', ...c.run, generatedBy: 'free' } : { id: `c${i}`, kind: 'landing', ...c.landing }));
};

/** Projeto com topo a `H` m e uma escada livre no trajeto `path` (largura 1,20, padrões do tipo). */
function setup(H = 2.8, path: Vec2[] = [v(0, 0), v(5, 0)]): { store: ProjectStore; id: string } {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: H }) });
  const plan = planStairFree(path, H, type, { width: 1.2 });
  if ('error' in plan) throw new Error(plan.error);
  store.exec({
    type: 'addStair',
    stair: makeStair({
      id: 'st1',
      typeId: type.id,
      levelId: 'lv_0',
      topLevelId: 'lv_top',
      components: comps(plan),
      freePath: path,
    }),
  });
  return { store, id: 'st1' };
}
const stairOf = (s: ProjectStore): Stair => s.project.elements.st1 as Stair;

describe('adjustStairFree (botão Ajustar)', () => {
  it('Exemplo 1: 5 m, H = 2,80 fica com 17 espelhos de 0,3125 em UMA transação desfazível', () => {
    const { store, id } = setup();
    const before = stairOf(store);
    expect(measureFreeStair(before)?.fixed.risers).toBe(16);
    const r = adjustStairFree(store, id);
    expect(r).toEqual({ message: 'Ajustado: 17 espelhos de 16,5 cm, piso 31,3 cm, trajeto mantido.' });
    const after = stairOf(store);
    expect(measureFreeStair(after)?.fixed.risers).toBe(17);
    expect(after.freePath!.at(-1)!.x).toBeCloseTo(5, 6);
    expect(after.freePath!.at(-1)!.y).toBeCloseTo(0, 6);
    expect(after.components).not.toEqual(before.components);
    store.undo();
    expect(stairOf(store).components).toEqual(before.components);
    expect(stairOf(store).freePath).toEqual(before.freePath);
  });

  it('escada inexistente ou sem freePath devolve erro', () => {
    const { store } = setup();
    expect(adjustStairFree(store, 'nope')).toEqual({ error: 'Escada livre inexistente.' });
  });

  it('tipo inexistente e altura não positiva devolvem erro', () => {
    const a = setup();
    a.store.exec({ type: 'updateElements', ids: [a.id], patch: { typeId: 'nope' } });
    expect(adjustStairFree(a.store, a.id)).toEqual({ error: 'Tipo de escada inexistente' });
    const b = setup();
    b.store.exec({ type: 'updateElements', ids: [b.id], patch: { topOffset: -2.8 } });
    expect(adjustStairFree(b.store, b.id)).toEqual({ error: 'O nível de topo não fica acima da base: nada a ajustar.' });
  });
});

describe('applyStairFreeRegen', () => {
  it('grava componentes e trajeto em uma transação', () => {
    const { store, id } = setup();
    const before = stairOf(store);
    const plan = planStairFree([v(0, 0), v(5, 0)], 2.8, type, { width: 1.5 });
    if ('error' in plan) throw new Error(plan.error);
    applyStairFreeRegen(store, id, {
      components: comps(plan),
      freePath: plan.path,
      manualLandings: undefined,
      plan,
    });
    expect(stairOf(store).freePath).toEqual(plan.path);
    expect(stairOf(store).components).toEqual(comps(plan));
    store.undo();
    expect(stairOf(store).components).toEqual(before.components);
  });
});

describe('patchStairFree', () => {
  it('mudar o deslocamento do topo regenera (N = H ÷ espelho máx) na mesma transação', () => {
    const { store, id } = setup();
    const before = stairOf(store);
    expect(patchStairFree(store, id, { topOffset: 0.2 })).toBeNull();
    const after = stairOf(store);
    expect(after.topOffset).toBeCloseTo(0.2, 12);
    expect(after.components).not.toEqual(before.components);
    expect(after.freePath).not.toEqual(before.freePath);
    // H = 3,00; H ÷ 0,18 = 16,67 → 17 espelhos de 0,28: o trajeto fecha em 4,48 m e sobram 0,52 m.
    expect(measureFreeStair(after)?.fixed).toMatchObject({ risers: 17 });
    store.undo();
    expect(stairOf(store).topOffset).toBe(before.topOffset);
    expect(stairOf(store).components).toEqual(before.components);
    expect(stairOf(store).freePath).toEqual(before.freePath);
  });

  it('erro do motor não grava nada', () => {
    const { store, id } = setup();
    const before = store.project;
    expect(patchStairFree(store, id, { typeId: 'nope' })).toEqual({ error: 'Tipo de escada inexistente' });
    expect(store.project).toBe(before);
  });
});
