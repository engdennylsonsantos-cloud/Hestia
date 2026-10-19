import { describe, expect, it } from 'vitest';
import type { Wall } from '@hestia/model';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

/** Parede A (0,0)-(4,0) e parede de eixo horizontal em y=2, de x=-1 a x=5. */
function house(mirrorCopy: boolean) {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  drawWall(ctx.env, [-1, 2], [5, 2]);
  ctx.options.mirrorCopy = mirrorCopy;
  ctx.env.setSelection([walls(ctx.store)[0]!.id]);
  return ctx;
}

describe('espelhar pegando uma parede como eixo (F8)', () => {
  it('Tab + clique na parede espelha imediatamente pelo eixo a→b dela', () => {
    const { store, env, done } = house(false);
    const m = tool('mirror', env);
    m.tab();
    clickAt(m, 1, 2);
    const a = walls(store)[0] as Wall;
    expect(a.a.y).toBeCloseTo(4);
    expect(a.b.y).toBeCloseTo(4);
    expect(done()).toBe(1); // encerrou a ferramenta
  });

  it('com a opção Copiar vigente, mantém o original e cria o espelho', () => {
    const { store, env } = house(true);
    const m = tool('mirror', env);
    m.tab();
    clickAt(m, 1, 2);
    expect(walls(store)).toHaveLength(3);
    const copy = walls(store)[2] as Wall;
    expect(copy.a.y).toBeCloseTo(4);
    expect(copy.flipped).toBe(true);
    expect((walls(store)[0] as Wall).a.y).toBeCloseTo(0);
  });

  it('um único passo de desfazer para o espelho com cópia', () => {
    const { store, env } = house(true);
    const m = tool('mirror', env);
    m.tab();
    clickAt(m, 1, 2);
    store.undo();
    expect(walls(store)).toHaveLength(2);
  });

  it('clicar fora de parede não faz nada e mantém a ferramenta na escolha do eixo', () => {
    const { store, env, done } = house(false);
    const m = tool('mirror', env);
    m.tab();
    clickAt(m, 10, 10);
    expect(done()).toBe(0);
    expect((walls(store)[0] as Wall).a.y).toBeCloseTo(0);
  });

  it('Tab de novo volta aos dois pontos: o clique no eixo não espelha de imediato', () => {
    const { store, env, done } = house(false);
    const m = tool('mirror', env);
    m.tab();
    m.tab();
    clickAt(m, 1, 2);
    expect(done()).toBe(0);
    expect((walls(store)[0] as Wall).a.y).toBeCloseTo(0);
  });
});
