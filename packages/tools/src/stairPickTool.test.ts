import { describe, expect, it } from 'vitest';
import { makeSlab, makeWall, stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import type { StairTool } from './stairTool.ts';

/** Ambiente da ferramenta com as opções da escada e as mensagens da barra capturadas. */
function setup(stair: Record<string, unknown> = {}) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stair = stair;
  return { ...ctx, msgs, last: () => msgs[msgs.length - 1] ?? '' };
}

/** Parede reta ou em arco (`sag`) no nível 0, criada direto no modelo (como a ferramenta Parede faria). */
function addWall(ctx: ReturnType<typeof setup>, id: string, a: [number, number], b: [number, number], sag = 0): void {
  ctx.store.exec({
    type: 'addWall',
    wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, height: 2.8, locationLine: 'wallCenter', flipped: false, sag }),
  });
}

const stairsOf = (ctx: ReturnType<typeof setup>): Stair[] => stairsOnLevel(ctx.store.project, 'lv_0');
const runOf = (s: Stair): StairRun => s.components[0] as StairRun;

/** Espelhos verticais em x (cada um um par de cliques, de y = −1 a y = 1). */
function risers(t: StairTool, xs: number[]): void {
  for (const x of xs) {
    clickAt(t, x, -1);
    clickAt(t, x, 1);
  }
}

/** Do croqui pronto (limites já fechados) a Concluir: espelhos em x = 1, 2, 3 e grava. */
function finishRun(t: StairTool): void {
  t.setPick(false);
  t.setSubmode('espelhos');
  risers(t, [1, 2, 3]);
  t.setSubmode('concluir');
}

describe('Pegar linhas: parede reta com deslocamento', () => {
  it('a prévia destaca a linha pega e mostra o resultado deslocado para o lado do cursor (antes do clique)', () => {
    const ctx = setup({ pickOffset: 0.3 });
    addWall(ctx, 'w_a', [0, 0], [4, 0]);
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    expect(t.status().picking).toBe(true);
    t.move(P(2, 0.02)); // acima do eixo: à esquerda de 0→4
    const prev = t.preview();
    expect(prev.some((i) => i.kind === 'line' && i.tone === undefined && i.a.y === 0 && i.b.y === 0)).toBe(true);
    expect(prev.some((i) => i.kind === 'line' && i.dashed === true && i.tone === 'boundary' && Math.abs(i.a.y - 0.3) < 1e-9)).toBe(true);
    expect(prev.some((i) => i.kind === 'label' && /0,30 m/.test(i.text))).toBe(true);
  });

  it('deslocamento para a esquerda do sentido a→b (cursor de cima) e para a direita (cursor de baixo)', () => {
    for (const [cursorY, expected] of [
      [0.02, 0.3],
      [-0.02, -0.3],
    ] as const) {
      const ctx = setup({ pickOffset: 0.3 });
      addWall(ctx, 'w_a', [0, 0], [4, 0]);
      addWall(ctx, 'w_b', [0, -0.5], [4, -0.5]);
      const t = tool('stair', ctx.env) as StairTool;
      t.setPick(true);
      clickAt(t, 2, cursorY);
      t.confirm();
      expect(t.status().phase).toBe('right');
      ctx.options.stair = { pickOffset: 0 };
      t.refresh();
      clickAt(t, 2, -0.5);
      t.confirm();
      finishRun(t);
      const s = stairsOf(ctx)[0]!;
      expect(runOf(s).boundaryLeft[0]!.a.y).toBeCloseTo(expected, 9);
      expect(runOf(s).boundaryLeft[0]!.b.y).toBeCloseTo(expected, 9);
      expect(runOf(s).boundaryRight[0]!.a.y).toBeCloseTo(-0.5, 9);
    }
  });
});

describe('Pegar linhas: arco de parede', () => {
  it('um arco de parede vira arco (sag) do croqui, com a mesma flecha', () => {
    const ctx = setup();
    addWall(ctx, 'w_arc', [0, 0], [4, 0], 1); // abaula à esquerda: o apex está em y = 1
    addWall(ctx, 'w_b', [0, -0.5], [4, -0.5]);
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    t.move(P(2, 0.99));
    clickAt(t, 2, 0.99);
    t.confirm();
    clickAt(t, 2, -0.5);
    t.confirm();
    finishRun(t);
    const s = stairsOf(ctx)[0]!;
    expect(runOf(s).boundaryLeft[0]!.sag).toBeCloseTo(1, 9);
    expect(runOf(s).boundaryRight[0]!.sag).toBe(0);
  });
});

describe('Pegar linhas: corrente', () => {
  /** Três paredes encadeadas (0→4→8→12) desenhadas pela ferramenta Parede, mais o limite direito. */
  function threeWalls() {
    const ctx = setup();
    const w = tool('wall', ctx.env);
    clickAt(w, 0, 0);
    clickAt(w, 4, 0);
    clickAt(w, 8, 0);
    clickAt(w, 12, 0);
    w.cancel();
    addWall(ctx, 'w_b', [0, -0.5], [12, -0.5]);
    expect(Object.values(ctx.store.project.elements).filter((e) => e.kind === 'wall')).toHaveLength(4);
    return ctx;
  }

  it('Corrente pega as três paredes de uma vez, do ponto clicado até as pontas, e o limite fica contínuo', () => {
    const ctx = threeWalls();
    ctx.options.stair = { pickChain: true, pickOffset: 0 };
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    clickAt(t, 2, 0); // no meio da 1ª parede
    t.confirm();
    expect(t.status().phase).toBe('right');
    clickAt(t, 2, -0.5);
    t.confirm();
    finishRun(t);
    const s = stairsOf(ctx)[0]!;
    const left = runOf(s).boundaryLeft;
    expect(left).toHaveLength(3);
    expect(left.map((c) => [c.a.x, c.b.x])).toEqual([
      [0, 4],
      [4, 8],
      [8, 12],
    ]);
    expect(t.status().issues.some((i) => i.code === 'stair-boundary-gap')).toBe(false);
  });

  it('sem Corrente, a mesma parede pega só um segmento', () => {
    const ctx = threeWalls();
    ctx.options.stair = { pickChain: false, pickOffset: 0 };
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    clickAt(t, 2, 0);
    t.confirm();
    clickAt(t, 2, -0.5);
    t.confirm();
    finishRun(t);
    expect(runOf(stairsOf(ctx)[0]!).boundaryLeft).toHaveLength(1);
  });
});

describe('Pegar linhas: desfazer e refazer', () => {
  it('Delete e Ctrl+Z desfazem a última pegada; Ctrl+Y refaz; quem não é pegada segue no histórico do modelo', () => {
    const ctx = setup({ pickChain: true, pickOffset: 0 });
    addWall(ctx, 'w_a', [0, 0], [4, 0]);
    addWall(ctx, 'w_b', [4, 0], [8, 0]);
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    clickAt(t, 2, 0);
    expect(t.undoPick()).toBe(true);
    expect(t.undoPick()).toBe(false);
    t.confirm();
    expect(ctx.last()).toBe('Desenhe o limite esquerdo antes de Enter.');
    clickAt(t, 2, 0);
    expect(t.deleteKey()).toBe(true);
    t.confirm();
    expect(ctx.last()).toBe('Desenhe o limite esquerdo antes de Enter.');
    clickAt(t, 2, 0);
    expect(t.undoPick()).toBe(true);
    expect(t.redoPick()).toBe(true);
    t.confirm();
    expect(t.status().phase).toBe('right');
  });

  it('desfazer uma pegada de espelho tira o espelho; a ação de desenho seguinte limpa o histórico', () => {
    const ctx = setup();
    addWall(ctx, 'w_a', [-0.5, 0.5], [5, 0.5]);
    addWall(ctx, 'w_b', [-0.5, -0.5], [5, -0.5]);
    addSlab(ctx);
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    clickAt(t, 2, 0.5);
    t.confirm();
    clickAt(t, 2, -0.5);
    t.confirm();
    expect(t.status().submode).toBe('espelhos');
    clickAt(t, 2, 0); // aresta de laje em x = 2: vira espelho
    expect(t.status().created).toBe(1);
    expect(t.undoPick()).toBe(true);
    expect(t.status().created).toBe(0);
    t.setPick(false);
    clickAt(t, 3, -1);
    clickAt(t, 3, 1);
    expect(t.status().created).toBe(1);
    expect(t.undoPick()).toBe(false);
  });
});

describe('Pegar linhas: validação do croqui pego', () => {
  it('limite pego com vão é recusado pelo validador (aviso de erro na barra) e Concluir não grava', () => {
    const ctx = setup({ pickOffset: 0 });
    addWall(ctx, 'w_a', [0, 0], [4, 0]);
    addWall(ctx, 'w_c', [6, 0], [10, 0]);
    addWall(ctx, 'w_b', [0, -0.5], [10, -0.5]);
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    clickAt(t, 2, 0);
    clickAt(t, 8, 0); // sem Corrente: a 2ª parede entra na mesma cadeia, com vão
    t.confirm();
    clickAt(t, 5, -0.5);
    t.confirm();
    finishRun(t);
    expect(t.status().issues.map((i) => i.code)).toContain('stair-boundary-gap');
    expect(t.status().canFinish).toBe(false);
    t.setSubmode('concluir');
    expect(stairsOf(ctx)).toHaveLength(0);
    expect(ctx.last()).toMatch(/Não é possível concluir: .*cadeia contínua/);
  });
});

describe('Pegar linhas: alvos e recusas', () => {
  it('a linha de outra escada entra como destaque e pode ser pega', () => {
    const ctx = setup();
    const t0 = tool('stair', ctx.env) as StairTool;
    clickAt(t0, -0.5, 0.5);
    clickAt(t0, 5, 0.5);
    t0.confirm();
    clickAt(t0, -0.5, -0.5);
    clickAt(t0, 5, -0.5);
    t0.confirm();
    risers(t0, [0, 1, 2]);
    t0.setSubmode('concluir');
    ctx.env.setSelection([]);
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    t.move(P(2, 0.5));
    expect(t.preview().some((i) => i.kind === 'line' && i.tone === undefined && i.a.y === 0.5)).toBe(true);
    clickAt(t, 2, 0.5);
    t.confirm();
    expect(t.status().phase).toBe('right');
  });

  it('patamar não pega linhas; espelho pego sem limites é recusado', () => {
    const ctx = setup();
    addWall(ctx, 'w_a', [0, 0], [4, 0]);
    const t = tool('stair', ctx.env) as StairTool;
    t.setSubmode('patamar');
    t.setPick(true);
    expect(t.status().picking).toBe(false);
    expect(ctx.last()).toBe('Pegar linhas vale para limites, espelhos e caminhada.');
    t.setSubmode('espelhos');
    t.setPick(true);
    clickAt(t, 2, 0);
    expect(ctx.last()).toBe('Desenhe os limites antes dos espelhos.');
    expect(t.status().created).toBe(0);
  });

  it('Tab sai de Pegar linhas e alterna linha/arco (é a escolha de primitiva)', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    t.setPick(true);
    t.tab();
    expect(t.status().picking).toBe(false);
    expect(t.status().primitive).toBe('arc');
  });
});

function addSlab(ctx: ReturnType<typeof setup>): void {
  // Quadrado de 1 m, de x = 1 a 2 e y = −1 a 1: a aresta em x = 2 (de y = −1 a 1) vira espelho.
  ctx.store.exec({
    type: 'addSlab',
    slab: makeSlab({
      id: 'sl_1',
      typeId: 'ls_mac12',
      levelId: 'lv_0',
      boundary: [
        { x: 1, y: -1 },
        { x: 2, y: -1 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
      ],
    }),
  });
}
