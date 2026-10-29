import { describe, expect, it } from 'vitest';
import { pickFloorAt, floorIdsInBox, floorGripAt, ringRemoveVertex, ringInsertAfter } from './floorPick.ts';
import { makeEnv } from './testEnv.ts';

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
