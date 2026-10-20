import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project } from '@hestia/model';
import { quantifyRoofs, resolveRoofs, roofTopAt, type ResolvedRoof, type RoofLine } from './index.ts';

/**
 * Casos dourados do esqueleto real por aresta (A10, G3), valores derivados à mão. Usam o solver instalado (sem o
 * esqueleto de teste). Inclinação 30 %: subida 0,30 por metro; área real = planta × √1,09 (1 / cos(atan 0,3)).
 */
const SLOPE = Math.sqrt(1.09);
const ML = (lines: RoofLine[], kind: RoofLine['kind']): RoofLine[] => lines.filter((l) => l.kind === kind);
const len = (l: RoofLine): number => Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

/** Telhado de contorno qualquer; `edgeSlopes` por aresta (null = empena). Cota do beiral 0. */
function build(boundary: Vec2[], edgeSlopes: Array<number | null>, holes: Vec2[][] = []): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addRoof',
    roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary, holes, shape: 'edges', edgeSlopes, edgeOverhangs: boundary.map(() => 0) }),
  });
  return s.project;
}
const solve = (boundary: Vec2[], edgeSlopes: Array<number | null>, holes: Vec2[][] = []): ResolvedRoof => resolveRoofs(build(boundary, edgeSlopes, holes), 'lv_0')[0]!;
const quant = (boundary: Vec2[], edgeSlopes: Array<number | null>, holes: Vec2[][] = []) => quantifyRoofs(build(boundary, edgeSlopes, holes), 'lv_0').roofs[0]!;

describe('G3 · L ortogonal 8 x 8 com recorte de 4 x 4, 30 % em todas as arestas', () => {
  const L: Vec2[] = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 8 },
    { x: 0, y: 8 },
  ];
  const all = [30, 30, 30, 30, 30, 30];

  it('seis águas (uma por aresta), sem motivo de falha', () => {
    const r = solve(L, all);
    expect(r.problem).toBeUndefined();
    expect(r.planes).toHaveLength(6);
  });

  it('soma das áreas em planta = 48 m²; área real = 48 × √1,09 = 50,1135 m²', () => {
    const r = solve(L, all);
    expect(sum(r.planes.map((pl) => multiArea(pl.polygon)))).toBeCloseTo(48, 6);
    expect(quant(L, all).faceArea).toBeCloseTo(48 * SLOPE, 6);
    expect(quant(L, all).faceArea).toBeCloseTo(50.1135, 4);
  });

  it('um rincão, que começa no vértice reentrante (4; 4)', () => {
    const r = solve(L, all);
    const valleys = ML(r.lines, 'valley');
    expect(valleys).toHaveLength(1);
    const v = valleys[0]!;
    const reentrant = [v.a, v.b].some((p) => Math.hypot(p.x - 4, p.y - 4) < 1e-6);
    expect(reentrant).toBe(true);
  });
});

describe('G3 · o mesmo L percorrido no sentido horário (o solver recebe anti-horário; o mapa de arestas volta)', () => {
  // Arestas do L anti-horário: 0 (0,0)-(8,0), 1 (8,0)-(8,4), 2 (8,4)-(4,4), 3 (4,4)-(4,8), 4 (4,8)-(0,8), 5 (0,8)-(0,0).
  // Pesos: só a aresta 0 (base, y = 0) e a 4 (topo, y = 8) definem; as demais são empenas.
  const LCCW: Vec2[] = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 8 },
    { x: 0, y: 8 },
  ];
  const LCW = [...LCCW].reverse();
  // No horário, a aresta 0 vai de (0,8) a (4,8) (topo) e a 4 de (8,0) a (0,0) (base): os pesos ficam nos mesmos índices.
  const slopesCCW = [30, null, null, null, 30, null];
  const slopesCW = [30, null, null, null, 30, null];

  it('mesma área em planta, mesmos beirais, mesma cota no meio da base', () => {
    const a = solve(LCCW, slopesCCW);
    const b = solve(LCW, slopesCW);
    expect(b.problem).toBeUndefined();
    expect(sum(b.planes.map((pl) => multiArea(pl.polygon)))).toBeCloseTo(sum(a.planes.map((pl) => multiArea(pl.polygon))), 6);
    expect(b.planes.length).toBe(a.planes.length);
    expect(ML(b.lines, 'eave').map(len).reduce((s, x) => s + x, 0)).toBeCloseTo(ML(a.lines, 'eave').map(len).reduce((s, x) => s + x, 0), 6);
  });
});

describe('G3 · triângulo retângulo 6 x 4 com duas arestas a 30 % e uma empena', () => {
  const T: Vec2[] = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 0, y: 4 },
  ];
  // Apex da divisa de bissetriz: y = 24 / (6 + √52) = 1,81665 m; a água da base tem área 3 × y e a da hipotenusa 12 − 3 × y.
  const yb = 24 / (6 + Math.sqrt(52));

  it('duas águas: áreas 3 × 1,81665 = 5,44996 m² e 6,55004 m²', () => {
    const r = solve(T, [30, 30, null]);
    expect(r.planes).toHaveLength(2);
    const areas = r.planes.map((pl) => multiArea(pl.polygon)).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(3 * yb, 6);
    expect(areas[1]).toBeCloseTo(12 - 3 * yb, 6);
  });

  it('a divisa entre as duas águas é um espigão de (6; 0) a (0; yb), de 3D √(39,30 + 0,297) = 6,2926 m', () => {
    const q = quant(T, [30, 30, null]);
    expect(ML(solve(T, [30, 30, null]).lines, 'hip')).toHaveLength(1);
    expect(q.hipLength).toBeCloseTo(Math.hypot(6, yb, 0.3 * yb), 6);
    expect(q.hipLength).toBeCloseTo(6.2926, 4);
  });

  it('empena no lado x = 0 (4 m): área do triângulo vertical sob as duas águas = 0,6 × yb = 1,0900 m²; pico 0,545 m', () => {
    const q = quant(T, [30, 30, null]);
    expect(q.gableLength).toBeCloseTo(4, 9);
    expect(q.gableArea).toBeCloseTo(0.6 * yb, 6);
    expect(q.gableArea).toBeCloseTo(1.09, 4);
    expect(roofTopAt(solve(T, [30, 30, null]), { x: 0, y: yb })).toBeCloseTo(0.3 * yb, 6);
  });

  it('área real = 12 × √1,09 e as arestas com inclinação somam 2', () => {
    const q = quant(T, [30, 30, null]);
    expect(q.faceArea).toBeCloseTo(12 * SLOPE, 6);
    expect(q.slopedEdges).toBe(2);
  });
});

describe('G3 · decágono regular de raio 5 m, pesos iguais a 30 %', () => {
  const R = 5;
  const D: Vec2[] = Array.from({ length: 10 }, (_, k) => ({ x: R * Math.cos((k * Math.PI) / 5), y: R * Math.sin((k * Math.PI) / 5) }));
  const apothem = R * Math.cos(Math.PI / 10);

  it('dez águas, pirâmide: cumeeira de comprimento zero e topo a 0,30 × apótema no centro', () => {
    const r = solve(D, D.map(() => 30));
    expect(r.planes).toHaveLength(10);
    expect(sum(ML(r.lines, 'ridge').map(len))).toBeCloseTo(0, 6);
    expect(roofTopAt(r, { x: 0, y: 0 })).toBeCloseTo(0.3 * apothem, 6);
  });

  it('área em planta = ½ × 10 × R² × sen 36° = 73,4732 m²; dez espigões de 5 m em planta', () => {
    const r = solve(D, D.map(() => 30));
    expect(sum(r.planes.map((pl) => multiArea(pl.polygon)))).toBeCloseTo(73.4732, 3);
    expect(ML(r.lines, 'hip')).toHaveLength(10);
    expect(ML(r.lines, 'hip').map(len).every((l) => Math.abs(l - R) < 1e-6)).toBe(true);
  });
});

describe('G3 · retângulo 8 x 6 com furo central de 2 x 2 (x 3..5, y 2..4), 30 % no contorno', () => {
  const R: Vec2[] = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 6 },
    { x: 0, y: 6 },
  ];
  const hole: Vec2[] = [
    { x: 3, y: 2 },
    { x: 5, y: 2 },
    { x: 5, y: 4 },
    { x: 3, y: 4 },
  ];

  it('as águas cobrem o anel: soma das áreas em planta = 48 − 4 = 44 m²', () => {
    const r = solve(R, [30, 30, 30, 30], [hole]);
    expect(r.problem).toBeUndefined();
    expect(sum(r.planes.map((pl) => multiArea(pl.polygon)))).toBeCloseTo(44, 6);
  });

  it('dentro do furo não há telhado; à esquerda do furo a cota é 0,30 × distância à borda esquerda', () => {
    const r = solve(R, [30, 30, 30, 30], [hole]);
    expect(roofTopAt(r, { x: 4, y: 3 })).toBeNull();
    expect(roofTopAt(r, { x: 1.5, y: 3 })).toBeCloseTo(0.45, 6);
  });

  it('o furo não gera linha de cumeeira, espigão nem beiral', () => {
    const r = solve(R, [30, 30, 30, 30], [hole]);
    const inside = r.lines.filter((l) => {
      const m = { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2 };
      return m.x > 3 + 1e-6 && m.x < 5 - 1e-6 && m.y > 2 + 1e-6 && m.y < 4 - 1e-6;
    });
    expect(inside).toEqual([]);
  });
});
