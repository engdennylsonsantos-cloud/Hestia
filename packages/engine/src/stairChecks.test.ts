import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import {
  DEFAULT_STAIR_TYPES,
  ProjectStore,
  createEmptyProject,
  defaultStairTypeId,
  makeSlab,
  makeStair,
  type Project,
  type StairCurve,
  type StairRun,
} from '@hestia/model';
import { stairIssueList, stairValidationIssues } from './stairChecks.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance reto de 16 espelhos a cada 0,28 m (limites em y = ±0,6). */
function sixteen(): StairRun {
  const xs = Array.from({ length: 16 }, (_, k) => k * 0.28);
  return {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(-0.3, 0.6, 4.5, 0.6)],
    boundaryRight: [ln(-0.3, -0.6, 4.5, -0.6)],
    risers: xs.map((x) => ln(x, -1, x, 1)),
    path: [],
  };
}

const box = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [v(x0, y0), v(x1, y0), v(x1, y1), v(x0, y1)];

/** Térreo e pavimento 2 a 2,80 m, escada no térreo; `slab` cobre a planta da escada no pavimento 2. */
function project(o: { openingMode?: 'headroom' | 'full' | 'none'; minHeadroom?: number; slab?: boolean } = {}): Project {
  const base = createEmptyProject();
  const store = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: 2.8 } : l)) });
  if (o.minHeadroom !== undefined) {
    store.exec({ type: 'upsertStairType', stairType: { ...DEFAULT_STAIR_TYPES[0]!, minHeadroom: o.minHeadroom } });
  }
  store.exec({
    type: 'addStair',
    stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [sixteen()], openingMode: o.openingMode ?? 'headroom' }),
  });
  if (o.slab ?? true) {
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 'sl', typeId: 'ls_mac15', levelId: 'lv_1', boundary: box(-1, -1, 5, 1) }) });
  }
  return store.project;
}

const headroom = (p: Project) => stairIssueList(p).filter((i) => i.code === 'stair-headroom');

describe('folga de cabeça sob a laje do nível de topo (stair-headroom)', () => {
  it('sem abertura ("none"), a laje cobre os degraus altos: aviso com a menor folga', () => {
    // laje 0,17 m: face inferior em 2,63 m; último degrau (topo 2,625 m) tem folga de 0,005 m
    const list = headroom(project({ openingMode: 'none' }));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ stairId: 'st1', severity: 'warning', componentIndex: 0 });
    expect(list[0]!.message).toContain('menor que a mínima do tipo (2,10 m) sob a laje');
  });

  it('com a abertura pelo pé-direito livre, o furo derivado tira os degraus altos da laje: sem aviso', () => {
    expect(headroom(project({ openingMode: 'headroom' }))).toHaveLength(0);
  });

  it('contorno completo também não deixa degrau sob a laje: sem aviso', () => {
    expect(headroom(project({ openingMode: 'full' }))).toHaveLength(0);
  });

  it('sem laje sobre a escada no nível de topo: sem aviso', () => {
    expect(headroom(project({ openingMode: 'none', slab: false }))).toHaveLength(0);
  });

  it('mínima do tipo em 0 m: nunca avisa', () => {
    expect(headroom(project({ openingMode: 'none', minHeadroom: 0 }))).toHaveLength(0);
  });

  it('o aviso sai na lista do painel com o id da escada', () => {
    const list = stairValidationIssues(project({ openingMode: 'none' }));
    expect(list.find((i) => i.code === 'stair-headroom')).toMatchObject({ severity: 'warning', elementId: 'st1' });
  });
});
