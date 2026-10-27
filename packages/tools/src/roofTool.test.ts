import { describe, expect, it } from 'vitest';
import { polygonArea, ringArea, type Vec2 } from '@hestia/geom';
import { roofsOnLevel, type Project, type ProjectStore, type Roof } from '@hestia/model';
import { roofDirFor } from './roofGeom.ts';
import { ringPerimeter } from './floorPick.ts';
import { outerPerimeter } from './enclosed.ts';
import { commitPerimeter } from './perimeterCommit.ts';
import type { CommitPerimeterOptions, CommitPerimeterResult } from './perimeterCommitTypes.ts';
import { addSegs, newDraft, setSegSlope, type NewSeg } from './perimeterSession.ts';
import { drawWall, makeEnv } from './testEnv.ts';

const roofs = (p: Project): Roof[] => roofsOnLevel(p, 'lv_0');

/** Lados de um anel, na ordem do contorno: cada lado vai de um vértice ao seguinte. */
const sidesOf = (ring: Vec2[]): NewSeg[] => ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length]! }));
const retangulo = (w: number, h: number): Vec2[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];

/**
 * Cria o telhado pelo commit do perímetro (o caminho da faixa) e o aplica à loja. `semAguas` são os índices dos lados
 * que não definem inclinação; as demais opções substituem o padrão do rascunho.
 */
function criar(store: ProjectStore, segs: NewSeg[], opts: CommitPerimeterOptions = {}, semAguas: number[] = []): CommitPerimeterResult {
  let d = addSegs(newDraft('roof'), segs);
  for (const i of semAguas) d = setSegSlope(d, d.segs[i]!.id, { definesSlope: false });
  const r = commitPerimeter(store.project, d, { typeId: 'rt_ceramica', levelId: 'lv_0', ...opts });
  if (r.ok) for (const c of r.commands) store.exec(c);
  return r;
}

describe('ferramenta Telhado: criação pelo perímetro (A1)', () => {
  it('retângulo 6 × 4 cria o telhado com forma, inclinação e cota padrão', () => {
    const ctx = makeEnv();
    expect(criar(ctx.store, sidesOf(retangulo(6, 4))).ok).toBe(true);
    const rs = roofs(ctx.store.project);
    expect(rs).toHaveLength(1);
    const r = rs[0]!;
    expect(r.id.startsWith('t')).toBe(true);
    expect(r.kind).toBe('roof');
    expect(r.typeId).toBe('rt_ceramica');
    expect(r.levelId).toBe('lv_0');
    expect(r.boundary).toHaveLength(4);
    // A pegada é o retângulo desenhado; o beiral sai dele pelo balanço padrão de 0,5 m (cantos em esquadria: 7 × 5).
    expect(polygonArea([r.footprint!])).toBeCloseTo(24, 6);
    expect(polygonArea([r.boundary])).toBeCloseTo(35, 6);
    // Todas as arestas definem inclinação por padrão: o motor lê isso como forma por arestas.
    expect(r.shape).toBe('edges');
    expect(r.edgeSlopes).toEqual([30, 30, 30, 30]);
    expect(r.slopePercent).toBe(30);
    expect(r.heightOffset).toBe(2.8);
  });

  it('a cumeeira sai ao longo do lado maior do contorno', () => {
    const ctx = makeEnv();
    criar(ctx.store, sidesOf(retangulo(6, 4)));
    expect(roofs(ctx.store.project)[0]!.dir).toEqual({ x: 1, y: 0 });
  });

  it('o eixo ortogonal (opção axis) põe a cumeeira no outro sentido', () => {
    const ctx = makeEnv();
    const axis = roofDirFor('gable', { x: 1, y: 0 }, true);
    criar(ctx.store, sidesOf(retangulo(6, 4)), { axis });
    expect(roofs(ctx.store.project)[0]!.dir).toEqual(axis);
  });

  it('cota do beiral, tipo e inclinação vêm das opções', () => {
    const ctx = makeEnv();
    expect(criar(ctx.store, sidesOf(retangulo(6, 4)), { heightOffset: 3.2, typeId: 'rt_fibro', slopePct: 15 }).ok).toBe(true);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.heightOffset).toBe(3.2);
    expect(r.typeId).toBe('rt_fibro');
    expect(r.slopePercent).toBe(15);
    expect(r.edgeSlopes).toEqual([15, 15, 15, 15]);
  });

  it('inclinação inválida nas opções não cria telhado', () => {
    const ctx = makeEnv();
    const r = criar(ctx.store, sidesOf(retangulo(6, 4)), { slopePct: 0 });
    expect(r.ok).toBe(false);
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(r.message).toMatch(/maior que zero/);
  });

  it('contorno de área zero não cria telhado', () => {
    const ctx = makeEnv();
    const colinear: NewSeg[] = [
      { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
      { a: { x: 1, y: 0 }, b: { x: 2, y: 0 } },
      { a: { x: 2, y: 0 }, b: { x: 0, y: 0 } },
    ];
    expect(criar(ctx.store, colinear).ok).toBe(false);
    expect(roofs(ctx.store.project)).toHaveLength(0);
  });
});

describe('ferramenta Telhado: beiral a partir das paredes externas (A2)', () => {
  /** Quatro paredes de um retângulo 4 × 3 (x 0..4, y 0..3). */
  function casa(ctx: ReturnType<typeof makeEnv>): void {
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    drawWall(ctx.env, [4, 3], [0, 3]);
    drawWall(ctx.env, [0, 3], [0, 0]);
  }

  it('a pegada é o perímetro externo e o beiral sai dele pelo balanço, com cantos em esquadria', () => {
    const ctx = makeEnv();
    casa(ctx);
    const outer = outerPerimeter(ctx.store.project, 'lv_0', { x: 2, y: 0 })!;
    expect(criar(ctx.store, sidesOf(outer), { overhang: 0.5 }).ok).toBe(true);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.footprint).toBeDefined();
    expect(polygonArea([r.footprint!])).toBeCloseTo(polygonArea([outer]), 6);
    // Retângulo com cantos em esquadria: área = A + P·d + 4·d² (d = balanço).
    expect(Math.abs(ringArea(r.boundary))).toBeCloseTo(Math.abs(ringArea(outer)) + 0.5 * ringPerimeter(outer) + 4 * 0.25, 2);
  });

  it('balanço zero deixa o beiral igual ao perímetro externo', () => {
    const ctx = makeEnv();
    casa(ctx);
    const outer = outerPerimeter(ctx.store.project, 'lv_0', { x: 2, y: 0 })!;
    criar(ctx.store, sidesOf(outer), { overhang: 0 });
    expect(Math.abs(ringArea(roofs(ctx.store.project)[0]!.boundary))).toBeCloseTo(Math.abs(ringArea(outer)), 6);
  });
});

describe('ferramenta Telhado: duas águas sem arestas paralelas (defeito 3)', () => {
  it('triângulo com só uma aresta definindo inclinação sai com uma água', () => {
    const ctx = makeEnv();
    const r = criar(ctx.store, sidesOf([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 4 }]), {}, [1, 2]);
    expect(r.ok).toBe(true);
    expect(roofs(ctx.store.project)[0]!.edgeSlopes.filter((s) => s !== null)).toHaveLength(1);
    expect(r.message).toMatch(/1 água/);
  });

  it('retângulo com as arestas curtas sem inclinação sai com duas águas', () => {
    const ctx = makeEnv();
    const r = criar(ctx.store, sidesOf(retangulo(6, 4)), {}, [1, 3]);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/2 águas/);
  });
});

describe('ferramenta Telhado: o beiral sai para fora da pegada (balanço)', () => {
  it('contorno 4 × 3 com balanço 0,5 m: a pegada é o desenho e o beiral tem área pegada + 0,5 × perímetro + 1', () => {
    const ctx = makeEnv();
    criar(ctx.store, sidesOf([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }]), { overhang: 0.5 });
    const r = roofs(ctx.store.project)[0]!;
    expect(polygonArea([r.footprint!])).toBeCloseTo(12, 6);
    expect(polygonArea([r.boundary])).toBeCloseTo(12 + 0.5 * 14 + 1, 6);
    expect(r.edgeOverhangs).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('retângulo com balanço 0,5 m: o beiral sai pelos quatro lados (6 × 4 vira 7 × 5)', () => {
    const ctx = makeEnv();
    criar(ctx.store, sidesOf(retangulo(6, 4)), { overhang: 0.5 });
    const r = roofs(ctx.store.project)[0]!;
    expect(polygonArea([r.footprint!])).toBeCloseTo(24, 6);
    expect(polygonArea([r.boundary])).toBeCloseTo(35, 6);
    expect(Math.min(...r.boundary.map((q) => q.x))).toBeCloseTo(-0.5, 6);
    expect(Math.max(...r.boundary.map((q) => q.y))).toBeCloseTo(4.5, 6);
  });

  it('balanço zero: o beiral é a própria pegada', () => {
    const ctx = makeEnv();
    criar(ctx.store, sidesOf(retangulo(6, 4)), { overhang: 0 });
    const r = roofs(ctx.store.project)[0]!;
    expect(r.boundary).toHaveLength(4);
    r.boundary.forEach((q, i) => {
      expect(q.x).toBeCloseTo(r.footprint![i]!.x, 9);
      expect(q.y).toBeCloseTo(r.footprint![i]!.y, 9);
    });
  });
});
