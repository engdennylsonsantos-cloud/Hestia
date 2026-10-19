import { describe, expect, it } from 'vitest';
import type { Opening } from '@hestia/model';
import { openingsOfWall } from '@hestia/model';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

/** Parede A (0,0)-(4,0) com uma porta em x=1; parede B (0,2)-(6,2) livre. */
function setup() {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  drawWall(ctx.env, [0, 2], [6, 2]);
  ctx.store.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: walls(ctx.store)[0]!.id, offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  return { ...ctx, A: walls(ctx.store)[0]!.id, B: walls(ctx.store)[1]!.id };
}

describe('trocar a parede anfitriã (D7 na ferramenta)', () => {
  it('1º clique escolhe a abertura, 2º clique na parede move para o ponto mais próximo', () => {
    const { store, env, A, B } = setup();
    const t = tool('rehost', env);
    clickAt(t, 1, 0);
    clickAt(t, 3, 2);
    const d = store.project.elements.d as Opening;
    expect(d.hostId).toBe(B);
    expect(d.offset).toBeCloseTo(3);
    expect(openingsOfWall(store.project, A)).toHaveLength(0);
  });

  it('usa a abertura já selecionada no início da ferramenta', () => {
    const { store, env, B } = setup();
    env.setSelection(['d']);
    const t = tool('rehost', env);
    clickAt(t, 0.05, 2);
    const d = store.project.elements.d as Opening;
    expect(d.hostId).toBe(B);
    // encostado no início: o centro fica a meia largura do início
    expect(d.offset).toBeCloseTo(store.project.openingTypes.ot_p80!.width / 2);
  });

  it('a posição é limitada para o vão ficar inteiro na parede', () => {
    const { store, env, B } = setup();
    env.setSelection(['d']);
    const t = tool('rehost', env);
    clickAt(t, 5.99, 2);
    const d = store.project.elements.d as Opening;
    const half = store.project.openingTypes.ot_p80!.width / 2;
    expect(d.hostId).toBe(B);
    expect(d.offset).toBeCloseTo(6 - half);
  });

  it('sobreposição com outra abertura da nova parede: nada muda', () => {
    const { store, env, A, B } = setup();
    store.exec({ type: 'addOpening', opening: { id: 'e', kind: 'window', typeId: 'ot_j120', hostId: B, offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    env.setSelection(['d']);
    const t = tool('rehost', env);
    clickAt(t, 3, 2);
    expect((store.project.elements.d as Opening).hostId).toBe(A);
    expect(store.project.elements.d).toBeDefined();
    expect(openingsOfWall(store.project, B)).toHaveLength(1);
  });

  it('clicar em espaço vazio no 1º passo não escolhe abertura', () => {
    const { store, env, A } = setup();
    const t = tool('rehost', env);
    clickAt(t, 20, 20);
    clickAt(t, 3, 0);
    expect((store.project.elements.d as Opening).hostId).toBe(A);
  });

  it('clicar fora de parede no 2º passo mantém a abertura onde está', () => {
    const { store, env, A } = setup();
    const t = tool('rehost', env);
    clickAt(t, 1, 0);
    clickAt(t, 20, 20);
    expect((store.project.elements.d as Opening).hostId).toBe(A);
  });

  it('é um único passo de desfazer', () => {
    const { store, env, A, B } = setup();
    const t = tool('rehost', env);
    clickAt(t, 1, 0);
    clickAt(t, 3, 2);
    expect((store.project.elements.d as Opening).hostId).toBe(B);
    store.undo();
    expect((store.project.elements.d as Opening).hostId).toBe(A);
    expect((store.project.elements.d as Opening).offset).toBeCloseTo(1);
  });

  it('a ferramenta continua ativa depois da troca (Esc sai)', () => {
    const { store, env, done, B } = setup();
    const t = tool('rehost', env);
    clickAt(t, 1, 0);
    clickAt(t, 3, 2);
    expect((store.project.elements.d as Opening).hostId).toBe(B);
    expect(done()).toBe(0);
    t.cancel();
    expect(done()).toBe(1);
  });
});
