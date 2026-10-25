import { describe, expect, it } from 'vitest';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

describe('Copiar: sessão em um passo de desfazer', () => {
  it('várias cópias de uma mesma sessão viram um só Ctrl+Z', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    const w0 = walls(ctx.store)[0]!;
    ctx.env.setSelection([w0.id]);
    const c = tool('copy', ctx.env);
    clickAt(c, 0, 0); // ponto base
    clickAt(c, 0, 1);
    clickAt(c, 0, 2);
    clickAt(c, 0, 3);
    expect(walls(ctx.store)).toHaveLength(4);
    ctx.store.undo();
    expect(walls(ctx.store)).toHaveLength(1);
    expect(ctx.store.canUndo).toBe(true); // a parede original continua no histórico (criada antes)
  });

  it('uma nova sessão de Copiar é outro passo de desfazer', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    const w0 = walls(ctx.store)[0]!;
    ctx.env.setSelection([w0.id]);
    const c1 = tool('copy', ctx.env);
    clickAt(c1, 0, 0);
    clickAt(c1, 0, 1);
    c1.cancel();
    const c2 = tool('copy', ctx.env);
    clickAt(c2, 0, 0);
    clickAt(c2, 0, 2);
    c2.cancel();
    expect(walls(ctx.store)).toHaveLength(3);
    ctx.store.undo();
    expect(walls(ctx.store)).toHaveLength(2);
    ctx.store.undo();
    expect(walls(ctx.store)).toHaveLength(1);
  });

  it('um Mover depois de Copiar não se junta ao passo de cópia', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    const w0 = walls(ctx.store)[0]!;
    ctx.env.setSelection([w0.id]);
    const c = tool('copy', ctx.env);
    clickAt(c, 0, 0);
    clickAt(c, 0, 1);
    c.cancel();
    const m = tool('move', ctx.env);
    clickAt(m, 0, 0);
    clickAt(m, 2, 0);
    expect(walls(ctx.store)).toHaveLength(2);
    ctx.store.undo(); // desfaz só o Mover
    expect(walls(ctx.store)).toHaveLength(2);
    ctx.store.undo(); // desfaz a cópia
    expect(walls(ctx.store)).toHaveLength(1);
  });
});

describe('Esc em Copiar e Mover', () => {
  it('Copiar com cópias feitas: um Esc encerra a sessão', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    ctx.env.setSelection([walls(ctx.store)[0]!.id]);
    const before = ctx.done();
    const c = tool('copy', ctx.env);
    clickAt(c, 0, 0);
    clickAt(c, 0, 1);
    c.cancel();
    expect(ctx.done()).toBe(before + 1);
  });

  it('Copiar sem cópias: o primeiro Esc só cancela o ponto-base; o segundo sai', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    ctx.env.setSelection([walls(ctx.store)[0]!.id]);
    const before = ctx.done();
    const c = tool('copy', ctx.env);
    clickAt(c, 0, 0);
    c.cancel();
    expect(ctx.done()).toBe(before);
    c.cancel();
    expect(ctx.done()).toBe(before + 1);
  });

  it('Mover após o ponto-base: o primeiro Esc cancela o ponto; o segundo sai', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    ctx.env.setSelection([walls(ctx.store)[0]!.id]);
    const before = ctx.done();
    const m = tool('move', ctx.env);
    clickAt(m, 0, 0);
    m.cancel();
    expect(ctx.done()).toBe(before);
    m.cancel();
    expect(ctx.done()).toBe(before + 1);
  });
});

describe('Girar e espelhar sem cópia: as paredes unidas acompanham', () => {
  it('girar a parede selecionada estica a vizinha que termina na ponta movida', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]); // w0 (selecionada)
    drawWall(ctx.env, [4, 0], [4, 3]); // w1: começa em (4,0)
    const [w0, w1] = walls(ctx.store);
    ctx.env.setSelection([w0!.id]);
    const r = tool('rotate', ctx.env);
    clickAt(r, 0, 0); // centro
    expect(r.type('90')).toBe(true);
    const after = walls(ctx.store);
    const a0 = after.find((w) => w.id === w0!.id)!;
    const a1 = after.find((w) => w.id === w1!.id)!;
    expect(a0.b.x).toBeCloseTo(0);
    expect(a0.b.y).toBeCloseTo(4);
    expect(a1.a.x).toBeCloseTo(0);
    expect(a1.a.y).toBeCloseTo(4);
    ctx.store.undo(); // um só passo de desfazer para o giro inteiro
    const back = walls(ctx.store);
    expect(back.find((w) => w.id === w1!.id)!.a.x).toBeCloseTo(4);
  });

  it('espelhar a parede selecionada estica a vizinha que termina na ponta movida', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]); // w0 (selecionada)
    drawWall(ctx.env, [4, 0], [4, 3]); // w1: começa em (4,0)
    const [w0, w1] = walls(ctx.store);
    ctx.env.setSelection([w0!.id]);
    const m = tool('mirror', ctx.env);
    clickAt(m, -1, -1); // eixo vertical x = -1
    clickAt(m, -1, 5);
    const after = walls(ctx.store);
    const a0 = after.find((w) => w.id === w0!.id)!;
    const a1 = after.find((w) => w.id === w1!.id)!;
    expect(a0.a.x).toBeCloseTo(-2);
    expect(a0.b.x).toBeCloseTo(-6);
    expect(a1.a.x).toBeCloseTo(-6);
    expect(a1.a.y).toBeCloseTo(0);
  });
});
