import { describe, expect, it } from 'vitest';
import { makeWall, type Wall } from '@hestia/model';
import { clickAt, drawWall, makeEnv, P, tool, walls } from './testEnv.ts';

/** Parede horizontal de 0 a 6 (alvenaria 14) e referência vertical em x=3 (alvenaria 9). */
function cena(portaEm: number | null) {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [6, 0]);
  ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'v', typeId: 'wt_alv9', levelId: 'lv_0', a: { x: 3, y: -2 }, b: { x: 3, y: 2 } }) });
  if (portaEm !== null) {
    ctx.store.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: walls(ctx.store)[0]!.id, offset: portaEm, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P-02' } });
  }
  return ctx;
}

const horizontal = (ctx: ReturnType<typeof makeEnv>): Wall => walls(ctx.store).find((w) => w.id !== 'v')!;

describe('Aparar avisa e confirma a abertura que sai da parede', () => {
  it('Cancelar não muda parede, abertura nem seleção', () => {
    const ctx = cena(5.5);
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    ctx.env.confirmHostedLoss = (_losses, message) => {
      msgs.push(message);
      return false;
    };
    const antes = JSON.stringify(ctx.store.project);
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0);
    clickAt(t, 3, 1);
    expect(JSON.stringify(ctx.store.project)).toBe(antes);
    expect(msgs.some((m) => m.includes('P-02'))).toBe(true);
    expect(ctx.store.undoLabel).not.toBe('Aparar ao canto');
  });

  it('Excluir tira a porta e o Ctrl+Z devolve parede e porta juntas', () => {
    const ctx = cena(5.5);
    ctx.env.confirmHostedLoss = () => true;
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0);
    clickAt(t, 3, 1);
    expect(horizontal(ctx).b.x).toBeCloseTo(3);
    expect(ctx.store.project.elements.d1).toBeUndefined();
    ctx.store.undo();
    expect(horizontal(ctx).b.x).toBeCloseTo(6);
    expect(ctx.store.project.elements.d1).toBeDefined();
  });

  it('sem abertura afetada não abre diálogo', () => {
    const ctx = cena(1.5);
    let pediu = false;
    ctx.env.confirmHostedLoss = () => {
      pediu = true;
      return false;
    };
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0);
    clickAt(t, 3, 1);
    expect(pediu).toBe(false);
    expect(horizontal(ctx).b.x).toBeCloseTo(3);
    expect(ctx.store.project.elements.d1).toBeDefined();
  });

  it('aparar e unir trabalham eixo com eixo, mesmo com espessuras diferentes', () => {
    const ctx = cena(null);
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0);
    clickAt(t, 3, 1);
    const w = horizontal(ctx);
    const v = ctx.store.project.elements.v as Wall;
    expect(w.b.x).toBeCloseTo(3, 9);
    expect(w.b.y).toBeCloseTo(0, 9);
    expect(v.a.x).toBeCloseTo(3, 9);
    expect(v.a.y).toBeCloseTo(0, 9);

    // Junção: alternar encosto/esquadria não desloca as pontas do eixo (as espessuras não entram).
    const j = tool('joins', ctx.env);
    clickAt(j, 3, 0);
    const w2 = horizontal(ctx);
    const v2 = ctx.store.project.elements.v as Wall;
    expect(w2.b.x).toBeCloseTo(3, 9);
    expect(v2.a.x).toBeCloseTo(3, 9);
  });
});

describe('Prévia tracejada do Aparar nos três modos', () => {
  const dashed = (items: ReturnType<ReturnType<typeof tool>['preview']>) => items.filter((i) => i.kind === 'line' && !('tone' in i && i.tone));
  const invalid = (items: ReturnType<ReturnType<typeof tool>['preview']>) => items.filter((i) => i.kind === 'line' && 'tone' in i && i.tone === 'invalid');

  it('modo um elemento mostra a parede que muda', () => {
    const ctx = cena(1.5);
    ctx.options.trimMode = 'unico';
    const t = tool('trim', ctx.env);
    clickAt(t, 3, 1);
    t.move(P(1, 0));
    expect(dashed(t.preview()).some((i) => i.kind === 'line' && i.dashed)).toBe(true);
  });

  it('modo canto mostra as duas paredes e, em vermelho, a abertura que sairia', () => {
    const ctx = cena(5.5);
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0);
    t.move(P(3, 1));
    const items = t.preview();
    expect(items.filter((i) => i.kind === 'line' && i.dashed)).toHaveLength(2);
    expect(invalid(items).length).toBeGreaterThan(0);
  });

  it('modo vários mostra a parede da lista depois do Shift+clique', () => {
    const ctx = cena(5.5);
    ctx.options.trimMode = 'varios';
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0, { shift: true });
    t.move(P(3, 1));
    const items = t.preview();
    expect(items.some((i) => i.kind === 'line' && i.dashed)).toBe(true);
    expect(invalid(items).length).toBeGreaterThan(0);
  });
});
