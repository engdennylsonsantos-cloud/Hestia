import { describe, expect, it } from 'vitest';
import { multiArea, polygonArea } from '@hestia/geom';
import { floorsOnLevel, totalThickness, type Floor } from '@hestia/model';
import { FloorTool } from './floorTool.ts';
import { pickFloorAt, floorIdsInBox, floorGripAt, ringRemoveVertex, ringInsertAfter } from './floorPick.ts';
import { clickAt, makeEnv, tool, P } from './testEnv.ts';

const floors = (store: { project: import('@hestia/model').Project }): Floor[] => floorsOnLevel(store.project, 'lv_0');

function floorCtx(mode: 'poly' | 'rect' | 'walls') {
  const ctx = makeEnv();
  ctx.options.floorMode = mode;
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  return { ...ctx, msgs };
}

/** Paredes de um retângulo 4 × 3 desenhadas pela ferramenta Parede (forma retangular). */
function room(ctx: ReturnType<typeof makeEnv>) {
  ctx.options.wallShape = 'rect';
  const w = tool('wall', ctx.env);
  clickAt(w, 0, 0);
  clickAt(w, 4, 3);
  ctx.options.wallShape = 'line';
  return totalThickness(ctx.store.project.wallTypes[ctx.options.wallTypeId]!);
}

describe('ferramenta Piso: contorno por cliques (A1)', () => {
  it('quatro cliques e o primeiro ponto fecham o contorno; o piso fica selecionado no nível ativo', () => {
    const ctx = floorCtx('poly');
    const t = tool('floor', ctx.env) as FloorTool;
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 4, 3);
    clickAt(t, 0, 3);
    clickAt(t, 0, 0);
    const fs = floors(ctx.store);
    expect(fs).toHaveLength(1);
    expect(fs[0]!.boundary).toHaveLength(4);
    expect(fs[0]!.typeId).toBe('ft_ceram');
    expect(fs[0]!.levelId).toBe('lv_0');
    expect(polygonArea([fs[0]!.boundary])).toBeCloseTo(12, 6);
    expect(ctx.sel()).toEqual([fs[0]!.id]);
  });

  it('duplo clique (segundo clique no mesmo ponto) fecha o contorno', () => {
    const ctx = floorCtx('poly');
    const t = tool('floor', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 4, 3);
    clickAt(t, 0, 3);
    clickAt(t, 0, 3);
    expect(floors(ctx.store)[0]!.boundary).toHaveLength(4);
  });

  it('Enter fecha com três pontos ou mais', () => {
    const ctx = floorCtx('poly');
    const t = tool('floor', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 0);
    clickAt(t, 0, 3);
    t.confirm();
    expect(floors(ctx.store)[0]!.boundary).toHaveLength(3);
  });

  it('digitar o comprimento do segmento segue a direção do cursor', () => {
    const ctx = floorCtx('poly');
    const t = tool('floor', ctx.env);
    clickAt(t, 0, 0);
    t.move(P(1, 0));
    expect(t.inputPrompt()).toBe('Comprimento');
    expect(t.type('3')).toBe(true);
    clickAt(t, 3, 3);
    clickAt(t, 0, 3);
    t.confirm();
    const f = floors(ctx.store)[0]!;
    expect(f.boundary[1]!.x).toBeCloseTo(3);
    expect(f.boundary[1]!.y).toBeCloseTo(0);
    expect(polygonArea([f.boundary])).toBeCloseTo(9, 6);
  });

  it('digitar sem contorno em andamento não faz nada', () => {
    const ctx = floorCtx('poly');
    const t = tool('floor', ctx.env);
    expect(t.inputPrompt()).toBeNull();
    expect(t.type('3')).toBe(false);
  });

  it('contorno de área zero não cria piso e avisa', () => {
    const ctx = floorCtx('poly');
    const t = tool('floor', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 1, 0);
    clickAt(t, 2, 0);
    t.confirm();
    expect(floors(ctx.store)).toHaveLength(0);
    expect(ctx.msgs.some((m) => m.includes('área zero'))).toBe(true);
  });

  it('a altura de deslocamento da opção vai para o piso criado', () => {
    const ctx = floorCtx('poly');
    ctx.options.floorOffset = 0.15;
    const t = tool('floor', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    clickAt(t, 2, 2);
    t.confirm();
    expect(floors(ctx.store)[0]!.heightOffset).toBeCloseTo(0.15);
  });

  it('Esc em dois passos: o primeiro cancela o contorno, o segundo sai da ferramenta', () => {
    const ctx = floorCtx('poly');
    const t = tool('floor', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    t.cancel();
    expect(ctx.done()).toBe(0);
    expect(floors(ctx.store)).toHaveLength(0);
    t.cancel();
    expect(ctx.done()).toBe(1);
  });
});

describe('ferramenta Piso: retângulo e paredes (A2, A4)', () => {
  it('retângulo por dois cantos cria quatro vértices e a altura digitada na opção', () => {
    const ctx = floorCtx('rect');
    const t = tool('floor', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 3);
    const fs = floors(ctx.store);
    expect(fs).toHaveLength(1);
    expect(fs[0]!.boundary).toHaveLength(4);
    expect(polygonArea([fs[0]!.boundary])).toBeCloseTo(12, 6);
  });

  it('retângulo estreito demais não cria piso', () => {
    const ctx = floorCtx('rect');
    const t = tool('floor', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    expect(floors(ctx.store)).toHaveLength(0);
  });

  it('paredes: clique numa sala fechada usa a face interna das paredes', () => {
    const ctx = floorCtx('walls');
    const t = room(ctx);
    const tw = tool('floor', ctx.env);
    clickAt(tw, 2, 1.5);
    const fs = floors(ctx.store);
    expect(fs).toHaveLength(1);
    expect(multiArea([[fs[0]!.boundary, ...fs[0]!.holes]])).toBeCloseTo((4 - t) * (3 - t), 6);
    expect(fs[0]!.holes).toHaveLength(0);
    expect(t).toBeGreaterThan(0);
  });

  it('paredes: clique fora de qualquer sala avisa na barra de status', () => {
    const ctx = floorCtx('walls');
    room(ctx);
    const tw = tool('floor', ctx.env);
    clickAt(tw, -2, 1.5);
    expect(floors(ctx.store)).toHaveLength(0);
    expect(ctx.msgs).toContain('Não há área fechada por paredes neste ponto');
  });

  it('paredes: a sala com uma parede solta vira piso com furo', () => {
    const ctx = floorCtx('walls');
    const t = room(ctx);
    const w = tool('wall', ctx.env);
    clickAt(w, 1, 1.5);
    clickAt(w, 3, 1.5);
    w.cancel();
    const tw = tool('floor', ctx.env);
    clickAt(tw, 0.5, 0.5);
    const f = floors(ctx.store)[0]!;
    expect(f.holes).toHaveLength(1);
    expect(multiArea([[f.boundary, ...f.holes]])).toBeCloseTo((4 - t) * (3 - t) - 2 * t, 3);
  });
});

describe('pick, janela e alças de piso (F1, A5)', () => {
  const square = { id: 'f1', kind: 'floor' as const, typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], holes: [[{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1.5, y: 2 }]], heightOffset: 0, mark: '', comments: '', order: 0 };

  it('clique dentro do piso o pega; dentro do furo não; na borda sim', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addFloor', floor: square });
    expect(pickFloorAt(ctx.store.project, 'lv_0', { x: 3, y: 2 }, 0.01)).toBe('f1');
    expect(pickFloorAt(ctx.store.project, 'lv_0', { x: 1.5, y: 1.3 }, 0.01)).toBeNull();
    expect(pickFloorAt(ctx.store.project, 'lv_0', { x: 4, y: 1 }, 0.01)).toBe('f1');
    expect(pickFloorAt(ctx.store.project, 'lv_0', { x: 6, y: 1 }, 0.01)).toBeNull();
  });

  it('janela: esq→dir só pega o piso inteiro; dir→esq pega o que cruza', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addFloor', floor: square });
    expect(floorIdsInBox(ctx.store.project, 'lv_0', { x: -1, y: -1 }, { x: 5, y: 4 })).toEqual(['f1']);
    expect(floorIdsInBox(ctx.store.project, 'lv_0', { x: 2, y: -1 }, { x: 6, y: 4 })).toEqual([]);
    expect(floorIdsInBox(ctx.store.project, 'lv_0', { x: 6, y: 1 }, { x: 2, y: 2 })).toEqual(['f1']);
  });

  it('alça: vértice tem prioridade; meio da aresta é alça de aresta', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addFloor', floor: square });
    expect(floorGripAt(ctx.store.project, ['f1'], { x: 4, y: 0 }, 0.01)).toMatchObject({ kind: 'vertex', index: 1 });
    expect(floorGripAt(ctx.store.project, ['f1'], { x: 2, y: 0 }, 0.01)).toMatchObject({ kind: 'edge', index: 0 });
    expect(floorGripAt(ctx.store.project, [], { x: 4, y: 0 }, 0.01)).toBeNull();
  });

  it('remover vértice mantém no mínimo três; inserir após o índice divide a aresta', () => {
    const tri = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    expect(ringRemoveVertex(tri, 0)).toBeNull();
    expect(ringRemoveVertex([...tri, { x: 2, y: 2 }], 3)).toHaveLength(3);
    const ins = ringInsertAfter(tri, 0, { x: 0.5, y: -1 });
    expect(ins).toHaveLength(4);
    expect(ins[1]).toEqual({ x: 0.5, y: -1 });
  });
});
