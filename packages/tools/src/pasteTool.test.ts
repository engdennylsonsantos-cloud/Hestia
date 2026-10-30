import { describe, expect, it } from 'vitest';
import { makeWall, wallsOnLevel } from '@hestia/model';
import { clipboardFrom } from './clipboard.ts';
import { setPasteClip } from './pasteTool.ts';
import { makeEnv, P, tool } from './testEnv.ts';

/** Projeto com uma parede reta de 4 m no eixo central (o centro dela é (2, 0)). */
function setup() {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'A', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, locationLine: 'wallCenter' }) });
  return ctx;
}

const copiaDaParede = (ctx: ReturnType<typeof setup>) => clipboardFrom(ctx.store.project, ['A'])!;

describe('Colar com prévia seguindo o cursor', () => {
  it('a prévia acompanha o cursor e o clique cola deslocado, num só passo de desfazer', () => {
    const ctx = setup();
    setPasteClip(copiaDaParede(ctx));
    const t = tool('paste', ctx.env);

    t.move(P(10, 10));
    const band = t.preview().find((i) => i.kind === 'wallBand');
    expect(band?.kind).toBe('wallBand');
    if (band?.kind !== 'wallBand') throw new Error('sem faixa de parede na prévia');
    expect({ x: (band.a.x + band.b.x) / 2, y: (band.a.y + band.b.y) / 2 }).toEqual({ x: 10, y: 10 });

    t.click(P(10, 10));
    const novas = wallsOnLevel(ctx.store.project, 'lv_0').filter((w) => w.id !== 'A');
    expect(novas).toHaveLength(1);
    expect(novas[0]!.a).toEqual({ x: 8, y: 10 });
    expect(novas[0]!.b).toEqual({ x: 12, y: 10 });
    expect(ctx.sel()).toEqual([novas[0]!.id]);
    expect(ctx.done()).toBe(1);

    ctx.store.undo();
    expect(wallsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(1);
  });

  it('sem buffer, sai para Selecionar sem desenhar prévia', () => {
    const ctx = setup();
    setPasteClip(null);
    const t = tool('paste', ctx.env);
    expect(t.preview()).toEqual([]);
    expect(ctx.done()).toBe(1);
  });

  it('Esc cancela sem alterar o modelo', () => {
    const ctx = setup();
    setPasteClip(copiaDaParede(ctx));
    const t = tool('paste', ctx.env);
    t.move(P(10, 10));
    t.cancel();
    expect(wallsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(1);
    expect(ctx.done()).toBe(1);
  });
});
