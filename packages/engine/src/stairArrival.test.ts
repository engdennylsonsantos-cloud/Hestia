import { describe, expect, it } from 'vitest';
import { mid, pointInRing, type Vec2 } from '@hestia/geom';
import {
  DEFAULT_SLAB_TYPES,
  ProjectStore,
  createEmptyProject,
  defaultStairTypeId,
  makeFloor,
  makeSlab,
  makeStair,
  type Project,
  type SlabSlope,
  type SlabType,
  type StairCurve,
  type StairRun,
} from '@hestia/model';
import {
  arrivalFrameFrom,
  pieceBottomZ,
  resolveStairs,
  sectionOfStairs,
  stairArrivalTop,
  stairArrivalTopZ,
  stairBody,
  type ResolvedStair,
  type StairBodyPiece,
} from './index.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });
const box = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [v(x0, y0), v(x1, y0), v(x1, y1), v(x0, y1)];

/** Lance reto em +x: 16 espelhos a cada 0,28 m (h = 0,175 m); o último espelho (nº 16) está em x = 4,20 m. Largura 1,20 m. */
function straight(): StairRun {
  const xs = Array.from({ length: 16 }, (_, k) => k * 0.28);
  const b = 15 * 0.28 + 0.5;
  return {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(-0.5, 0.6, b, 0.6)],
    boundaryRight: [ln(-0.5, -0.6, b, -0.6)],
    risers: xs.map((x) => ln(x, -1, x, 1)),
    path: [],
  };
}

/** Pavimento de topo a 2,80 m. A escada `st1` nasce no térreo e sobe até ele. */
const UPPER = 2.8;
const SLAB_RING = box(-1, -1, 6, 1);
/** Metade da frente (cobre o último espelho, em x = 4,20 m) e metade de trás (não cobre). */
const SPLIT_X = 2.52;
const FRONT = box(SPLIT_X, -1, 6, 1);
const BACK = box(-1, -1, SPLIT_X, 1);
const LONG = { a: v(-1, 0), b: v(6, 0), depth: 2 };

/** Laje de 0,15 m (o tipo padrão tem 0,17 m, então o teste define o seu). */
const SLAB_15: SlabType = {
  ...DEFAULT_SLAB_TYPES[0]!,
  id: 'ls_15',
  name: 'Laje 15 cm',
  code: 'LJ-15C',
  layers: [{ function: 'structure', materialId: 'mat_concreto', thickness: 0.15, wraps: false }],
};

interface Setup {
  slabs?: Array<{ id: string; boundary: Vec2[]; heightOffset?: number; slope?: SlabSlope | null }>;
  floors?: Array<{ id: string; boundary: Vec2[]; heightOffset?: number }>;
}

function build(o: Setup = {}): Project {
  const base = createEmptyProject();
  const store = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: UPPER } : l)) });
  store.exec({ type: 'upsertSlabType', slabType: SLAB_15 });
  store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [straight()] }) });
  for (const s of o.slabs ?? []) store.exec({ type: 'addSlab', slab: makeSlab({ typeId: 'ls_15', levelId: 'lv_1', ...s }) });
  for (const f of o.floors ?? []) store.exec({ type: 'addFloor', floor: makeFloor({ typeId: 'ft_laje12', levelId: 'lv_1', ...f }) });
  return store.project;
}

const stairOf = (p: Project): ResolvedStair => resolveStairs(p).find((r) => r.id === 'st1')!;
const arrivalOf = (pieces: StairBodyPiece[]): StairBodyPiece => pieces.find((q) => q.kind === 'arrival')!;

/** Ponto médio do espelho `j` (1-based) do lance único. */
const riserMid = (s: ResolvedStair, j: number): Vec2 => {
  const r = s.risers.find((x) => x.index === j)!;
  return mid(r.a, r.b);
};

/** Intervalos [fundo, topo] das peças que contêm `q`, com o fundo avaliado no ponto de contato `m`. */
function spans(pieces: StairBodyPiece[], q: Vec2, m: Vec2): Array<[number, number]> {
  return pieces.filter((p) => pointInRing(q, p.polygon)).map((p) => [pieceBottomZ(p, m.x, m.y), p.zTop]);
}

/** Sem fresta vertical no espelho `m`: os intervalos das peças vizinhas (antes e depois, 1 µm) se sobrepõem. */
function expectSealed(pieces: StairBodyPiece[], m: Vec2): void {
  const eps = 1e-6;
  const before = spans(pieces, v(m.x - eps, m.y), m);
  const after = spans(pieces, v(m.x + eps, m.y), m);
  expect(before.length).toBeGreaterThan(0);
  expect(after.length).toBeGreaterThan(0);
  for (const [b0, b1] of before) for (const [a0, a1] of after) expect(Math.max(b0, a0)).toBeLessThanOrEqual(Math.min(b1, a1) + 1e-9);
}

describe('chegada pela face inferior da laje ou do piso que cobre o último espelho (decisão 0012 §2)', () => {
  it('sem laje nem piso sobre a escada: null, e a chegada fica em topo − 0,15 m', () => {
    const p = build();
    expect(stairArrivalTopZ(p, stairOf(p))).toBeNull();
    expect(arrivalOf(stairBody(stairOf(p)).pieces).zTop).toBeCloseTo(UPPER - 0.15, 9);
  });

  it('laje que só cobre a metade de trás (não o último espelho) não conta: null, e o padrão vale', () => {
    const p = build({ slabs: [{ id: 'tras', boundary: BACK, heightOffset: 0.6 }] });
    expect(stairArrivalTopZ(p, stairOf(p))).toBeNull();
    expect(arrivalOf(stairBody(stairOf(p)).pieces).zTop).toBeCloseTo(UPPER - 0.15, 9);
  });

  it('duas lajes sobre a escada, offsets +0,60 e +0,30: a chegada termina na face inferior da mais baixa (2,95 m), em qualquer ordem', () => {
    const alta = { id: 'alta', boundary: SLAB_RING, heightOffset: 0.6 };
    const baixa = { id: 'baixa', boundary: SLAB_RING, heightOffset: 0.3 };
    for (const slabs of [[alta, baixa], [baixa, alta]]) {
      const p = build({ slabs });
      const topZ = stairArrivalTopZ(p, stairOf(p));
      expect(topZ).toBeCloseTo(UPPER + 0.3 - 0.15, 9);
      expect(arrivalOf(stairBody(stairOf(p), { arrivalTopZ: topZ! }).pieces).zTop).toBeCloseTo(2.95, 9);
    }
  });

  it('só as lajes que cobrem o último espelho contam: a da frente (+0,30) manda; a da metade de trás (+0,60) não entra', () => {
    const p = build({
      slabs: [
        { id: 'tras', boundary: BACK, heightOffset: 0.6 },
        { id: 'frente', boundary: FRONT, heightOffset: 0.3 },
      ],
    });
    expect(stairArrivalTopZ(p, stairOf(p))).toBeCloseTo(2.95, 9);
  });

  it('laje e piso sobre o último espelho: vale a menor face inferior (piso com −0,20 m: 2,80 − 0,20 − 0,15 = 2,45 m)', () => {
    const p = build({ slabs: [{ id: 'laje', boundary: SLAB_RING }], floors: [{ id: 'piso', boundary: SLAB_RING, heightOffset: -0.2 }] });
    expect(stairArrivalTopZ(p, stairOf(p))).toBeCloseTo(2.45, 9);
  });

  it('laje inclinada: a menor cota da face inferior no contorno, como no furo (−2 % de x = −1 a x = 6: 2,65 − 0,14 = 2,51 m)', () => {
    const slope: SlabSlope = { origin: v(-1, 0), dir: v(1, 0), percent: -2 };
    const p = build({ slabs: [{ id: 'inc', boundary: SLAB_RING, slope }] });
    expect(stairArrivalTopZ(p, stairOf(p))).toBeCloseTo(2.51, 9);
  });

  it('laje mais baixa que o padrão (offset −0,10 → 2,55 m): sem espessura negativa, estanque em todos os espelhos e com o topo no corte', () => {
    const p = build({ slabs: [{ id: 'baixa', boundary: SLAB_RING, heightOffset: -0.1 }] });
    const s = stairOf(p);
    const topZ = stairArrivalTopZ(p, s)!;
    expect(topZ).toBeCloseTo(2.55, 9);
    const { pieces } = stairBody(s, { arrivalTopZ: topZ });
    const arrival = arrivalOf(pieces);
    expect(arrival.zTop).toBeCloseTo(2.55, 9);
    for (const q of arrival.polygon) expect(pieceBottomZ(arrival, q.x, q.y)).toBeLessThanOrEqual(arrival.zTop + 1e-9);
    for (let j = 2; j <= 16; j++) expectSealed(pieces, riserMid(s, j));

    // Corte longitudinal: alguma seção da chegada tem o topo em 2,55 m.
    const sk = sectionOfStairs([s], LONG, p);
    const cutTops = sk.cut.map((c) => Math.max(...c.polygon.flat().map((q) => q.y)));
    expect(cutTops.some((t) => Math.abs(t - 2.55) < 1e-9)).toBe(true);
  });
});

describe('chegada como degrau da própria escada quando o nível não é fechado', () => {
  it('sem laje nem piso: a chegada fecha no próprio nível (topZ), não 0,15 m abaixo', () => {
    const p = build();
    expect(stairArrivalTop(p, stairOf(p))).toEqual({ top: UPPER, covered: false });
  });

  it('com laje: a chegada termina na face inferior da laje e o degrau de chegada é o piso do nível', () => {
    const p = build({ slabs: [{ id: 'laje', boundary: SLAB_RING }] });
    const r = stairArrivalTop(p, stairOf(p));
    expect(r.covered).toBe(true);
    expect(r.top).toBeCloseTo(UPPER - 0.15, 9);
  });

  it('a frente da chegada sai dos dois últimos espelhos e não passa de 0,30 m', () => {
    const s = stairOf(build());
    const last = s.risers.find((r) => r.index === 16)!;
    const prev = s.risers.find((r) => r.index === 15)!;
    const f = arrivalFrameFrom(last, prev)!;
    expect(f.a).toEqual(last.a);
    expect(f.length).toBeCloseTo(0.28, 9);
    expect(f.u.x).toBeCloseTo(1, 9);
    expect(f.u.y).toBeCloseTo(0, 9);
    // Espelhos muito afastados: o comprimento fica limitado ao máximo.
    const far = arrivalFrameFrom({ a: v(0, 0), b: v(0, 1) }, { a: v(-2, 0), b: v(-2, 1) })!;
    expect(far.length).toBeCloseTo(0.3, 9);
  });
});
