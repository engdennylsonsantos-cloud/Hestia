import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project, type Roof } from '@hestia/model';
import { quantifyRoofs, resolveRoofs, roofTopAt, type ResolvedRoof, type RoofLine } from './index.ts';
import { setWeightedSkeleton } from './roofSkeleton.ts';
import { stubSkeleton } from './roofSkeletonStub.helper.ts';

/**
 * Caminho das águas por esqueleto (A10): 'shed', 'gable', 'hip' e 'edges' usam o mesmo cálculo. Estes testes usam o
 * esqueleto de teste (domínio convexo, pesos iguais); os valores dourados do esqueleto real estão em roofEdgesGolden.
 */
beforeAll(() => setWeightedSkeleton(stubSkeleton));
afterAll(() => setWeightedSkeleton(null));

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
/** Retângulo 8 x 6 anti-horário: arestas 0 (y = 0), 1 (x = 8), 2 (y = 6), 3 (x = 0). */
const R86 = rect(0, 0, 8, 6);
const ML = (lines: RoofLine[], kind: RoofLine['kind']): RoofLine[] => lines.filter((l) => l.kind === kind);
const len = (l: RoofLine): number => Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);
/** Valores distintos em ordem crescente (uma aresta pode ser partida em mais de uma peça). */
const distinct = (xs: number[]): number[] => [...new Set(xs.map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b);
/** Áreas em planta das águas, em ordem crescente. */
const areasOf = (r: ResolvedRoof): number[] => r.planes.map((pl) => multiArea(pl.polygon)).sort((a, b) => a - b);

function build(extra: Partial<Roof>, levelId = 'lv_0'): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId, boundary: R86, slopePercent: 30, ...extra }) });
  return s.project;
}
const one = (extra: Partial<Roof>): ResolvedRoof => resolveRoofs(build(extra), 'lv_0')[0]!;
const quantOf = (extra: Partial<Roof>) => quantifyRoofs(build(extra), 'lv_0').roofs[0]!;

describe('uma água pelo esqueleto', () => {
  // dir (0,1): sobe em y. A aresta 0 (y = 0) define; as demais são empenas.
  const shed: Partial<Roof> = { shape: 'shed', slopePercent: 30, dir: { x: 0, y: 1 } };

  it('uma água cobre o retângulo, com origem no beiral baixo e subida na direção dir', () => {
    const r = one(shed);
    expect(r.planes).toHaveLength(1);
    expect(r.planes[0]!.origin).toEqual({ x: 0, y: 0 });
    expect(r.planes[0]!.up.x).toBeCloseTo(0, 12);
    expect(r.planes[0]!.up.y).toBeCloseTo(1, 12);
    expect(r.planes[0]!.z0).toBe(0);
    expect(r.problem).toBeUndefined();
  });

  it('cotas: 0 no beiral baixo, 1,80 no alto; o lado alto é empena, não cumeeira', () => {
    const r = one(shed);
    expect(roofTopAt(r, { x: 4, y: 0 })).toBeCloseTo(0, 9);
    expect(roofTopAt(r, { x: 4, y: 6 })).toBeCloseTo(1.8, 9);
    expect(ML(r.lines, 'ridge')).toHaveLength(0);
    expect(ML(r.lines, 'eave')).toHaveLength(1);
    expect(ML(r.lines, 'gable')).toHaveLength(3);
  });

  it('empenas: laterais em trapézio (5,4 m² cada) e o lado alto de 8 m a 1,80 m (14,4 m²); total 25,2 m²', () => {
    const q = quantOf(shed);
    expect(q.gableLength).toBeCloseTo(20, 9);
    expect(q.gableArea).toBeCloseTo(5.4 + 5.4 + 14.4, 9);
    expect(q.slopedEdges).toBe(1);
    expect(q.eaveLength).toBeCloseTo(8, 9);
  });
});

describe('duas águas pelo esqueleto', () => {
  const gable: Partial<Roof> = { shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 } };

  it('duas águas de 24 m², cumeeira em y = 3 e 0,90 m no meio', () => {
    const r = one(gable);
    expect(r.planes).toHaveLength(2);
    expect(areasOf(r)).toEqual([24, 24].map((v) => expect.closeTo(v, 9)));
    expect(roofTopAt(r, { x: 4, y: 3 })).toBeCloseTo(0.9, 9);
    expect(roofTopAt(r, { x: 4, y: 0 })).toBeCloseTo(0, 9);
  });

  it('cumeeira de 8 m; beirais nas duas arestas longas; empenas nas curtas', () => {
    const r = one(gable);
    expect(sum(ML(r.lines, 'ridge').map(len))).toBeCloseTo(8, 9);
    expect(ML(r.lines, 'eave')).toHaveLength(2);
    // Cada empena é partida pela água que a toca: duas peças por ponta, somando 12 m.
    expect(sum(ML(r.lines, 'gable').map(len))).toBeCloseTo(12, 9);
    expect(quantOf(gable).gableLength).toBeCloseTo(12, 9);
  });

  it('empenas: 5,4 m² no total (cada ponta tem duas águas, de 0 a 0,90 m, em dois trapézios de 1,35 m²)', () => {
    expect(quantOf(gable).gableArea).toBeCloseTo(5.4, 9);
  });
});

describe('quatro águas pelo esqueleto', () => {
  const hip: Partial<Roof> = { shape: 'hip', slopePercent: 30 };

  it('quatro águas com áreas 9, 9, 15 e 15; altura 0,90 m no centro; 0,30 m a 1 m da borda', () => {
    const r = one(hip);
    expect(r.planes).toHaveLength(4);
    expect(areasOf(r)).toEqual([9, 9, 15, 15].map((v) => expect.closeTo(v, 9)));
    expect(roofTopAt(r, { x: 4, y: 3 })).toBeCloseTo(0.9, 9);
    expect(roofTopAt(r, { x: 1, y: 3 })).toBeCloseTo(0.3, 9);
  });

  it('cumeeira de 2 m; quatro espigões; sem empena; quatro arestas com inclinação', () => {
    const r = one(hip);
    expect(sum(ML(r.lines, 'ridge').map(len))).toBeCloseTo(2, 9);
    expect(ML(r.lines, 'hip')).toHaveLength(4);
    expect(ML(r.lines, 'gable')).toHaveLength(0);
    const q = quantOf(hip);
    expect(q.slopedEdges).toBe(4);
    // Espigão de (0,0) a (3,3): planta √18 e desnível 0,90 m, então 3D √18,81 = 4,3370 m.
    expect(q.hipLength).toBeCloseTo(4 * Math.sqrt(18.81), 6);
  });
});

describe('forma por arestas (edges)', () => {
  it('[30, null, 30, null] com retângulo: as arestas 0 e 2 definem, 1 e 3 são empenas', () => {
    const r = one({ shape: 'edges', edgeSlopes: [30, null, 30, null], edgeOverhangs: [0, 0, 0, 0] });
    expect(r.planes).toHaveLength(2);
    expect(roofTopAt(r, { x: 4, y: 3 })).toBeCloseTo(0.9, 9);
    expect(ML(r.lines, 'eave')).toHaveLength(2);
    expect(sum(ML(r.lines, 'gable').map(len))).toBeCloseTo(12, 9);
    expect(ML(r.lines, 'ridge')).toHaveLength(1);
  });

  it('o contorno horário dá o mesmo resultado: os índices das arestas voltam à ordem original', () => {
    // Mesmo retângulo, percorrido no sentido horário: aresta 1 = topo (y = 6), aresta 3 = base (y = 0).
    const cw: Vec2[] = [
      { x: 0, y: 0 },
      { x: 0, y: 6 },
      { x: 8, y: 6 },
      { x: 8, y: 0 },
    ];
    const r = one({ shape: 'edges', boundary: cw, edgeSlopes: [null, 30, null, 30], edgeOverhangs: [0, 0, 0, 0] });
    expect(r.planes).toHaveLength(2);
    expect(roofTopAt(r, { x: 4, y: 3 })).toBeCloseTo(0.9, 9);
    expect(distinct(ML(r.lines, 'eave').map((l) => l.a.y))).toEqual([0, 6]);
    expect(distinct(ML(r.lines, 'gable').map((l) => l.a.x))).toEqual([0, 8]);
  });

  it('nenhuma aresta define inclinação: telhado plano, uma água horizontal na cota do beiral, sem empena', () => {
    // Antes a recusa "nenhuma aresta define inclinação"; agora o telhado é plano (como no Revit).
    const r = one({ shape: 'edges', edgeSlopes: [null, null, null, null], edgeOverhangs: [0, 0, 0, 0] });
    expect(r.problem).toBeUndefined();
    expect(r.planes).toHaveLength(1);
    expect(r.planes[0]!.percent).toBe(0);
    expect(roofTopAt(r, { x: 4, y: 3 })).toBe(0);
    expect(ML(r.lines, 'gable')).toEqual([]);
  });

  it('lista de arestas com tamanho errado: sem águas e com o motivo (sem lançar)', () => {
    const p = build({ shape: 'edges', edgeSlopes: [30, null, 30, null], edgeOverhangs: [0, 0, 0, 0] });
    const bad = { ...p, elements: { r1: { ...(p.elements.r1 as Roof), edgeSlopes: [30, null, 30] } } };
    const [r] = resolveRoofs(bad, 'lv_0');
    expect(r!.planes).toEqual([]);
    expect(r!.problem).toContain('não batem com as arestas do contorno');
  });
});

describe('falha do cálculo cai na envoltória, e o telhado não some', () => {
  it('contorno em L com quatro águas no esqueleto de teste (côncavo): a envoltória fecha, com águas e sem motivo', () => {
    const L: Vec2[] = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 6 },
      { x: 0, y: 6 },
    ];
    const rs = resolveRoofs(build({ shape: 'hip', boundary: L }), 'lv_0');
    expect(rs).toHaveLength(1);
    expect(rs[0]!.problem).toBeUndefined();
    expect(rs[0]!.planes.length).toBeGreaterThan(0);
  });

  it('o solver falha: o telhado segue pela envoltória, com águas e sem o motivo do solver', () => {
    setWeightedSkeleton(() => ({ faces: [], arcs: [], ok: false, reason: 'o cálculo de águas não está disponível' }));
    try {
      const r = one({ shape: 'hip' });
      expect(r.problem).toBeUndefined();
      expect(r.planes).toHaveLength(4);
    } finally {
      setWeightedSkeleton(stubSkeleton);
    }
  });

  it('solver que lança exceção não derruba o cálculo: a envoltória assume e o telhado tem águas', () => {
    setWeightedSkeleton(() => {
      throw new Error('boom');
    });
    try {
      const rs = resolveRoofs(build({ shape: 'hip' }), 'lv_0');
      expect(rs).toHaveLength(1);
      expect(rs[0]!.problem).toBeUndefined();
      expect(rs[0]!.planes).toHaveLength(4);
    } finally {
      setWeightedSkeleton(stubSkeleton);
    }
  });

  it('solver que falha e sobra região sem aresta inclinada que a cubra: o motivo é o da envoltória', () => {
    // U com só a base interna inclinada: os braços ficam do outro lado dela, sem aresta que os cubra.
    const U: Vec2[] = [
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 9, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 6 },
      { x: 0, y: 6 },
    ];
    setWeightedSkeleton(() => ({ faces: [], arcs: [], ok: false, reason: 'o cálculo de águas não está disponível' }));
    try {
      const r = one({ shape: 'edges', boundary: U, edgeSlopes: [null, null, null, null, 30, null, null, null], edgeOverhangs: U.map(() => 0) });
      expect(r.planes).toEqual([]);
      expect(r.problem).toBe('o contorno tem uma região sem nenhuma aresta inclinada que a cubra');
    } finally {
      setWeightedSkeleton(stubSkeleton);
    }
  });
});

describe('orientação das arestas por forma (regra da migração 9→10)', () => {
  it('gable com dir vertical: as arestas paralelas a dir (x = 0 e x = 8) são beirais; as horizontais são empenas', () => {
    const r = one({ shape: 'gable', dir: { x: 0, y: 1 } });
    expect(distinct(ML(r.lines, 'eave').map((l) => l.a.x))).toEqual([0, 8]);
    expect(distinct(ML(r.lines, 'gable').map((l) => l.a.y))).toEqual([0, 6]);
  });
});
