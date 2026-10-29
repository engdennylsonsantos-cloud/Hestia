import { describe, expect, it } from 'vitest';
import { makeWall, openingsOfWall } from '@hestia/model';
import { execWithHostedLoss } from './hostedGuard.ts';
import { makeEnv } from './testEnv.ts';

/** Parede de 6 m com porta P-02 (0,80) em 5,50 e janela JX (1,20) em 1,50. */
function cena() {
  const ctx = makeEnv();
  ctx.store.exec({ type: 'addWall', wall: makeWall({ id: 'h', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
  ctx.store.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 5.5, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P-02' } });
  ctx.store.exec({ type: 'addOpening', opening: { id: 'j1', kind: 'window', typeId: 'ot_j120', hostId: 'h', offset: 1.5, flipHand: false, flipFacing: false, sillOverride: null, mark: 'JX' } });
  return ctx;
}

const encurtar = [{ type: 'setWallEnds' as const, id: 'h', b: { x: 5.5, y: 0 } }];

describe('execWithHostedLoss', () => {
  it('confirma e exclui a abertura no mesmo passo de desfazer', () => {
    const ctx = cena();
    const pedidos: string[] = [];
    ctx.env.confirmHostedLoss = (_losses, message) => {
      pedidos.push(message);
      return true;
    };
    const r = execWithHostedLoss(ctx.env, 'Aparar', encurtar);
    expect(r.status).toBe('applied');
    expect(r.losses.map((l) => l.id)).toEqual(['d1']);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toContain('P-02');
    expect(openingsOfWall(ctx.store.project, 'h').map((o) => o.id)).toEqual(['j1']);
    ctx.store.undo();
    expect(openingsOfWall(ctx.store.project, 'h').map((o) => o.id).sort()).toEqual(['d1', 'j1']);
    expect(ctx.store.project.elements.h).toMatchObject({ b: { x: 6, y: 0 } });
  });

  it('cancelar não altera parede nem aberturas', () => {
    const ctx = cena();
    ctx.env.confirmHostedLoss = () => false;
    const antes = JSON.stringify(ctx.store.project);
    const r = execWithHostedLoss(ctx.env, 'Aparar', encurtar);
    expect(r.status).toBe('cancelled');
    expect(JSON.stringify(ctx.store.project)).toBe(antes);
  });

  it('sem aberturas afetadas não pergunta nada', () => {
    const ctx = cena();
    let pediu = false;
    ctx.env.confirmHostedLoss = () => {
      pediu = true;
      return false;
    };
    const r = execWithHostedLoss(ctx.env, 'Aparar', [{ type: 'setWallEnds', id: 'h', b: { x: 5.9, y: 0 } }]);
    expect(r.status).toBe('applied');
    expect(pediu).toBe(false);
    expect(openingsOfWall(ctx.store.project, 'h')).toHaveLength(2);
  });

  it('sem o gancho de confirmação mantém o comportamento antigo', () => {
    const ctx = cena();
    const r = execWithHostedLoss(ctx.env, 'Aparar', encurtar);
    expect(r.status).toBe('applied');
    expect(openingsOfWall(ctx.store.project, 'h').map((o) => o.id)).toEqual(['j1']);
  });

  it('confirmação assíncrona aplica depois da resposta', async () => {
    const ctx = cena();
    ctx.env.confirmHostedLoss = async () => true;
    const r = execWithHostedLoss(ctx.env, 'Aparar', encurtar);
    expect(r.status).toBe('pending');
    expect(openingsOfWall(ctx.store.project, 'h')).toHaveLength(2);
    await Promise.resolve();
    expect(openingsOfWall(ctx.store.project, 'h').map((o) => o.id)).toEqual(['j1']);
  });

  it('resposta assíncrona negativa não muda nada', async () => {
    const ctx = cena();
    ctx.env.confirmHostedLoss = async () => false;
    const antes = JSON.stringify(ctx.store.project);
    expect(execWithHostedLoss(ctx.env, 'Aparar', encurtar).status).toBe('pending');
    await Promise.resolve();
    expect(JSON.stringify(ctx.store.project)).toBe(antes);
  });
});
