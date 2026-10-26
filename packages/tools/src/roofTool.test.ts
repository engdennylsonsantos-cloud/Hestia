import { describe, expect, it } from 'vitest';
import { polygonArea, ringArea } from '@hestia/geom';
import { roofsOnLevel, type Project, type Roof } from '@hestia/model';
import { roofDirFor } from './roofGeom.ts';
import { ringPerimeter } from './floorPick.ts';
import { outerPerimeter } from './enclosed.ts';
import { clickAt, drawWall, makeEnv, P, tool } from './testEnv.ts';
import type { RoofMode } from './types.ts';

const roofs = (p: Project): Roof[] => roofsOnLevel(p, 'lv_0');

function roofCtx(mode: RoofMode) {
  const ctx = makeEnv();
  ctx.options.roofMode = mode;
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  return { ...ctx, msgs };
}

describe('ferramenta Telhado: contorno por cliques (A1)', () => {
  it('quatro cliques e o primeiro ponto criam o telhado com forma, inclinação e cota padrão, selecionado', () => {
    const ctx = roofCtx('poly');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 0);
    clickAt(t, 6, 4);
    clickAt(t, 0, 4);
    clickAt(t, 0, 0);
    const rs = roofs(ctx.store.project);
    expect(rs).toHaveLength(1);
    const r = rs[0]!;
    expect(r.id.startsWith('t')).toBe(true);
    expect(r.kind).toBe('roof');
    expect(r.typeId).toBe('rt_ceramica');
    expect(r.levelId).toBe('lv_0');
    expect(r.boundary).toHaveLength(4);
    // A pegada é o retângulo clicado; o beiral sai dele pelo balanço padrão de 0,5 m (cantos em esquadria: 7 × 5).
    expect(polygonArea([r.footprint!])).toBeCloseTo(24, 6);
    expect(polygonArea([r.boundary])).toBeCloseTo(35, 6);
    // A forma da barra (duas águas, padrão) vira predefinições por aresta: lados longos definem, curtos são empenas.
    expect(r.shape).toBe('edges');
    expect(r.edgeSlopes).toEqual([30, null, 30, null]);
    expect(r.slopePercent).toBe(30);
    expect(r.heightOffset).toBe(2.8);
    expect(ctx.sel()).toEqual([r.id]);
    expect(ctx.msgs.at(-1)).toMatch(/Telhado criado.*Ctrl\+Z desfaz/);
  });

  it('a cumeeira sai ao longo do lado maior do contorno', () => {
    const ctx = roofCtx('rect');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 4);
    expect(roofs(ctx.store.project)[0]!.dir).toEqual({ x: 1, y: 0 });
  });

  it('Tab inverte o eixo da cumeeira antes de criar', () => {
    const ctx = roofCtx('rect');
    const t = tool('roof', ctx.env);
    t.tab();
    clickAt(t, 0, 0);
    clickAt(t, 6, 4);
    expect(roofs(ctx.store.project)[0]!.dir).toEqual(roofDirFor('gable', { x: 1, y: 0 }, true));
  });

  it('digitar o comprimento do segmento segue a direção do cursor', () => {
    const ctx = roofCtx('poly');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    t.move(P(1, 0));
    expect(t.inputPrompt()).toBe('Comprimento');
    expect(t.type('3')).toBe(true);
    clickAt(t, 3, 3);
    clickAt(t, 0, 3);
    t.confirm();
    const r = roofs(ctx.store.project)[0]!;
    expect(r.footprint![1]!.x).toBeCloseTo(3);
    expect(r.footprint![1]!.y).toBeCloseTo(0);
    expect(polygonArea([r.footprint!])).toBeCloseTo(9, 6);
  });

  it('contorno de área zero não cria telhado e avisa', () => {
    const ctx = roofCtx('poly');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 1, 0);
    clickAt(t, 2, 0);
    t.confirm();
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(ctx.msgs.at(-1)).toMatch(/área zero/);
  });

  it('Enter fecha com três pontos ou mais', () => {
    const ctx = roofCtx('poly');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 0);
    clickAt(t, 0, 3);
    t.confirm();
    expect(roofs(ctx.store.project)[0]!.boundary).toHaveLength(3);
  });

  it('Enter com dois pontos não cria telhado, avisa do mínimo e mantém os pontos para continuar', () => {
    const ctx = roofCtx('poly');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 0);
    t.confirm();
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(ctx.msgs.at(-1)).toMatch(/Contorno precisa de ao menos 3 pontos/);
    clickAt(t, 0, 3);
    t.confirm();
    expect(roofs(ctx.store.project)[0]!.boundary).toHaveLength(3);
  });

  it('Esc no meio do contorno descarta os pontos, avisa e deixa claro que outro Esc sai da ferramenta', () => {
    const ctx = roofCtx('poly');
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 0);
    t.cancel();
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(ctx.msgs.at(-1)).toMatch(/Contorno cancelado.*Esc de novo sai da ferramenta/);
  });

  it('inclinação inválida nas opções não cria telhado', () => {
    const ctx = roofCtx('rect');
    ctx.options.roofSlope = 0;
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 4);
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(ctx.msgs.at(-1)).toMatch(/maior que zero/);
  });

  it('cota do beiral digitada nas opções vale; forma e tipo vêm da barra', () => {
    const ctx = roofCtx('rect');
    ctx.options.roofOffset = 3.2;
    ctx.options.roofShape = 'shed';
    ctx.options.roofSlope = 15;
    ctx.options.roofTypeId = 'rt_fibro';
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 4);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.heightOffset).toBe(3.2);
    expect(r.shape).toBe('edges');
    // Uma água sobe no eixo curto (y): só a aresta mais baixa (y = 0) define inclinação.
    expect(r.edgeSlopes).toEqual([15, null, null, null]);
    expect(r.slopePercent).toBe(15);
    expect(r.typeId).toBe('rt_fibro');
  });
});

describe('ferramenta Telhado: pelas paredes com balanço (A2)', () => {
  it('o beiral sai do perímetro externo pelo balanço, com cantos em esquadria', () => {
    const ctx = roofCtx('paredes');
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    drawWall(ctx.env, [4, 3], [0, 3]);
    drawWall(ctx.env, [0, 3], [0, 0]);
    const outer = outerPerimeter(ctx.store.project, 'lv_0', { x: 2, y: 0 })!;
    ctx.options.roofOverhang = 0.5;
    clickAt(tool('roof', ctx.env), 2, 0);
    const r = roofs(ctx.store.project)[0]!;
    // Retângulo com cantos em esquadria: área = A + P·d + 4·d² (d = balanço).
    const area = Math.abs(ringArea(outer));
    expect(Math.abs(ringArea(r.boundary))).toBeCloseTo(area + 0.5 * ringPerimeter(outer) + 4 * 0.25, 2);
  });

  it('balanço zero deixa o beiral igual ao perímetro externo', () => {
    const ctx = roofCtx('paredes');
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    drawWall(ctx.env, [4, 3], [0, 3]);
    drawWall(ctx.env, [0, 3], [0, 0]);
    const outer = outerPerimeter(ctx.store.project, 'lv_0', { x: 2, y: 0 })!;
    ctx.options.roofOverhang = 0;
    clickAt(tool('roof', ctx.env), 2, 0);
    expect(Math.abs(ringArea(roofs(ctx.store.project)[0]!.boundary))).toBeCloseTo(Math.abs(ringArea(outer)), 6);
  });

  it('clique longe das paredes não cria telhado e pede uma parede', () => {
    const ctx = roofCtx('paredes');
    drawWall(ctx.env, [0, 0], [4, 0]);
    const t = tool('roof', ctx.env);
    clickAt(t, 20, 20);
    expect(roofs(ctx.store.project)).toHaveLength(0);
    expect(ctx.msgs.at(-1)).toMatch(/parede do nível/);
  });
});

describe('ferramenta Telhado: duas águas sem arestas paralelas (defeito 3)', () => {
  it('triângulo em duas águas avisa que só uma aresta define a cumeeira e diz como resolver', () => {
    const ctx = roofCtx('poly');
    ctx.options.roofShape = 'gable';
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 0);
    clickAt(t, 3, 4);
    clickAt(t, 0, 0);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.edgeSlopes.filter((s) => s !== null)).toHaveLength(1);
    expect(ctx.msgs.at(-1)).toMatch(/só 1 aresta paralela à cumeeira/);
    expect(ctx.msgs.at(-1)).toMatch(/Quatro águas/);
  });

  it('retângulo em duas águas não avisa', () => {
    const ctx = roofCtx('rect');
    ctx.options.roofShape = 'gable';
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 4);
    expect(ctx.msgs.at(-1)).toMatch(/Telhado criado: 2 águas/);
  });
});

describe('ferramenta Telhado: o beiral sai para fora da pegada (balanço)', () => {
  it('contorno clicado com balanço 0,5 m: a pegada é o desenho e o beiral tem área pegada + 0,5 × perímetro + 1', () => {
    const ctx = roofCtx('poly');
    ctx.options.roofOverhang = 0.5;
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 4, 3);
    clickAt(t, 0, 3);
    clickAt(t, 0, 0);
    const r = roofs(ctx.store.project)[0]!;
    expect(polygonArea([r.footprint!])).toBeCloseTo(12, 6);
    expect(polygonArea([r.boundary])).toBeCloseTo(12 + 0.5 * 14 + 1, 6);
    expect(r.edgeOverhangs).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('retângulo com balanço 0,5 m: o beiral sai pelos quatro lados (6 × 4 vira 7 × 5)', () => {
    const ctx = roofCtx('rect');
    ctx.options.roofOverhang = 0.5;
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 4);
    const r = roofs(ctx.store.project)[0]!;
    expect(polygonArea([r.footprint!])).toBeCloseTo(24, 6);
    expect(polygonArea([r.boundary])).toBeCloseTo(35, 6);
    expect(Math.min(...r.boundary.map((q) => q.x))).toBeCloseTo(-0.5, 6);
    expect(Math.max(...r.boundary.map((q) => q.y))).toBeCloseTo(4.5, 6);
  });

  it('balanço zero: o beiral é a própria pegada', () => {
    const ctx = roofCtx('poly');
    ctx.options.roofOverhang = 0;
    const t = tool('roof', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 6, 0);
    clickAt(t, 6, 4);
    clickAt(t, 0, 4);
    clickAt(t, 0, 0);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.boundary).toHaveLength(4);
    r.boundary.forEach((q, i) => {
      expect(q.x).toBeCloseTo(r.footprint![i]!.x, 9);
      expect(q.y).toBeCloseTo(r.footprint![i]!.y, 9);
    });
  });

  it('pelas paredes: a pegada é o perímetro externo e o beiral sai dele pelo balanço', () => {
    const ctx = roofCtx('paredes');
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    drawWall(ctx.env, [4, 3], [0, 3]);
    drawWall(ctx.env, [0, 3], [0, 0]);
    const outer = outerPerimeter(ctx.store.project, 'lv_0', { x: 2, y: 0 })!;
    ctx.options.roofOverhang = 0.5;
    clickAt(tool('roof', ctx.env), 2, 0);
    const r = roofs(ctx.store.project)[0]!;
    expect(r.footprint).toBeDefined();
    expect(polygonArea([r.footprint!])).toBeCloseTo(polygonArea([outer]), 6);
    expect(polygonArea([r.boundary])).toBeCloseTo(polygonArea([outer]) + 0.5 * ringPerimeter(outer) + 1, 2);
  });
});
