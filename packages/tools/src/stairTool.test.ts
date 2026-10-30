import { describe, expect, it } from 'vitest';
import { stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { stairRunSteps } from '@hestia/engine';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import { copyWalls } from './edit.ts';
import { clipboardFrom, pasteAlignedCommand } from './clipboard.ts';
import { StairTool } from './stairTool.ts';
import type { Tool } from './types.ts';

/** Escada de teste com mensagens capturadas (o `say` do ambiente). */
function setup(stair: Record<string, unknown> = {}) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stair = stair;
  return { ...ctx, msgs, last: () => msgs[msgs.length - 1] ?? '' };
}

/** Limites da escada reta de teste: esquerdo em y = 0,5 e direito em y = −0,5, de x = −0,5 a 5. */
function boundaries(t: Tool): void {
  clickAt(t, -0.5, 0.5);
  clickAt(t, 5, 0.5);
  t.confirm();
  clickAt(t, -0.5, -0.5);
  clickAt(t, 5, -0.5);
  t.confirm();
}

/** Espelhos verticais em `xs`, de y = −1 a y = 1 (cada um é um par de cliques). */
function risers(t: Tool, xs: number[], y0 = -1, y1 = 1): void {
  for (const x of xs) {
    clickAt(t, x, y0);
    clickAt(t, x, y1);
  }
}

const stairsOf = (store: { project: Parameters<typeof stairsOnLevel>[0] }): Stair[] => stairsOnLevel(store.project, 'lv_0');
const runOf = (s: Stair): StairRun => s.components[0] as StairRun;

describe('ferramenta Escada: croqui reto por cliques', () => {
  it('limites, três espelhos, Enter e Concluir criam um Stair com o lance', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1, 2]);
    t.setSubmode('concluir');
    const [s] = stairsOf(ctx.store);
    expect(s).toBeDefined();
    expect(s!.levelId).toBe('lv_0');
    expect(s!.typeId).toBe('stt_monolitica');
    expect(s!.components).toHaveLength(1);
    expect(runOf(s!).risers).toHaveLength(3);
    expect(runOf(s!).boundaryLeft).toHaveLength(1);
    expect(ctx.done()).toBe(1);
    // Nível de topo: lv_1 (3 m) → H = 3 m; 3 espelhos ficam abaixo do máximo? Não: 1 m > 0,18 m, então é aviso.
    expect(ctx.last()).toMatch(/Escada criada com 3 de 17 espelhos: faltam 14 para chegar ao nível de cima/);
    expect(ctx.last()).toMatch(/Aviso/);
  });

  it('o contador mostra criados e restantes: 17 desejados (H 3 m ÷ 0,18 m), 2 desenhados → 15 restantes', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1]);
    const st = t.status();
    expect(st.created).toBe(2);
    expect(st.desired).toBe(17);
    expect(st.remaining).toBe(15);
    t.move(P(10, 10));
    expect(t.preview().some((i) => i.kind === 'label' && /15 restantes/.test(i.text))).toBe(true);
  });

  it('sem espelhos, Concluir recusa com "Desenhe os espelhos." e não cria nada', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    t.setSubmode('concluir');
    expect(stairsOf(ctx.store)).toHaveLength(0);
    expect(ctx.last()).toBe('Não é possível concluir: Desenhe os espelhos.');
    expect(ctx.done()).toBe(0);
  });

  it('limites que se tocam: o erro aparece na barra e Concluir não cria a escada', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    clickAt(t, -0.5, 0.5);
    clickAt(t, 5, 0.5);
    t.confirm();
    clickAt(t, -0.5, 0.5);
    clickAt(t, 5, 0.5);
    t.confirm();
    risers(t, [1]);
    expect(ctx.last()).toMatch(/não podem se tocar/);
    t.setSubmode('concluir');
    expect(stairsOf(ctx.store)).toHaveLength(0);
    expect(ctx.last()).toMatch(/Não é possível concluir: Os limites esquerdo e direito do lance não podem se tocar/);
  });

  it('espelhos que passam dos limites são aparados nos degraus calculados', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1, 2]);
    t.setSubmode('concluir');
    const s = stairsOf(ctx.store)[0]!;
    const { risers: steps, issues } = stairRunSteps(
      { boundaryLeft: runOf(s).boundaryLeft, boundaryRight: runOf(s).boundaryRight, risers: runOf(s).risers, path: [] },
      { baseZ: 0, riserHeight: 1 },
    );
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    for (const r of steps) for (const q of r.points) expect(Math.abs(Math.abs(q.y) - 0.5)).toBeLessThan(1e-6);
  });

  it('o croqui pode ser feito por ARCO: início, fim e flecha dão sag positivo (flecha de 1 m)', () => {
    const ctx = setup({ primitive: 'arc' });
    const t = tool('stair', ctx.env) as StairTool;
    clickAt(t, 0, 0.5);
    clickAt(t, 4, 0.5);
    clickAt(t, 2, 1.5);
    t.confirm();
    t.setPrimitive('line');
    clickAt(t, 0, -0.5);
    clickAt(t, 4, -0.5);
    t.confirm();
    risers(t, [1, 2, 3], -1, 3);
    t.setSubmode('concluir');
    const s = stairsOf(ctx.store)[0]!;
    expect(runOf(s).boundaryLeft[0]!.sag).toBeCloseTo(1, 6);
    expect(runOf(s).boundaryRight[0]!.sag).toBe(0);
  });

  it('arco encadeado precisa começar no fim da cadeia', () => {
    const ctx = setup({ primitive: 'line' });
    const t = tool('stair', ctx.env) as StairTool;
    clickAt(t, -0.5, 0.5);
    clickAt(t, 2, 0.5);
    t.setPrimitive('arc');
    clickAt(t, 3, 0.5);
    expect(ctx.last()).toBe('O arco deve começar no fim da cadeia.');
  });

  it('entrada numérica: com a linha em curso, digitar o comprimento põe o ponto a essa distância', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    clickAt(t, -0.5, 0.5);
    t.move(P(3, 0.5));
    expect(t.inputPrompt()).toBe('Comprimento');
    expect(t.type('2')).toBe(true);
    const line = t.preview().find((i) => i.kind === 'line' && i.tone === 'boundary' && i.dashed);
    expect(line && line.kind === 'line' && Math.abs(line.b.x - 1.5) < 1e-9).toBe(true);
  });

  it('o cursor encaixa nas extremidades já desenhadas (captura)', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    clickAt(t, -0.5, 0.5);
    clickAt(t, 5, 0.5);
    t.confirm();
    t.move(P(5.02, 0.52));
    expect(t.inference()?.point).toEqual({ x: 5, y: 0.5 });
  });

  it('a prévia mostra os degraus calculados quando o croqui está válido', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1, 2]);
    t.move(P(8, 8));
    // Sem nível de topo na barra (topLevelId null), a escada criada fecha no nível: 2 degraus + a chegada.
    expect(t.preview().filter((i) => i.kind === 'polygon' && i.tone === 'tread')).toHaveLength(3);
  });
});

describe('ferramenta Escada: Esc, Enter e sub-modos', () => {
  it('Esc em dois passos: 1º cancela a cadeia (fica na ferramenta), 2º descarta o croqui e sai', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    clickAt(t, -0.5, 0.5);
    clickAt(t, 2, 0.5);
    t.cancel();
    expect(ctx.done()).toBe(0);
    expect(t.status().created).toBe(0);
    t.cancel();
    expect(ctx.done()).toBe(1);
  });

  it('Esc com o croqui já desenhado descarta tudo e sai, sem gravar', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0]);
    t.cancel();
    expect(ctx.done()).toBe(1);
    expect(stairsOf(ctx.store)).toHaveLength(0);
  });

  it('Enter nos limites passa do esquerdo ao direito e, no direito, vai a Espelhos', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    clickAt(t, -0.5, 0.5);
    clickAt(t, 5, 0.5);
    t.confirm();
    expect(t.status().phase).toBe('right');
    clickAt(t, -0.5, -0.5);
    clickAt(t, 5, -0.5);
    t.confirm();
    expect(t.status().submode).toBe('espelhos');
  });

  it('Distribuir N espelhos usa N da barra de opções e deixa o croqui válido', () => {
    const ctx = setup({ distributeCount: 4 });
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    t.distribute();
    expect(t.status().created).toBe(4);
    expect(t.status().errors).toBe(0);
    t.setSubmode('concluir');
    expect(runOf(stairsOf(ctx.store)[0]!).risers).toHaveLength(4);
  });

  it('Concluir é uma transação: desfazer tira a escada inteira; refazer a devolve', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1, 2]);
    t.setSubmode('concluir');
    expect(stairsOf(ctx.store)).toHaveLength(1);
    ctx.store.undo();
    expect(stairsOf(ctx.store)).toHaveLength(0);
    ctx.store.redo();
    expect(stairsOf(ctx.store)).toHaveLength(1);
  });

  it('Tipo da barra de opções: o tipo escolhido é o da escada criada', () => {
    const ctx = setup({ typeId: 'stt_piso_espelho' });
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1]);
    t.setSubmode('concluir');
    expect(stairsOf(ctx.store)[0]!.typeId).toBe('stt_piso_espelho');
  });

  it('patamar: um laço fechado por cliques vira componente entre dois lances, na ordem de criação', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1, 2]);
    t.setSubmode('patamar');
    for (const [x, y] of [[6, 0], [9, 0], [9, 3], [6, 3], [6, 0]] as const) clickAt(t, x, y);
    expect(ctx.last()).toMatch(/Patamar criado/);
    t.setSubmode('limites');
    clickAt(t, 20, 0.5);
    clickAt(t, 25, 0.5);
    t.confirm();
    clickAt(t, 20, -0.5);
    clickAt(t, 25, -0.5);
    t.confirm();
    risers(t, [21, 22, 23]);
    t.setSubmode('concluir');
    const s = stairsOf(ctx.store)[0]!;
    expect(s.components.map((c) => c.kind)).toEqual(['run', 'landing', 'run']);
    const landing = s.components[1]!;
    expect(landing.kind === 'landing' && landing.boundary).toHaveLength(4);
  });

  it('patamar aberto, com Enter, dá erro de laço e não vira componente', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    t.setSubmode('patamar');
    clickAt(t, 6, 0);
    clickAt(t, 9, 0);
    clickAt(t, 9, 3);
    t.confirm();
    expect(ctx.last()).toBe('O contorno do patamar deve ser um laço fechado.');
  });
});

describe('ferramenta Escada: caminhada e apagar camada', () => {
  it('caminhada opcional: a cadeia do 1º ao último espelho é gravada; fora dos espelhos dá erro', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1, 2]);
    t.setSubmode('caminhada');
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    t.confirm();
    expect(t.status().firstError).toBeNull();
    t.setSubmode('concluir');
    expect(runOf(stairsOf(ctx.store)[0]!).path).toHaveLength(1);
  });

  it('caminhada que não encosta nos espelhos é erro de croqui e impede Concluir', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1, 2]);
    t.setSubmode('caminhada');
    clickAt(t, 0.2, 0.3);
    clickAt(t, 1.8, 0.3);
    t.confirm();
    expect(t.status().firstError).toMatch(/caminhada/);
    t.setSubmode('concluir');
    expect(stairsOf(ctx.store)).toHaveLength(0);
  });

  it('clearLayer apaga a camada do sub-modo: espelhos somem; sem nada a apagar, devolve false', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1]);
    t.setSubmode('espelhos');
    expect(t.clearLayer()).toBe(true);
    expect(t.status().created).toBe(0);
    t.setSubmode('caminhada');
    expect(t.clearLayer()).toBe(false);
  });
});

describe('ferramenta Escada: edição, seleção e comandos de modelo', () => {
  it('ativar com UMA escada selecionada entra em edição; Concluir faz uma transação e desfaz em um passo', () => {
    const ctx = setup();
    const t0 = tool('stair', ctx.env) as StairTool;
    boundaries(t0);
    risers(t0, [0, 1, 2]);
    t0.setSubmode('concluir');
    const id = stairsOf(ctx.store)[0]!.id;
    ctx.env.setSelection([id]);
    const t = tool('stair', ctx.env) as StairTool;
    expect(t.status().editing).toBe(true);
    t.setSubmode('espelhos');
    risers(t, [3]);
    t.setSubmode('concluir');
    expect(runOf(stairsOf(ctx.store)[0]!).risers).toHaveLength(4);
    ctx.store.undo();
    expect(runOf(stairsOf(ctx.store)[0]!).risers).toHaveLength(3);
  });

  it('clicar numa escada, com o croqui vazio, entra na edição dela', () => {
    const ctx = setup();
    const t0 = tool('stair', ctx.env) as StairTool;
    boundaries(t0);
    risers(t0, [0]);
    t0.setSubmode('concluir');
    ctx.env.setSelection([]);
    const t = tool('stair', ctx.env) as StairTool;
    clickAt(t, 2, 0);
    expect(t.status().editing).toBe(true);
  });

  it('Delete no croqui apaga o último espelho (e o passo em curso antes dele)', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1]);
    expect(t.deleteKey()).toBe(true);
    expect(t.status().created).toBe(1);
  });

  it('copiar a escada (transformação com cópia) cria outra com os componentes deslocados', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1]);
    t.setSubmode('concluir');
    const id = stairsOf(ctx.store)[0]!.id;
    const [nid] = copyWalls(ctx.env, [id], { kind: 'translate', d: { x: 10, y: 0 } });
    const copy = ctx.store.project.elements[nid!] as Stair;
    expect(copy.kind).toBe('stair');
    expect(runOf(copy).boundaryLeft[0]!.a.x).toBeCloseTo(9.5, 9);
    expect(stairsOf(ctx.store)).toHaveLength(2);
  });

  it('copiar e colar: o buffer leva a escada ao nível, com ids novos', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1]);
    t.setSubmode('concluir');
    const id = stairsOf(ctx.store)[0]!.id;
    const clip = clipboardFrom(ctx.store.project, [id]);
    expect(clip?.stairs).toHaveLength(1);
    const res = pasteAlignedCommand(ctx.store.project, clip!, 'lv_0');
    expect(res?.stairIds).toHaveLength(1);
    ctx.store.exec(res!.command);
    expect(stairsOf(ctx.store)).toHaveLength(2);
    expect(stairsOf(ctx.store).map((s) => s.id)).toContain(res!.stairIds[0]);
  });

  it('mover pela transformação do modelo leva os limites e os espelhos juntos', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0]);
    t.setSubmode('concluir');
    const id = stairsOf(ctx.store)[0]!.id;
    ctx.store.exec({ type: 'transform', ids: [id], transform: { kind: 'translate', d: { x: 1, y: 2 } } });
    const r = runOf(stairsOf(ctx.store)[0]!);
    expect(r.boundaryLeft[0]!.a).toEqual({ x: 0.5, y: 2.5 });
    expect(r.risers[0]!.a).toEqual({ x: 1, y: 1 });
  });
});

describe('ferramenta Escada: refresh() atualiza a análise sem zerar o croqui (barra de opções)', () => {
  it('mudar o deslocamento do topo recalcula desired e riserHeight e mantém os limites e espelhos já desenhados', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    risers(t, [0, 1, 2]);
    const before = t.status();
    expect(before.desired).toBe(17);
    expect(before.riserHeight).toBeCloseTo(1, 9); // H = 3 m, dividido pelos 3 espelhos
    ctx.options.stair = { ...ctx.options.stair, topOffset: -1 }; // H = 2 m
    t.refresh();
    const after = t.status();
    expect(after.desired).toBe(12);
    expect(after.riserHeight).toBeCloseTo(2 / 3, 9);
    expect(after.created).toBe(3);
    expect(after.phase).toBe(before.phase);
    expect(t.preview().filter((i) => i.kind === 'line' && i.tone === 'riser')).toHaveLength(3);
    expect(t.preview().some((i) => i.kind === 'line' && i.tone === 'boundary')).toBe(true);
  });

  it('o traçado em curso sobrevive ao refresh: Esc ainda cancela só a cadeia (não descarta a ferramenta)', () => {
    const ctx = setup();
    const t = tool('stair', ctx.env) as StairTool;
    boundaries(t);
    clickAt(t, 2.5, -1);
    ctx.options.stair = { ...ctx.options.stair, topOffset: -1 };
    t.refresh();
    t.cancel();
    expect(ctx.last()).toMatch(/Cadeia cancelada/);
    expect(ctx.done()).toBe(0);
  });
});
