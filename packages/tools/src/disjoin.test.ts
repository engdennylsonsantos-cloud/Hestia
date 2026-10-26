import { describe, expect, it } from 'vitest';
import type { ProjectStore } from '@hestia/model';
import { connectedEnds } from './pick.ts';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

/** Parede A (0,0)-(4,0) e B (4,0)-(4,3) ligadas no canto (4,0). */
function canto() {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]); // A
  drawWall(ctx.env, [4, 0], [4, 3]); // B
  const [a, b] = walls(ctx.store);
  return { ...ctx, aId: a!.id, bId: b!.id };
}

const wallById = (ctx: { store: ProjectStore }, id: string) => walls(ctx.store).find((w) => w.id === id)!;
/** Quantas paredes (fora da própria `id`) terminam no ponto. */
const ligadas = (ctx: { store: ProjectStore }, id: string, pt: { x: number; y: number }): number =>
  connectedEnds(ctx.store.project, 'lv_0', pt, new Set([id])).length;

describe('Mover: opção Desconectar', () => {
  it('desligada (padrão): a vizinha B se estica e continua ligada; desfazer volta tudo', () => {
    const ctx = canto();
    ctx.env.setSelection([ctx.aId]);
    const m = tool('move', ctx.env);
    clickAt(m, 0, 0);
    clickAt(m, 0, 1);
    const a = wallById(ctx, ctx.aId);
    const b = wallById(ctx, ctx.bId);
    expect(a.a.y).toBeCloseTo(1);
    expect(a.b.y).toBeCloseTo(1);
    expect(b.a).toEqual({ x: 4, y: 1 });
    expect(b.b).toEqual({ x: 4, y: 3 });
    expect(ligadas(ctx, a.id, a.b)).toBe(1);
    ctx.store.undo();
    expect(wallById(ctx, ctx.aId).a.y).toBeCloseTo(0);
    expect(wallById(ctx, ctx.bId).a).toEqual({ x: 4, y: 0 });
    expect(ligadas(ctx, ctx.aId, wallById(ctx, ctx.aId).b)).toBe(1);
  });

  it('ligada: B fica parada e a ponta de A se solta; desfazer volta tudo', () => {
    const ctx = canto();
    ctx.options.moveDisjoin = true;
    ctx.env.setSelection([ctx.aId]);
    const m = tool('move', ctx.env);
    clickAt(m, 0, 0);
    clickAt(m, 0, 1);
    const a = wallById(ctx, ctx.aId);
    const b = wallById(ctx, ctx.bId);
    expect(a.b.y).toBeCloseTo(1);
    expect(b.a).toEqual({ x: 4, y: 0 });
    expect(b.b).toEqual({ x: 4, y: 3 });
    expect(ligadas(ctx, a.id, a.b)).toBe(0);
    ctx.store.undo();
    expect(wallById(ctx, ctx.aId).b.y).toBeCloseTo(0);
    expect(wallById(ctx, ctx.bId).a).toEqual({ x: 4, y: 0 });
    expect(ligadas(ctx, ctx.aId, wallById(ctx, ctx.aId).b)).toBe(1);
  });

  it('as duas selecionadas: vínculo mantido (com Desconectar ligado ou desligado)', () => {
    for (const disjoin of [false, true]) {
      const ctx = canto();
      ctx.options.moveDisjoin = disjoin;
      ctx.env.setSelection([ctx.aId, ctx.bId]);
      const m = tool('move', ctx.env);
      clickAt(m, 0, 0);
      clickAt(m, 0, 1);
      const b = wallById(ctx, ctx.bId);
      expect(b.a).toEqual({ x: 4, y: 1 });
      expect(b.b).toEqual({ x: 4, y: 4 });
      expect(ligadas(ctx, b.id, b.a)).toBe(1);
    }
  });

  it('Alt na confirmação alterna o Desconectar enquanto a tecla está segurada', () => {
    const semOpcao = canto();
    semOpcao.env.setSelection([semOpcao.aId]);
    const m = tool('move', semOpcao.env);
    clickAt(m, 0, 0);
    clickAt(m, 0, 1, { alt: true });
    expect(wallById(semOpcao, semOpcao.bId).a).toEqual({ x: 4, y: 0 });
    expect(ligadas(semOpcao, semOpcao.aId, wallById(semOpcao, semOpcao.aId).b)).toBe(0);
    const comOpcao = canto();
    comOpcao.options.moveDisjoin = true;
    comOpcao.env.setSelection([comOpcao.aId]);
    const m2 = tool('move', comOpcao.env);
    clickAt(m2, 0, 0);
    clickAt(m2, 0, 1, { alt: true });
    expect(wallById(comOpcao, comOpcao.bId).a).toEqual({ x: 4, y: 1 });
    expect(ligadas(comOpcao, comOpcao.aId, wallById(comOpcao, comOpcao.aId).b)).toBe(1);
  });
});

describe('Rotacionar: opção Desconectar', () => {
  function girar(disjoin: boolean, ambos = false) {
    const ctx = canto();
    ctx.options.rotateDisjoin = disjoin;
    ctx.env.setSelection(ambos ? [ctx.aId, ctx.bId] : [ctx.aId]);
    const r = tool('rotate', ctx.env);
    clickAt(r, 0, 0);
    expect(r.type('90')).toBe(true);
    return ctx;
  }

  it('desligada: a vizinha B se estica até a ponta girada e continua ligada; desfazer volta tudo', () => {
    const ctx = girar(false);
    const a = wallById(ctx, ctx.aId);
    const b = wallById(ctx, ctx.bId);
    expect(a.b.x).toBeCloseTo(0);
    expect(a.b.y).toBeCloseTo(4);
    expect(b.a.x).toBeCloseTo(0);
    expect(b.a.y).toBeCloseTo(4);
    expect(b.b).toEqual({ x: 4, y: 3 });
    expect(ligadas(ctx, a.id, a.b)).toBe(1);
    ctx.store.undo();
    expect(wallById(ctx, ctx.aId).b.y).toBeCloseTo(0);
    expect(wallById(ctx, ctx.bId).a).toEqual({ x: 4, y: 0 });
    expect(ligadas(ctx, ctx.aId, wallById(ctx, ctx.aId).b)).toBe(1);
  });

  it('ligada (padrão): B fica parada e a ponta de A se solta; desfazer volta tudo', () => {
    const ctx = girar(true);
    const a = wallById(ctx, ctx.aId);
    const b = wallById(ctx, ctx.bId);
    expect(a.b.x).toBeCloseTo(0);
    expect(a.b.y).toBeCloseTo(4);
    expect(b.a).toEqual({ x: 4, y: 0 });
    expect(b.b).toEqual({ x: 4, y: 3 });
    expect(ligadas(ctx, a.id, a.b)).toBe(0);
    ctx.store.undo();
    expect(wallById(ctx, ctx.aId).b.y).toBeCloseTo(0);
    expect(wallById(ctx, ctx.bId).a).toEqual({ x: 4, y: 0 });
    expect(ligadas(ctx, ctx.aId, wallById(ctx, ctx.aId).b)).toBe(1);
  });

  it('as duas selecionadas: giram juntas e o vínculo é mantido', () => {
    const ctx = girar(true, true);
    const a = wallById(ctx, ctx.aId);
    const b = wallById(ctx, ctx.bId);
    expect(a.b.x).toBeCloseTo(0);
    expect(a.b.y).toBeCloseTo(4);
    expect(b.a.x).toBeCloseTo(0);
    expect(b.a.y).toBeCloseTo(4);
    expect(b.b.x).toBeCloseTo(-3);
    expect(b.b.y).toBeCloseTo(4);
    expect(ligadas(ctx, a.id, a.b)).toBe(1);
  });

  it('configuração degenerada: solta a ponta e avisa na barra de status', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]); // A
    drawWall(ctx.env, [4, 0], [0, 4]); // B: a outra ponta é o destino de A girada
    const [a, b] = walls(ctx.store);
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    ctx.options.rotateDisjoin = false;
    ctx.env.setSelection([a!.id]);
    const r = tool('rotate', ctx.env);
    clickAt(r, 0, 0);
    expect(r.type('90')).toBe(true);
    expect(wallById(ctx, b!.id).a).toEqual({ x: 4, y: 0 });
    expect(wallById(ctx, b!.id).b).toEqual({ x: 0, y: 4 });
    expect(msgs.at(-1)).toMatch(/Rotacionar: uma parede ligada ficaria com comprimento zero/);
  });
});

describe('Espelhar: opção Desconectar', () => {
  function espelhar(disjoin: boolean, ambos = false) {
    const ctx = canto();
    ctx.options.mirrorDisjoin = disjoin;
    ctx.env.setSelection(ambos ? [ctx.aId, ctx.bId] : [ctx.aId]);
    const m = tool('mirror', ctx.env);
    clickAt(m, -1, -1); // eixo vertical x = -1
    clickAt(m, -1, 5);
    return ctx;
  }

  it('desligada (padrão): a vizinha B se estica até a ponta espelhada e continua ligada; desfazer volta tudo', () => {
    const ctx = espelhar(false);
    const a = wallById(ctx, ctx.aId);
    const b = wallById(ctx, ctx.bId);
    expect(a.a.x).toBeCloseTo(-2);
    expect(a.b.x).toBeCloseTo(-6);
    expect(b.a.x).toBeCloseTo(-6);
    expect(b.a.y).toBeCloseTo(0);
    expect(b.b).toEqual({ x: 4, y: 3 });
    expect(ligadas(ctx, a.id, a.b)).toBe(1);
    ctx.store.undo();
    expect(wallById(ctx, ctx.aId).b.x).toBeCloseTo(4);
    expect(wallById(ctx, ctx.bId).a).toEqual({ x: 4, y: 0 });
    expect(ligadas(ctx, ctx.aId, wallById(ctx, ctx.aId).b)).toBe(1);
  });

  it('ligada: B fica parada e a ponta de A se solta; desfazer volta tudo', () => {
    const ctx = espelhar(true);
    const a = wallById(ctx, ctx.aId);
    const b = wallById(ctx, ctx.bId);
    expect(a.b.x).toBeCloseTo(-6);
    expect(b.a).toEqual({ x: 4, y: 0 });
    expect(b.b).toEqual({ x: 4, y: 3 });
    expect(ligadas(ctx, a.id, a.b)).toBe(0);
    ctx.store.undo();
    expect(wallById(ctx, ctx.aId).b.x).toBeCloseTo(4);
    expect(wallById(ctx, ctx.bId).a).toEqual({ x: 4, y: 0 });
    expect(ligadas(ctx, ctx.aId, wallById(ctx, ctx.aId).b)).toBe(1);
  });

  it('as duas selecionadas: espelham juntas e o vínculo é mantido', () => {
    const ctx = espelhar(true, true);
    const b = wallById(ctx, ctx.bId);
    expect(b.a).toEqual({ x: -6, y: 0 });
    expect(b.b).toEqual({ x: -6, y: 3 });
    expect(ligadas(ctx, ctx.aId, wallById(ctx, ctx.aId).b)).toBe(1);
  });
});

describe('padrões das opções', () => {
  it('Mover e Espelhar mantêm a ligação; Rotacionar é livre', () => {
    const { options } = makeEnv();
    expect(options.moveDisjoin).toBe(false);
    expect(options.mirrorDisjoin).toBe(false);
    expect(options.rotateDisjoin).toBe(true);
  });
});
