import { describe, expect, it } from 'vitest';
import { multiArea, pointInMulti, type Vec2 } from '@hestia/geom';
import {
  DEFAULT_SLAB_TYPES,
  ProjectStore,
  createEmptyProject,
  defaultStairTypeId,
  makeFloor,
  makeSlab,
  makeStair,
  slabPolygon,
  type Floor,
  type Project,
  type Slab,
  type SlabType,
  type Stair,
  type StairCurve,
  type StairLanding,
  type StairRun,
} from '@hestia/model';
import {
  STAIR_OPENING_DEFAULT_THICKNESS,
  quantifyFloors,
  quantifySlabs,
  resolveFloors,
  resolveSlabs,
  resolveStairs,
  stairHoleRegion,
  stairHolesForLevel,
  type ResolvedStair,
} from './index.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance reto no sentido +x: `n` espelhos a cada `spacing` a partir de x0; limites em y = ±w/2 (os espelhos são aparados). */
function straight(n: number, spacing: number, width = 1.2): StairRun {
  const xs = Array.from({ length: n }, (_, k) => k * spacing);
  const b = (n - 1) * spacing + 0.5;
  return {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(-0.5, width / 2, b, width / 2)],
    boundaryRight: [ln(-0.5, -width / 2, b, -width / 2)],
    risers: xs.map((x) => ln(x, -1, x, 1)),
    path: [],
  };
}

};

/** Retângulo de (x0,y0) a (x1,y1), em volta. */
const box = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [v(x0, y0), v(x1, y0), v(x1, y1), v(x0, y1)];

/**
 * Térreo (0 m) e pavimento 2 a 2,80 m: escada de 16 espelhos (h = 0,175 m) no térreo com topo no pavimento 2. Os degraus
 * são 15, de x = 0 a 4,20 m, largura 1,20 m, centrados em y = 0; degrau i (1-based) vai de x = (i−1)·0,28 a i·0,28.
 */
const UPPER = 2.8;

interface Setup {
  components?: Array<StairRun | StairLanding>;
  stair?: Partial<Omit<Stair, 'order'>>;
  slabs?: Array<Partial<Slab> & Pick<Slab, 'id' | 'boundary'>>;
  floors?: Array<Partial<Floor> & Pick<Floor, 'id' | 'boundary'>>;
  slabTypes?: SlabType[];
  /** Sem a escada (projeto de controle). */
  noStair?: boolean;
}

function build(o: Setup = {}): ProjectStore {
  const base = createEmptyProject();
  const store = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: UPPER } : l)) });
  for (const t of o.slabTypes ?? []) store.exec({ type: 'upsertSlabType', slabType: t });
  if (!o.noStair) {
    store.exec({
      type: 'addStair',
      stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: o.components ?? [straight(16, 0.28)], ...o.stair }),
    });
  }
  for (const s of o.slabs ?? []) store.exec({ type: 'addSlab', slab: makeSlab({ typeId: 'ls_mac15', levelId: 'lv_1', ...s }) });
  for (const f of o.floors ?? []) store.exec({ type: 'addFloor', floor: makeFloor({ typeId: 'ft_laje12', levelId: 'lv_1', ...f }) });
  return store;
}

const SLAB_RING = box(-1, -1, 6, 1);
const TREAD_AREA = 0.28 * 1.2;
/** Área dos degraus 4 a 15 (12 degraus de 0,336 m²): o furo com laje de 0,17 m. */
const HOLE_AREA = 12 * TREAD_AREA;

const onLevel = (p: Project, levelId: string) => resolveSlabs(p, levelId);

describe('furo de escada na laje do nível de topo (decisão 0011, item 11)', () => {
  const p = build({ slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;

  it('a laje do pavimento 2 ganha furo exatamente sobre os degraus 4 a 15 (os altos)', () => {
    const [s] = onLevel(p, 'lv_1');
    expect(s!.polygon.length).toBe(1);
    expect(multiArea(s!.polygon)).toBeCloseTo(multiArea([[SLAB_RING]]) - HOLE_AREA, 9);
    const inside = (x: number, y: number): boolean => pointInMulti(v(x, y), s!.polygon);
    expect(inside(0.7, 0)).toBe(true); // degrau 3: folga de cabeça ≥ 2,10 m, fica de fora do furo
    expect(inside(0.98, 0)).toBe(false); // degrau 4
    expect(inside(4.06, 0.3)).toBe(false); // degrau 15
    expect(inside(0.98, 0.9)).toBe(true); // fora da largura do lance
  });

  it('o corte segue a folga de cabeça: degrau 3 a 2,105 m da laje, degrau 4 a 1,93 m (abaixo de 2,10 m)', () => {
    const limit = UPPER - 0.17 - 2.1;
    const tops = Array.from({ length: 15 }, (_, i) => (i + 1) * 0.175);
    expect(tops.filter((z) => z >= limit).length).toBe(12);
    expect(tops[2]!).toBeLessThan(limit);
    expect(tops[3]!).toBeGreaterThanOrEqual(limit);
  });

  it('o furo sai da área e do volume dos quantitativos (laje de 0,17 m)', () => {
    const q = quantifySlabs(p, 'lv_1').slabs[0]!;
    expect(q.planArea).toBeCloseTo(14 - HOLE_AREA, 9);
    expect(q.holesPerimeter).toBeCloseTo(2 * (4.2 - 0.84) + 2 * 1.2, 9);
    expect(q.volume).toBeCloseTo((14 - HOLE_AREA) * 0.17, 9);
  });

  it('o piso no mesmo nível recebe o mesmo furo', () => {
    const pf = build({ floors: [{ id: 'f1', boundary: SLAB_RING }] }).project;
    const [f] = resolveFloors(pf, 'lv_1');
    expect(multiArea(f!.polygon)).toBeCloseTo(14 - HOLE_AREA, 9);
    expect(quantifyFloors(pf, 'lv_1').floors[0]!.area).toBeCloseTo(14 - HOLE_AREA, 9);
  });

  it('a laje do térreo, onde a escada começa, não fura', () => {
    const ps = build({ slabs: [{ id: 's0', boundary: SLAB_RING, levelId: 'lv_0' }] }).project;
    expect(stairHolesForLevel(ps, 'lv_0')).toEqual([]);
    expect(resolveSlabs(ps, 'lv_0')[0]!.polygon).toEqual([slabPolygon(ps.elements.s0 as Slab)]);
  });

  it('recalcula ao mover a escada: o furo acompanha, e a posição antiga volta a ser laje inteira', () => {
    const store = build({ slabs: [{ id: 's1', boundary: box(-1, -1, 6, 4) }] });
    const before = resolveSlabs(store.project, 'lv_1')[0]!.polygon;
    expect(pointInMulti(v(0.98, 0), before)).toBe(false);
    store.exec({ type: 'transform', ids: ['st1'], transform: { kind: 'translate', d: v(0, 2) } });
    const after = resolveSlabs(store.project, 'lv_1')[0]!.polygon;
    expect(pointInMulti(v(0.98, 0), after)).toBe(true);
    expect(pointInMulti(v(0.98, 2), after)).toBe(false);
    expect(multiArea(after)).toBeCloseTo(multiArea(before), 9);
  });

  it('"Abrir laje" desligada não fura; o contorno volta a ser o cru', () => {
    const store = build({ slabs: [{ id: 's1', boundary: SLAB_RING }] });
    store.exec({ type: 'updateElements', ids: ['st1'], patch: { openSlab: false } });
    expect(stairHolesForLevel(store.project, 'lv_1')).toEqual([]);
    expect(resolveSlabs(store.project, 'lv_1')[0]!.polygon).toEqual([slabPolygon(store.project.elements.s1 as Slab)]);
    expect(quantifySlabs(store.project, 'lv_1').slabs[0]!.planArea).toBeCloseTo(14, 9);
  });

  it('sem escada, a laje sai idêntica ao contorno cru (sem recálculo)', () => {
    const plain = build({ noStair: true, slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    expect(resolveSlabs(plain, 'lv_1')[0]!.polygon).toEqual([slabPolygon(plain.elements.s1 as Slab)]);
  });

  it('espessura da laje que cobre a escada entra no corte: laje de 0,30 m tira também o degrau 3', () => {
    const thick: SlabType = { ...DEFAULT_SLAB_TYPES[0]!, id: 'ls_grossa', name: 'Laje grossa', code: 'LJ-30', layers: [{ function: 'structure', materialId: 'mat_concreto', thickness: 0.3, wraps: false }] };
    const pt = build({ slabTypes: [thick], slabs: [{ id: 's1', boundary: SLAB_RING, typeId: 'ls_grossa' }] }).project;
    expect(multiArea(resolveSlabs(pt, 'lv_1')[0]!.polygon)).toBeCloseTo(14 - 13 * TREAD_AREA, 9);
  });

  it('sem laje ou piso sobre a escada, usa a espessura padrão de 0,15 m', () => {
    expect(STAIR_OPENING_DEFAULT_THICKNESS).toBe(0.15);
    const region = stairHolesForLevel(build().project, 'lv_1');
    expect(multiArea(region)).toBeCloseTo(HOLE_AREA, 9);
  });
});

describe('stairHoleRegion (função pura sobre a escada resolvida)', () => {
  const only = (p: Project): ResolvedStair => {
    const list = resolveStairs(p);
    expect(list).toHaveLength(1);
    return list[0]!;
  };

  it('com laje de 0,17 m, a região é a união dos degraus de cota ≥ topo − 0,17 − 2,10', () => {
    const st = only(build().project);
    expect(multiArea(stairHoleRegion(st, 0.17))).toBeCloseTo(HOLE_AREA, 9);
  });

  it('sem degrau alto o bastante, a região é vazia', () => {
    const st = only(build().project);
    expect(stairHoleRegion(st, -2)).toEqual([]);
  });
});

describe('união com outras escadas e polígonos cobertos', () => {
  it('uma laje inteiramente coberta pelo furo deixa de existir na resolução', () => {
    const p = build({ slabs: [{ id: 'tiny', boundary: box(1.0, -0.2, 1.1, 0.2) }] }).project;
    expect(resolveSlabs(p, 'lv_1')).toEqual([]);
    expect(quantifySlabs(p, 'lv_1').slabs).toEqual([]);
  });

  it('a região do furo nunca grava no elemento (o contorno cru continua igual)', () => {
    const p = build({ slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    resolveSlabs(p, 'lv_1');
    expect((p.elements.s1 as Slab).holes).toEqual([]);
  });
});
