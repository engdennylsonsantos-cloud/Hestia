import { describe, expect, it } from 'vitest';
import { multiArea, polygonArea } from '@hestia/geom';
import { slabsOnLevel, totalThickness, type Project, type Slab } from '@hestia/model';
import type { SlabMode } from './types.ts';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';

const slabs = (store: { project: Project }): Slab[] => slabsOnLevel(store.project, 'lv_0');

function slabCtx(mode: SlabMode) {
  const ctx = makeEnv();
  ctx.options.slabMode = mode;
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  return { ...ctx, msgs };
}

/** Paredes de um retângulo 4 × 3 desenhadas pela ferramenta Parede (forma retangular). Devolve a espessura. */
function room(ctx: ReturnType<typeof makeEnv>, a: [number, number] = [0, 0], b: [number, number] = [4, 3]): number {
  ctx.options.wallShape = 'rect';
  const w = tool('wall', ctx.env);
  clickAt(w, a[0], a[1]);
  clickAt(w, b[0], b[1]);
  ctx.options.wallShape = 'line';
  return totalThickness(ctx.store.project.wallTypes[ctx.options.wallTypeId]!);
}

describe('ferramenta Laje: contorno por cliques (A1)', () => {
  it('quatro cliques e o primeiro ponto fecham o contorno; a laje fica selecionada no nível ativo', () => {
    const ctx = slabCtx('poly');
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 4, 3);
    clickAt(t, 0, 3);
    clickAt(t, 0, 0);
    const ss = slabs(ctx.store);
    expect(ss).toHaveLength(1);
    expect(ss[0]!.id.startsWith('l')).toBe(true);
    expect(ss[0]!.boundary).toHaveLength(4);
    expect(ss[0]!.typeId).toBe('ls_mac12');
    expect(ss[0]!.levelId).toBe('lv_0');
    expect(polygonArea([ss[0]!.boundary])).toBeCloseTo(12, 6);
    expect(ctx.sel()).toEqual([ss[0]!.id]);
  });

  it('duplo clique (segundo clique no mesmo ponto) fecha o contorno', () => {
    const ctx = slabCtx('poly');
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 4, 3);
    clickAt(t, 0, 3);
    clickAt(t, 0, 3);
    expect(slabs(ctx.store)[0]!.boundary).toHaveLength(4);
  });

  it('Enter fecha com três pontos ou mais', () => {
    const ctx = slabCtx('poly');
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 0);
    clickAt(t, 0, 3);
    t.confirm();
    expect(slabs(ctx.store)[0]!.boundary).toHaveLength(3);
  });

  it('digitar o comprimento do segmento segue a direção do cursor', () => {
    const ctx = slabCtx('poly');
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    t.move(P(1, 0));
    expect(t.inputPrompt()).toBe('Comprimento');
    expect(t.type('3')).toBe(true);
    clickAt(t, 3, 3);
    clickAt(t, 0, 3);
    t.confirm();
    const s = slabs(ctx.store)[0]!;
    expect(s.boundary[1]!.x).toBeCloseTo(3);
    expect(s.boundary[1]!.y).toBeCloseTo(0);
    expect(polygonArea([s.boundary])).toBeCloseTo(9, 6);
  });

  it('contorno de área zero não cria laje e avisa', () => {
    const ctx = slabCtx('poly');
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 1, 0);
    clickAt(t, 2, 0);
    t.confirm();
    expect(slabs(ctx.store)).toHaveLength(0);
    expect(ctx.msgs.some((m) => m.includes('área zero'))).toBe(true);
  });

  it('o deslocamento do topo e o tipo das opções vão para a laje criada', () => {
    const ctx = slabCtx('poly');
    ctx.options.slabOffset = 0.2;
    ctx.options.slabTypeId = 'ls_mac15';
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    clickAt(t, 2, 2);
    t.confirm();
    const s = slabs(ctx.store)[0]!;
    expect(s.heightOffset).toBeCloseTo(0.2);
    expect(s.typeId).toBe('ls_mac15');
  });

  it('tipo de laje inexistente nas opções cai no primeiro tipo do projeto', () => {
    const ctx = slabCtx('poly');
    ctx.options.slabTypeId = 'nao_existe';
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    clickAt(t, 2, 2);
    t.confirm();
    expect(slabs(ctx.store)[0]!.typeId).toBe(Object.keys(ctx.store.project.slabTypes)[0]);
  });

  it('Esc em dois passos: o primeiro cancela o contorno, o segundo sai da ferramenta', () => {
    const ctx = slabCtx('poly');
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    t.cancel();
    expect(ctx.done()).toBe(0);
    expect(slabs(ctx.store)).toHaveLength(0);
    t.cancel();
    expect(ctx.done()).toBe(1);
  });
});

describe('ferramenta Laje: retângulo e perímetro externo (A2)', () => {
  it('retângulo por dois cantos cria quatro vértices', () => {
    const ctx = slabCtx('rect');
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    const ss = slabs(ctx.store);
    expect(ss).toHaveLength(1);
    expect(ss[0]!.boundary).toHaveLength(4);
    expect(polygonArea([ss[0]!.boundary])).toBeCloseTo(12, 6);
  });

  it('retângulo estreito demais não cria laje', () => {
    const ctx = slabCtx('rect');
    const t = tool('slab', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    expect(slabs(ctx.store)).toHaveLength(0);
  });

  it('perímetro: clicar numa parede cria o contorno pela face externa, sem furos', () => {
    const ctx = slabCtx('perimetro');
    const t = room(ctx);
    const lt = tool('slab', ctx.env);
    clickAt(lt, 2, 0);
    const ss = slabs(ctx.store);
    expect(ss).toHaveLength(1);
    expect(ss[0]!.holes).toHaveLength(0);
    // A face externa fica meia espessura fora de cada eixo: (4 + t) × (3 + t).
    expect(multiArea([[ss[0]!.boundary]])).toBeCloseTo((4 + t) * (3 + t), 2);
  });

  it('perímetro: um vão interno (parede solta dentro) não entra no contorno externo', () => {
    const ctx = slabCtx('perimetro');
    const t = room(ctx);
    const w = tool('wall', ctx.env);
    clickAt(w, 1, 1.5);
    clickAt(w, 3, 1.5);
    w.cancel();
    const lt = tool('slab', ctx.env);
    clickAt(lt, 2, 0);
    const s = slabs(ctx.store)[0]!;
    expect(s.holes).toHaveLength(0);
    expect(multiArea([[s.boundary]])).toBeCloseTo((4 + t) * (3 + t), 2);
  });

  it('perímetro: clique longe das paredes avisa e não cria laje', () => {
    const ctx = slabCtx('perimetro');
    room(ctx);
    const lt = tool('slab', ctx.env);
    clickAt(lt, 2, 1.5);
    expect(slabs(ctx.store)).toHaveLength(0);
    expect(ctx.msgs).toContain('Clique perto de uma parede do nível.');
  });
});
