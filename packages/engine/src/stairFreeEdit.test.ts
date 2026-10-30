import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import {
  ProjectStore,
  createEmptyProject,
  makeLevel,
  makeStair,
  type Project,
  type Stair,
  type StairLanding,
  type StairRun,
} from '@hestia/model';
import { planStairFree, type StairFreePlan } from './stairFree.ts';
import { measureFreeStair, regenStairFree } from './stairFreeEdit.ts';

const mono = createEmptyProject().stairTypes.stt_monolitica!;
const v = (x: number, y: number): Vec2 => ({ x, y });

const comps = (plan: StairFreePlan): Array<StairRun | StairLanding> =>
  plan.parts.map((c, i) => (c.kind === 'run' ? { id: `c${i}`, kind: 'run', ...c.run, generatedBy: 'free' } : { id: `c${i}`, kind: 'landing', ...c.landing }));

function setup(
  path: Vec2[],
  H = 2.8,
  width = 1,
  opts: Partial<Parameters<typeof planStairFree>[3]> = {},
): { p: Project; stair: Stair; plan: StairFreePlan } {
  const plan = planStairFree(path, H, mono, { width, ...opts });
  if ('error' in plan) throw new Error(plan.error);
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: H }) });
  store.exec({
    type: 'addStair',
    stair: makeStair({
      id: 'st1',
      typeId: 'stt_monolitica',
      levelId: 'lv_0',
      topLevelId: 'lv_top',
      components: comps(plan),
      freePath: plan.path,
    }),
  });
  return { p: store.project, stair: store.project.elements.st1 as Stair, plan };
}

const ok = <T>(r: T | { error: string }): T => {
  if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error);
  return r as T;
};
const risersOf = (cs: Array<StairRun | StairLanding>): number =>
  cs.reduce((n, c) => n + (c.kind === 'run' ? c.risers.length : 0), 0);
const firstRun = (cs: Array<StairRun | StairLanding>): StairRun => cs.find((c): c is StairRun => c.kind === 'run')!;

describe('measureFreeStair', () => {
  it('Exemplo 2: largura 1,00 e par 16 / 0,28', () => {
    const { stair } = setup([v(0, 0), v(3, 0), v(3, 2)], 2.8, 1);
    const m = measureFreeStair(stair)!;
    expect(m.width).toBeCloseTo(1, 9);
    expect(m.fixed.risers).toBe(16);
    expect(m.fixed.tread).toBeCloseTo(0.28, 9);
  });

  it('sem lance devolve null', () => {
    const { stair } = setup([v(0, 0), v(3, 0), v(3, 2)], 2.8, 1);
    expect(measureFreeStair({ ...stair, components: [] })).toBeNull();
  });
});

describe('regenStairFree', () => {
  it('mover o vértice do meio regenera, mantém 16 espelhos e normaliza o trajeto', () => {
    const { p, stair } = setup([v(0, 0), v(3, 0), v(3, 2)], 2.8, 1);
    const res = ok(regenStairFree(stair, p, { freePath: [v(0, 0), v(3.2, 0.4), v(3, 2)] }));
    expect(risersOf(res.components)).toBe(16);
    expect(res.freePath.length).toBe(3);
    expect(res.freePath[0]).toEqual(v(0, 0));
    expect(res.freePath[1]).toEqual(v(3.2, 0.4));
    expect(res.components.map((c) => c.id)).toEqual(stair.components.map((c) => c.id));
  });

  it('preserva o par ajustado (17 / 0,3125) na edição', () => {
    const { p, stair } = setup([v(0, 0), v(5, 0)], 2.8, 1.2, { fixed: { risers: 17, tread: 0.3125 } });
    const res = ok(regenStairFree(stair, p, { freePath: stair.freePath }));
    expect(res.plan.risers).toBe(17);
    expect(res.plan.tread).toBeCloseTo(0.3125, 9);
    expect(firstRun(res.components).risers).toHaveLength(17);
  });

  it('H = 4,20: h = 4,20 ÷ 16 passa do máximo e N volta aos padrões (24)', () => {
    const { p, stair } = setup([v(0, 0), v(5, 0)], 2.8, 1.2);
    const store = new ProjectStore(p);
    store.exec({ type: 'updateElements', ids: [stair.id], patch: { topOffset: 1.4 } });
    const atual = store.project.elements.st1 as Stair;
    const res = ok(regenStairFree(atual, store.project, {}));
    expect(res.plan.risers).toBe(24);
  });

  it("fixed: 'auto' ignora o par medido", () => {
    const { p, stair } = setup([v(0, 0), v(5, 0)], 2.8, 1.2, { fixed: { risers: 17, tread: 0.3125 } });
    const res = ok(regenStairFree(stair, p, { fixed: 'auto' }));
    expect(res.plan.risers).toBe(16);
    expect(res.plan.tread).toBeCloseTo(0.28, 9);
  });

  it('escada sem freePath devolve erro', () => {
    const { p, stair } = setup([v(0, 0), v(3, 0), v(3, 2)], 2.8, 1);
    expect(regenStairFree({ ...stair, freePath: undefined }, p, {})).toEqual({ error: 'A escada não tem trajeto livre para regenerar.' });
  });

  it('tipo inexistente devolve erro', () => {
    const { p, stair } = setup([v(0, 0), v(5, 0)], 2.8, 1.2);
    expect(regenStairFree({ ...stair, typeId: 'nope' }, p, {})).toEqual({ error: 'Tipo de escada inexistente' });
  });

  it('trajeto recusado pelo motor devolve a mensagem do plano', () => {
    const { p, stair } = setup([v(0, 0), v(3, 0), v(3, 2)], 2.8, 1);
    const res = regenStairFree(stair, p, { freePath: [v(0, 0), v(3, 0), v(0.1, -0.01)] });
    expect('error' in res && res.error).toMatch(/Retorno agudo demais/);
  });
});
