import { describe, expect, it } from 'vitest';
import { difference, intersection, multiArea, pointInMulti, type MultiPolygon, type Vec2 } from '@hestia/geom';
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
  quantifyFloors,
  quantifySlabs,
  resolveFloors,
  resolveSlabs,
  resolveStairs,
  stairHoleRegion,
  coverUnderside,
  stairHolesFor,
  stairOpeningsOnLevel,
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
      stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: o.components ?? [straight(16, 0.28)], openingMargin: 0, ...o.stair }),
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
/** Furo que a laje do pavimento 2 perde para a escada, dentro do contorno cru `ring`. */
const holeOf = (p: Project, ring: Vec2[] = SLAB_RING): MultiPolygon => difference([[ring]], resolveSlabs(p, 'lv_1')[0]!.polygon);

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
    expect(stairOpeningsOnLevel(ps, 'lv_0')).toEqual([]);
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

  it('abertura "none" não fura; o contorno volta a ser o cru', () => {
    const store = build({ slabs: [{ id: 's1', boundary: SLAB_RING }] });
    store.exec({ type: 'updateElements', ids: ['st1'], patch: { openingMode: 'none' } });
    expect(stairOpeningsOnLevel(store.project, 'lv_1')).toEqual([]);
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

  it('sem laje ou piso sobre a escada não há o que furar', () => {
    expect(resolveSlabs(build().project, 'lv_1')).toEqual([]);
    expect(resolveFloors(build().project, 'lv_1')).toEqual([]);
  });
});

describe('stairHoleRegion (função pura sobre a escada resolvida)', () => {
  const only = (p: Project): ResolvedStair => {
    const list = resolveStairs(p);
    expect(list).toHaveLength(1);
    return list[0]!;
  };

  it('com face inferior em 2,63 m (laje de 0,17 m), a região é a união dos degraus de cota ≥ face − 2,10', () => {
    const st = only(build().project);
    expect(multiArea(stairHoleRegion(st, UPPER - 0.17))).toBeCloseTo(HOLE_AREA, 9);
  });

  it('sem degrau alto o bastante, a região é vazia', () => {
    const st = only(build().project);
    expect(stairHoleRegion(st, UPPER + 2)).toEqual([]);
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

describe('abertura da laje por modo (decisão 0011, §6)', () => {
  const slabOf = (p: Project) => resolveSlabs(p, 'lv_1')[0]!.polygon;

  it('pé-direito livre: 2,10 m (padrão do tipo, também com `null`) tira 12 degraus; 3,00 m tira os 15 e dá outro furo', () => {
    const padrao = build({ slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    const nulo = build({ stair: { openingHeadroom: null }, slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    const alto = build({ stair: { openingHeadroom: 3 }, slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    expect(multiArea(holeOf(padrao))).toBeCloseTo(HOLE_AREA, 9);
    expect(multiArea(holeOf(nulo))).toBeCloseTo(HOLE_AREA, 9);
    expect(multiArea(holeOf(alto))).toBeCloseTo(15 * TREAD_AREA, 9);
    expect(pointInMulti(v(0.7, 0), slabOf(alto))).toBe(false); // degrau 3 agora também sai da laje
  });

  it('contorno completo: o furo é a projeção inteira da escada, degraus baixos inclusos', () => {
    const p = build({ stair: { openingMode: 'full' }, slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    const r = resolveStairs(p)[0]!;
    expect(multiArea(r.footprint)).toBeCloseTo(15 * TREAD_AREA, 9);
    expect(multiArea(holeOf(p))).toBeCloseTo(multiArea(r.footprint), 9);
    expect(pointInMulti(v(0.7, 0), slabOf(p))).toBe(false); // degrau 3, que o pé-direito livre deixava na laje
    expect(pointInMulti(v(0.7, 0.9), slabOf(p))).toBe(true);
  });

  it('sem abertura: nenhum furo e a laje sai inteira (≈ 14 m²)', () => {
    const p = build({ stair: { openingMode: 'none' }, slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    expect(stairOpeningsOnLevel(p, 'lv_1')).toEqual([]);
    expect(multiArea(slabOf(p))).toBeCloseTo(14, 9);
  });

  it('folga de 0,05 m: cresce nos outros três lados, mas não passa do último espelho (o piso de cima começa ali)', () => {
    const p = build({ stair: { openingMargin: 0.05 }, slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    const perimeter = 2 * (3.36 + 1.2);
    const noTopo = (1.2 + 2 * 0.05) * 0.05;
    expect(multiArea(holeOf(p))).toBeCloseTo(HOLE_AREA + perimeter * 0.05 + 4 * 0.05 * 0.05 - noTopo, 6);
    // Lance em +x, 16 espelhos de 0,28 m a partir de x = 0: o último espelho está em x = 15 × 0,28 = 4,20 m.
    const xs = holeOf(p).flat(2).map((q) => q.x);
    expect(Math.max(...xs)).toBeCloseTo(4.2, 6);
  });
});

describe('cenário L com patamar (decisão 0011, §2 e §6)', () => {
  /** Lance A em +x (8 espelhos, x = 0 a 1,96), patamar 1,20 × 1,20 m, lance B em +y (8 espelhos). N = 16; h = 0,175 m. */
  function lShape(): Array<StairRun | StairLanding> {
    const a = straight(8, 0.28);
    const landing: StairLanding = {
      id: 'pat',
      kind: 'landing',
      boundary: [ln(1.96, -0.6, 3.16, -0.6), ln(3.16, -0.6, 3.16, 0.6), ln(3.16, 0.6, 1.96, 0.6), ln(1.96, 0.6, 1.96, -0.6)],
    };
    const b: StairRun = {
      id: 'runB',
      kind: 'run',
      boundaryLeft: [ln(1.96, 0.5, 1.96, 3.06)],
      boundaryRight: [ln(3.16, 0.5, 3.16, 3.06)],
      risers: Array.from({ length: 8 }, (_, k) => ln(0, 0.6 + k * 0.28, 5, 0.6 + k * 0.28)),
      path: [],
    };
    return [a, landing, b];
  }
  const RING_L = box(-1, -1, 5, 4);
  const L = (stair: Setup['stair'] = {}) => build({ components: lShape(), stair, slabs: [{ id: 's1', boundary: RING_L }] }).project;
  /** 4 degraus do lance A (topo ≥ 0,53 m), o patamar (1,20 × 1,20 m) e os 7 degraus do lance B. */
  const HOLE_L = 4 * TREAD_AREA + 1.44 + 7 * TREAD_AREA;
  /** Todos os 14 degraus e o patamar. */
  const FOOT_L = 14 * TREAD_AREA + 1.44;

  it('o croqui é válido: 16 espelhos, h = 0,175 m, patamar na cota 1,40 m', () => {
    const r = resolveStairs(L())[0]!;
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.riserCount).toBe(16);
    expect(r.riserHeight).toBeCloseTo(0.175, 9);
    expect(r.steps.find((s) => s.kind === 'landing')!.z).toBeCloseTo(1.4, 9);
  });

  it('pé-direito livre: o patamar sai da laje e os degraus baixos do lance A ficam', () => {
    const hole = holeOf(L(), RING_L);
    expect(pointInMulti(v(2.56, 0), hole)).toBe(true); // patamar, cota 1,40 m
    expect(pointInMulti(v(0.14, 0), hole)).toBe(false); // degrau 1 (topo 0,175 m)
    expect(pointInMulti(v(0.98, 0), hole)).toBe(true); // degrau 4 (topo 0,70 m)
    expect(multiArea(hole)).toBeCloseTo(HOLE_L, 9);
  });

  it('contorno completo: a projeção inteira (14 degraus e o patamar)', () => {
    expect(multiArea(holeOf(L({ openingMode: 'full' }), RING_L))).toBeCloseTo(FOOT_L, 9);
  });

  it('retângulo: o envolvente de menor área contém a região e não passa da caixa dos eixos (3,16 × 3,16 m)', () => {
    for (const mode of ['full', 'headroom'] as const) {
      const p = L({ openingMode: mode, openingRect: true });
      const hole = holeOf(p, RING_L);
      const foot = resolveStairs(p)[0]!.footprint;
      const region = mode === 'full' ? foot : holeOf(L(), RING_L);
      expect(multiArea(difference(region, hole))).toBeLessThan(1e-9);
      expect(multiArea(hole)).toBeLessThan(3.16 * 3.16 + 1e-9);
      expect(multiArea(hole)).toBeGreaterThanOrEqual(multiArea(region) - 1e-9);
    }
  });

  it('a laje que sobra é a laje crua menos o furo do L', () => {
    const p = L();
    expect(multiArea(resolveSlabs(p, 'lv_1')[0]!.polygon)).toBeCloseTo(6 * 5 - HOLE_L, 9);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Furo por elemento: cada laje e piso do nível de topo fura pela própria face inferior (decisão 0011, §6).

/** Divisa em x entre as duas metades: o degrau i ocupa (i−1)·0,28 a i·0,28, então 2,52 m é o fim do degrau 9. */
const SPLIT_X = 2.52;
const LEFT = box(-1, -1, SPLIT_X, 1);
const RIGHT = box(SPLIT_X, -1, 6, 1);
const SLAB_15: SlabType = {
  id: 'ls_15',
  name: 'Laje 15 cm',
  code: 'LJ-15C',
  description: 'Laje maciça de 15 cm',
  layers: [{ function: 'structure', materialId: 'mat_concreto', thickness: 0.15, wraps: false }],
  cost: 0,
};

const slabAt = (p: Project, id: string) => resolveSlabs(p, 'lv_1').find((s) => s.slabId === id)!.polygon;
const floorAt = (p: Project, id: string) => resolveFloors(p, 'lv_1').find((f) => f.floorId === id)!.polygon;
/** Área que o furo tira do contorno cru `ring` (o resolvido é sempre um subconjunto dele). */
const lost = (ring: Vec2[], polygon: MultiPolygon): number => multiArea(difference([[ring]], polygon));
/** Área dos degraus cujo topo fica a menos de 2,10 m da face inferior `underside`, dentro de `ring` (o que o furo deve tirar). */
function expectedLost(p: Project, ring: Vec2[], underside: number, headroom = 2.1): number {
  const treads = resolveStairs(p)[0]!.steps.filter((s) => s.kind === 'tread');
  return treads.filter((s) => underside - s.z <= headroom + 1e-9).reduce((a, s) => a + multiArea(intersection([[s.polygon]], [[ring]])), 0);
}

describe('furo por elemento: duas lajes do pavimento 2 com cotas diferentes (decisão 0011, §6)', () => {
  it('laje alta (+0,60 m) tira só os degraus 7 a 9 da metade esquerda; a de 0 m tira os degraus 10 a 15 da direita', () => {
    const p = build({
      slabTypes: [SLAB_15],
      slabs: [
        { id: 'hi', typeId: 'ls_15', boundary: LEFT, heightOffset: 0.6 },
        { id: 'lo', typeId: 'ls_15', boundary: RIGHT },
      ],
    }).project;
    expect(lost(LEFT, slabAt(p, 'hi'))).toBeCloseTo(3 * TREAD_AREA, 9);
    expect(lost(RIGHT, slabAt(p, 'lo'))).toBeCloseTo(6 * TREAD_AREA, 9);
    expect(lost(LEFT, slabAt(p, 'hi'))).toBeCloseTo(expectedLost(p, LEFT, UPPER + 0.6 - 0.15), 9);
    expect(lost(RIGHT, slabAt(p, 'lo'))).toBeCloseTo(expectedLost(p, RIGHT, UPPER - 0.15), 9);
    expect(pointInMulti(v(1.26, 0), slabAt(p, 'hi'))).toBe(true); // degrau 5, topo 0,875 m: folga 2,375 m, fica na laje alta
    expect(pointInMulti(v(2.1, 0), slabAt(p, 'hi'))).toBe(false); // degrau 8, topo 1,40 m: folga 1,85 m, sai
    expect(pointInMulti(v(2.66, 0), slabAt(p, 'lo'))).toBe(false); // degrau 10, sai da laje de 0 m
  });

  it('laje baixa (−0,30 m) tira também os degraus 2 e 3: 2 a 9 da metade esquerda, não só 4 a 9', () => {
    const p = build({
      slabTypes: [SLAB_15],
      slabs: [
        { id: 'lo', typeId: 'ls_15', boundary: LEFT, heightOffset: -0.3 },
        { id: 'ref', typeId: 'ls_15', boundary: RIGHT },
      ],
    }).project;
    expect(lost(LEFT, slabAt(p, 'lo'))).toBeCloseTo(8 * TREAD_AREA, 9);
    expect(lost(RIGHT, slabAt(p, 'ref'))).toBeCloseTo(6 * TREAD_AREA, 9);
  });

  it('piso (+0,60 m) e laje (0 m) no mesmo nível: cada um com o seu furo', () => {
    const p = build({
      slabTypes: [SLAB_15],
      slabs: [{ id: 'lo', typeId: 'ls_15', boundary: RIGHT }],
      floors: [{ id: 'fl', typeId: 'ft_laje12', boundary: LEFT, heightOffset: 0.6 }],
    }).project;
    expect(lost(LEFT, floorAt(p, 'fl'))).toBeCloseTo(3 * TREAD_AREA, 9);
    expect(lost(RIGHT, slabAt(p, 'lo'))).toBeCloseTo(6 * TREAD_AREA, 9);
  });
});

describe('furo por elemento: modos, inclinação e cotas extremas (decisão 0011, §6)', () => {
  const finite = (poly: MultiPolygon): boolean => poly.flat(2).every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));

  it('modo "full" com duas lajes: cada uma perde a sua parte da pegada, sem olhar a cota', () => {
    for (const offset of [0.6, 0]) {
      const p = build({
        stair: { openingMode: 'full' },
        slabTypes: [SLAB_15],
        slabs: [
          { id: 'hi', typeId: 'ls_15', boundary: LEFT, heightOffset: offset },
          { id: 'lo', typeId: 'ls_15', boundary: RIGHT },
        ],
      }).project;
      expect(lost(LEFT, slabAt(p, 'hi'))).toBeCloseTo(9 * TREAD_AREA, 9);
      expect(lost(RIGHT, slabAt(p, 'lo'))).toBeCloseTo(6 * TREAD_AREA, 9);
    }
  });

  it('modo "none" com duas lajes de cotas diferentes: nenhuma perde nada', () => {
    const p = build({
      stair: { openingMode: 'none' },
      slabTypes: [SLAB_15],
      slabs: [
        { id: 'hi', typeId: 'ls_15', boundary: LEFT, heightOffset: 0.6 },
        { id: 'lo', typeId: 'ls_15', boundary: RIGHT },
      ],
    }).project;
    expect(stairOpeningsOnLevel(p, 'lv_1')).toEqual([]);
    expect(multiArea(slabAt(p, 'hi'))).toBeCloseTo(multiArea([[LEFT]]), 9);
    expect(multiArea(slabAt(p, 'lo'))).toBeCloseTo(multiArea([[RIGHT]]), 9);
  });

  it('pé-direito livre com openingHeadroom de 3,00 m: a laje alta (face 3,25 m) perde os degraus 2 a 9 da metade esquerda', () => {
    const p = build({
      stair: { openingHeadroom: 3 },
      slabTypes: [SLAB_15],
      slabs: [
        { id: 'hi', typeId: 'ls_15', boundary: LEFT, heightOffset: 0.6 },
        { id: 'lo', typeId: 'ls_15', boundary: RIGHT },
      ],
    }).project;
    // Limite: 3,25 − 3,00 = 0,25 m. Degrau k tem topo k·0,175: entram os de k ≥ 2 (0,35 m); a metade esquerda vai do 1 ao 9.
    expect(lost(LEFT, slabAt(p, 'hi'))).toBeCloseTo(8 * TREAD_AREA, 9);
    expect(lost(LEFT, slabAt(p, 'hi'))).toBeCloseTo(expectedLost(p, LEFT, UPPER + 0.6 - 0.15, 3), 9);
    // Lajes de 2,65 m: limite −0,35 m, todos os degraus da metade direita (10 a 15) entram.
    expect(lost(RIGHT, slabAt(p, 'lo'))).toBeCloseTo(6 * TREAD_AREA, 9);
  });

  it('laje inclinada: o furo usa a menor cota da face inferior do contorno (conservador), então é o mesmo de uma laje plana nela', () => {
    const slope = { origin: v(-1, 0), dir: v(1, 0), percent: 5 }; // face superior sobe 5 % no sentido +x: 0,35 m em x = 6
    const inclined = build({ slabTypes: [SLAB_15], slabs: [{ id: 'inc', typeId: 'ls_15', boundary: SLAB_RING, slope }] }).project;
    const flat = build({ slabTypes: [SLAB_15], slabs: [{ id: 'flat', typeId: 'ls_15', boundary: SLAB_RING }] }).project;
    const poly = slabAt(inclined, 'inc');
    expect(finite(poly)).toBe(true);
    expect(lost(SLAB_RING, poly)).toBeCloseTo(12 * TREAD_AREA, 9); // degraus 4 a 15, como com a face inferior em 2,65 m
    expect(lost(SLAB_RING, poly)).toBeCloseTo(lost(SLAB_RING, slabAt(flat, 'flat')), 9);
    expect(lost(SLAB_RING, poly)).toBeCloseTo(expectedLost(inclined, SLAB_RING, UPPER - 0.15), 9);
  });

  it('laje com face superior abaixo do topo de alguns degraus (−0,30 m): sem NaN, degraus 2 a 15 saem', () => {
    const p = build({ slabTypes: [SLAB_15], slabs: [{ id: 'low', typeId: 'ls_15', boundary: SLAB_RING, heightOffset: -0.3 }] }).project;
    const poly = slabAt(p, 'low');
    expect(finite(poly)).toBe(true);
    expect(lost(SLAB_RING, poly)).toBeCloseTo(14 * TREAD_AREA, 9); // degrau 15 (topo 2,625 m) passa da face superior 2,50 m
    expect(lost(SLAB_RING, poly)).toBeCloseTo(expectedLost(p, SLAB_RING, UPPER - 0.3 - 0.15), 9);
  });

  it('laje abaixo de todos os degraus (−2,00 m): sem exceção, a escada inteira sai e a laje fica com a área que sobra', () => {
    const p = build({ slabTypes: [SLAB_15], slabs: [{ id: 'deep', typeId: 'ls_15', boundary: SLAB_RING, heightOffset: -2 }] }).project;
    const poly = slabAt(p, 'deep');
    expect(finite(poly)).toBe(true);
    expect(lost(SLAB_RING, poly)).toBeCloseTo(15 * TREAD_AREA, 9);
  });

  it('a união cresce quando a face inferior desce: o furo a 3,25 m está contido no furo a 2,65 m', () => {
    const p = build({ slabs: [{ id: 's1', boundary: SLAB_RING }] }).project;
    const openings = stairOpeningsOnLevel(p, 'lv_1');
    const high = stairHolesFor(openings, UPPER + 0.6 - 0.15);
    const low = stairHolesFor(openings, UPPER - 0.15);
    expect(multiArea(high)).toBeCloseTo(9 * TREAD_AREA, 9); // degraus 7 a 15
    expect(multiArea(low)).toBeCloseTo(12 * TREAD_AREA, 9); // degraus 4 a 15
    expect(multiArea(difference(high, low))).toBeLessThan(1e-9);
  });

  it('coverUnderside: sem inclinação é a face inferior; com inclinação, a menor cota do contorno', () => {
    const ring = SLAB_RING;
    expect(coverUnderside(2.65, null, [ring])).toBe(2.65);
    expect(coverUnderside(2.65, { origin: v(-1, 0), dir: v(1, 0), percent: 5 }, [ring])).toBeCloseTo(2.65, 12);
    expect(coverUnderside(2.65, { origin: v(-1, 0), dir: v(1, 0), percent: -5 }, [ring])).toBeCloseTo(2.65 - 0.35, 12);
    expect(coverUnderside(2.65, { origin: v(6, 0), dir: v(-1, 0), percent: 5 }, [ring])).toBeCloseTo(2.65, 12);
  });
});
