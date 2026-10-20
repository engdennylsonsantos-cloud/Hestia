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
    expect(polygonArea([r.boundary])).toBeCloseTo(24, 6);
    expect(r.shape).toBe('gable');
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
    expect(r.boundary[1]!.x).toBeCloseTo(3);
    expect(r.boundary[1]!.y).toBeCloseTo(0);
    expect(polygonArea([r.boundary])).toBeCloseTo(9, 6);
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
    expect(r.shape).toBe('shed');
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
