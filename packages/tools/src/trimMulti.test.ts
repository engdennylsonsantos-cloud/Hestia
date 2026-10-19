import { describe, expect, it } from 'vitest';
import type { Wall } from '@hestia/model';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';
import { createTool } from './index.ts';

/** Duas paredes horizontais (y=0 e y=1) cruzando uma vertical de referência em x=3. */
function setup() {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [5, 0]);
  drawWall(ctx.env, [0, 1], [5, 1]);
  drawWall(ctx.env, [3, -2], [3, 2]);
  return ctx;
}

describe('aparar em lote (F4)', () => {
  it('Shift+clique acumula paredes e a referência aplica a todas num único passo', () => {
    const { store, env } = setup();
    const [h1, h2, ref] = walls(store) as [Wall, Wall, Wall];
    const t = tool('trim', env);
    clickAt(t, 1, 0, { shift: true });
    clickAt(t, 4, 1, { shift: true });
    // a parede do meio (y=0) mantém a parte da esquerda; a de cima (y=1), a da direita
    clickAt(t, 3, -1);
    const after = walls(store);
    expect(after[0]!.id).toBe(h1.id);
    expect((after[0] as Wall).b.x).toBeCloseTo(3);
    expect((after[1] as Wall).a.x).toBeCloseTo(3);
    expect((after[1] as Wall).a.y).toBeCloseTo(h2.a.y);
    expect((after[2] as Wall).a.y).toBeCloseTo(ref.a.y); // referência intacta
    expect((after[2] as Wall).b.y).toBeCloseTo(ref.b.y);
    store.undo();
    expect((walls(store)[0] as Wall).b.x).toBeCloseTo(5);
    expect((walls(store)[1] as Wall).a.x).toBeCloseTo(0);
  });

  it('Shift+clique de novo tira a parede da lista', () => {
    const { store, env } = setup();
    const t = tool('trim', env);
    clickAt(t, 1, 0, { shift: true });
    clickAt(t, 4, 1, { shift: true });
    clickAt(t, 1, 0, { shift: true }); // tira a primeira
    clickAt(t, 3, -1);
    expect((walls(store)[0] as Wall).b.x).toBeCloseTo(5); // não foi aparada
    expect((walls(store)[1] as Wall).a.x).toBeCloseTo(3);
  });

  it('a referência não pode estar na lista', () => {
    const { store, env } = setup();
    const t = tool('trim', env);
    clickAt(t, 3, -1, { shift: true });
    clickAt(t, 3, -1);
    expect((walls(store)[2] as Wall).a.y).toBeCloseTo(-2);
    expect(store.canUndo).toBe(true); // só as drawWall
    expect(store.undoLabel).not.toBe('Aparar ao canto');
  });

  it('Esc descarta a lista sem alterar o modelo', () => {
    const { store, env } = setup();
    const t = tool('trim', env);
    clickAt(t, 1, 0, { shift: true });
    t.cancel();
    clickAt(t, 3, -1);
    expect((walls(store)[0] as Wall).b.x).toBeCloseTo(5);
  });

  it('um clique sem Shift continua aparando só duas paredes', () => {
    const { store, env } = setup();
    const t = createTool('trim', env);
    t.start();
    clickAt(t, 1, 0);
    clickAt(t, 3, -1);
    expect((walls(store)[0] as Wall).b.x).toBeCloseTo(3);
    expect((walls(store)[1] as Wall).a.x).toBeCloseTo(0);
    store.undo();
    expect((walls(store)[0] as Wall).b.x).toBeCloseTo(5);
  });
});
