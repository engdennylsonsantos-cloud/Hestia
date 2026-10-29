import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, defaultStairTypeId, makeRamp, makeSlab, makeStair, type Project, type StairCurve, type StairLanding, type StairRun } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';
import { planRamp } from './rampPlan.ts';
import { resolveRamps, resolveRampsOnLevel } from './ramps.ts';
import { resolveStairs, resolveStairsOnLevel } from './stairs.ts';
import { resolveSlabs } from './slabs.ts';
import { memoDoProjetoMotor } from './memoProjeto.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });
const straight = (y0: number): StairRun => ({
  id: 'run',
  kind: 'run',
  boundaryLeft: [ln(-0.5, y0 + 0.6, 4.5, y0 + 0.6)],
  boundaryRight: [ln(-0.5, y0 - 0.6, 4.5, y0 - 0.6)],
  risers: Array.from({ length: 16 }, (_, k) => ln(k * 0.28, y0 - 1, k * 0.28, y0 + 1)),
  path: [],
});
const rampType = { ...createEmptyProject().rampTypes.rmt_nbr9050! };
const rampParts = (y: number): Array<StairRun | StairLanding> => {
  const pl = planRamp({ start: v(0, y), dir: v(1, 0), H: 0.8, type: rampType, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  if ('error' in pl) throw new Error(pl.error);
  return pl.parts.map((x, k) => (x.kind === 'run' ? { id: `c${k}`, kind: 'run', ...x.run } : { id: `c${k}`, kind: 'landing', ...x.landing }));
};

function build(): ProjectStore {
  const base = createEmptyProject();
  const s = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: 2.8 } : l)) });
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [straight(0)], openingMargin: 0 }) });
  s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp1', typeId: rampType.id, levelId: 'lv_0', components: rampParts(10), openingMode: 'headroom' }) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac15', levelId: 'lv_1', boundary: [v(-1, -3), v(12, -3), v(12, 14), v(-1, 14)] }) });
  return s;
}
const ids = (p: Project): string[] => [...resolveStairs(p).map((x) => x.id), ...resolveRamps(p).map((x) => x.id)];

describe('memo por projeto do motor (escadas e rampas)', () => {
  it('chamadas repetidas com o mesmo projeto devolvem os mesmos objetos resolvidos', () => {
    const p = build().project;
    expect(resolveStairs(p)[0]).toBe(resolveStairs(p)[0]);
    expect(resolveRamps(p)[0]).toBe(resolveRamps(p)[0]);
    expect(resolveRampsOnLevel(p, 'lv_0')[0]).toBe(resolveRamps(p)[0]);
    expect(resolveStairsOnLevel(p, 'lv_0')[0]).toBe(resolveStairs(p)[0]);
    expect(resolveSlabs(p, 'lv_1')).toEqual(resolveSlabs(p, 'lv_1'));
  });

  it('o memo guarda também o null e calcula uma vez por chave', () => {
    const p = build().project;
    let n = 0;
    const calc = (): null => (n++, null);
    expect(memoDoProjetoMotor(p, 'k', calc)).toBeNull();
    expect(memoDoProjetoMotor(p, 'k', calc)).toBeNull();
    expect(n).toBe(1);
  });

  it('criar escada e rampa: o projeto novo reflete a criação', () => {
    const s = build();
    const antes = s.project;
    expect(ids(antes)).toEqual(['st1', 'rp1']);
    s.exec({ type: 'addStair', stair: makeStair({ id: 'st2', typeId: defaultStairTypeId, levelId: 'lv_0', components: [straight(5)], openingMargin: 0 }) });
    s.exec({ type: 'addRamp', ramp: makeRamp({ id: 'rp2', typeId: rampType.id, levelId: 'lv_0', components: rampParts(20), openingMode: 'headroom' }) });
    expect(ids(s.project)).toEqual(['st1', 'st2', 'rp1', 'rp2']);
    expect(ids(antes)).toEqual(['st1', 'rp1']);
  });

  it('apagar escada e rampa: o projeto novo reflete a remoção', () => {
    const s = build();
    ids(s.project);
    s.exec({ type: 'deleteElements', ids: ['st1', 'rp1'] });
    expect(ids(s.project)).toEqual([]);
  });

  it('mover escada e rampa: a geometria resolvida acompanha a edição', () => {
    const s = build();
    const st0 = resolveStairs(s.project)[0]!.footprint;
    const rp0 = resolveRamps(s.project)[0]!.footprint;
    s.exec({ type: 'updateElements', ids: ['st1'], patch: { components: [straight(7)] } });
    s.exec({ type: 'updateElements', ids: ['rp1'], patch: { components: rampParts(30) } });
    expect(resolveStairs(s.project)[0]!.footprint).not.toEqual(st0);
    expect(resolveRamps(s.project)[0]!.footprint).not.toEqual(rp0);
    expect(resolveStairs(s.project)[0]!.footprint[0]![0]![0]!.y).toBeGreaterThan(5);
  });

  it('mudar o nível de topo: cota e furo da laje acompanham', () => {
    const s = build();
    const furo0 = resolveSlabs(s.project, 'lv_1')[0]!.polygon;
    const topZ0 = resolveRamps(s.project)[0]!.topZ;
    const lv = s.project.levels.find((l) => l.id === 'lv_1')!;
    s.exec({ type: 'upsertLevel', level: { ...lv, elevation: 1.5 } });
    expect(resolveRamps(s.project)[0]!.topZ).not.toBe(topZ0);
    expect(resolveSlabs(s.project, 'lv_1')[0]!.polygon).not.toEqual(furo0);
  });

  it('mudar o tipo: a resolução usa o tipo novo', () => {
    const s = build();
    const t0 = resolveRamps(s.project)[0]!.type.minHeadroom;
    s.exec({ type: 'upsertRampType', rampType: { ...rampType, minHeadroom: t0 + 0.5 } });
    expect(resolveRamps(s.project)[0]!.type.minHeadroom).toBe(t0 + 0.5);
    const e0 = resolveStairs(s.project)[0]!.type.id;
    const st = s.project.stairTypes[e0]!;
    s.exec({ type: 'upsertStairType', stairType: { ...st, minHeadroom: st.minHeadroom + 0.25 } });
    expect(resolveStairs(s.project)[0]!.type.minHeadroom).toBe(st.minHeadroom + 0.25);
  });

});
