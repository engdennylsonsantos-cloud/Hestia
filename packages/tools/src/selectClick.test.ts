import { describe, expect, it } from 'vitest';
import { makeEnv, drawWall, P, tool, walls } from './testEnv.ts';
import type { PointerInfo, ToolEnv } from './types.ts';

/** Clique completo (pressionar e soltar sem arrasto) com modificadores, como o ViewportCanvas entrega. */
function click(t: ReturnType<typeof tool>, x: number, y: number, mods: Partial<PointerInfo> = {}): void {
  const p = P(x, y, mods);
  t.move(p);
  t.down?.(p);
  t.up?.(p);
  t.click(p);
}

/** Duas paredes paralelas: a de baixo (y=0) e a de cima (y=2), com os pontos médios em (2,0) e (2,2). */
function twoWalls(): { env: ToolEnv; ids: string[]; sel: () => string[] } {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  drawWall(ctx.env, [0, 2], [4, 2]);
  const [low, high] = walls(ctx.store).sort((a, b) => a.a.y - b.a.y);
  return { env: ctx.env, ids: [low!.id, high!.id], sel: () => [...ctx.env.selection()] };
}

describe('clique de seleção com Shift e Ctrl (planta)', () => {
  it('sem modificador, o clique substitui a seleção', () => {
    const { env, ids, sel } = twoWalls();
    const t = tool('select', env);
    click(t, 2, 0);
    click(t, 2, 2);
    expect(sel()).toEqual([ids[1]]);
  });

  it('Shift soma o elemento à seleção', () => {
    const { env, ids, sel } = twoWalls();
    const t = tool('select', env);
    click(t, 2, 0);
    click(t, 2, 2, { shift: true });
    expect(sel()).toEqual([ids[0], ids[1]]);
  });

  it('Ctrl soma o elemento à seleção, como Shift', () => {
    const { env, ids, sel } = twoWalls();
    const t = tool('select', env);
    click(t, 2, 0);
    click(t, 2, 2, { ctrl: true });
    expect(sel()).toEqual([ids[0], ids[1]]);
  });

  it('Ctrl em um elemento já selecionado o retira (alterna)', () => {
    const { env, ids, sel } = twoWalls();
    const t = tool('select', env);
    click(t, 2, 0);
    click(t, 2, 2, { ctrl: true });
    click(t, 2, 2, { ctrl: true });
    expect(sel()).toEqual([ids[0]]);
  });

  it('Shift ou Ctrl em vazio mantém a seleção; sem modificador, vazio limpa', () => {
    const { env, ids, sel } = twoWalls();
    const t = tool('select', env);
    click(t, 2, 0);
    click(t, 10, 10, { ctrl: true });
    expect(sel()).toEqual([ids[0]]);
    click(t, 10, 10);
    expect(sel()).toEqual([]);
  });
});
