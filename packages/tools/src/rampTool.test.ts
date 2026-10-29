import { describe, expect, it } from 'vitest';
import { rampsOnLevel, type Ramp } from '@hestia/model';
import { rampIssueList, resolveRamps, type ResolvedRamp } from '@hestia/engine';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import { createTool } from './registry.ts';
import { RampTool } from './rampTool.ts';
import type { RampToolOptions } from './rampOptions.ts';
import type { Tool } from './types.ts';

/** Ambiente com mensagens capturadas e nível ativo configurável (padrão lv_0, com lv_1 a 3,00 m acima). */
function setup(opts: Partial<RampToolOptions> = {}, levelId = 'lv_0') {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.ramp = { shape: 'straight', turn: 'left', mode: 'length', ...opts };
  ctx.env.levelId = () => levelId;
  return { ...ctx, msgs, last: () => msgs[msgs.length - 1] ?? '' };
}

/** Clique no ponto inicial e no ponto que define a direção (e o comprimento). */
const draw = (t: Tool, from: [number, number], to: [number, number]): void => {
  clickAt(t, from[0], from[1]);
  clickAt(t, to[0], to[1]);
};

const rampsOf = (ctx: { store: { project: Parameters<typeof rampsOnLevel>[0] } }, levelId = 'lv_0'): Ramp[] => rampsOnLevel(ctx.store.project, levelId);
const resolved = (ctx: { store: { project: Parameters<typeof resolveRamps>[0] } }): ResolvedRamp => resolveRamps(ctx.store.project)[0]!;

describe('ferramenta Rampa', () => {
  it('createTool devolve a ferramenta com id ramp', () => {
    const { env } = makeEnv();
    const t = createTool('ramp', env);
    expect(t).toBeInstanceOf(RampTool);
    expect(t.id).toBe('ramp');
    expect(t.label).toBe('Rampa');
  });

  it('start avisa como começar', () => {
    const ctx = setup();
    tool('ramp', ctx.env);
    expect(ctx.last()).toBe('Rampa: clique no centro da borda de início. Esc cancela.');
  });

  it('modo comprimento: H = 3,00 e clique a 40,00 m cria 4 lances de 9,10 m e patamares de 1,20 m', () => {
    const ctx = setup({ mode: 'length' });
    draw(tool('ramp', ctx.env), [0, 0], [40, 0]);
    const [ramp] = rampsOf(ctx);
    expect(ramp).toBeDefined();
    expect(ramp!.components.filter((c) => c.kind === 'run')).toHaveLength(4);
    expect(ramp!.components.filter((c) => c.kind === 'landing')).toHaveLength(3);
    expect(ramp!.inputMode).toBe('length');
    expect(ramp!.slopeTarget).toBeNull();
    const r = resolved(ctx);
    expect(r.flights).toHaveLength(4);
    for (const f of r.flights) expect(f.length).toBeCloseTo(9.1, 6);
    expect(r.landings).toHaveLength(3);
    for (const l of r.landings) expect(l.minDim).toBeCloseTo(1.2, 6);
    expect(r.slope).toBeCloseTo(3 / 36.4, 6);
    expect(ctx.last()).toMatch(/^Rampa criada: 4 lances, inclinação 8,24 % \(1:12,1\), 40,00 m\./);
    expect(ctx.last()).toMatch(/Ctrl\+Z desfaz\.$/);
  });

  it('modo inclinação: H = 0,80 e clique a 12,00 m gera 1 lance de 9,60 m e avisa que termina antes', () => {
    const ctx = setup({ mode: 'slope', slope: 1 / 12, height: 0.8 }, 'lv_1');
    draw(tool('ramp', ctx.env), [0, 0], [12, 0]);
    const r = resolved(ctx);
    expect(r.flights).toHaveLength(1);
    expect(r.flights[0]!.length).toBeCloseTo(9.6, 6);
    expect(rampsOf(ctx, 'lv_1')[0]!.inputMode).toBe('slope');
    expect(rampsOf(ctx, 'lv_1')[0]!.slopeTarget).toBeCloseTo(1 / 12, 9);
    expect(ctx.last()).toContain('A inclinação de 8,33 % pede 9,60 m: a rampa termina antes do clique de 12,00 m.');
  });

  it('modo inclinação: clique a 5,00 m avisa que a rampa passa do clique', () => {
    const ctx = setup({ mode: 'slope', slope: 1 / 12, height: 0.8 }, 'lv_1');
    draw(tool('ramp', ctx.env), [0, 0], [5, 0]);
    expect(ctx.last()).toContain('A inclinação de 8,33 % pede 9,60 m: a rampa passa do clique de 5,00 m.');
  });

  it('digitar 90° após o 1º clique cria a rampa na direção +Y e avisa que usou a inclinação', () => {
    const ctx = setup();
    const t = tool('ramp', ctx.env);
    clickAt(t, 0, 0);
    expect(t.inputPrompt()).toBe('Ângulo (°)');
    expect(t.type('90')).toBe(true);
    const r = resolved(ctx);
    const f = r.flights[0]!;
    expect(f.end.x - f.start.x).toBeCloseTo(0, 6);
    expect(f.end.y - f.start.y).toBeGreaterThan(0);
    expect(ctx.last()).toContain('Sem clique de comprimento');
  });

  it('clique a menos de 0,01 m do início não cria e pede para afastar o cursor', () => {
    const ctx = setup();
    draw(tool('ramp', ctx.env), [0, 0], [0.005, 0]);
    expect(rampsOf(ctx)).toHaveLength(0);
    expect(ctx.last()).toBe('Afaste o cursor do ponto inicial para dar a direção.');
  });

  it('modo comprimento com H = 0,80 e clique a 8,00 m gera aviso de norma na mensagem final', () => {
    const ctx = setup({ mode: 'length', height: 0.8 }, 'lv_1');
    draw(tool('ramp', ctx.env), [0, 0], [8, 0]);
    expect(resolved(ctx).flights).toHaveLength(1);
    expect(rampIssueList(ctx.store.project).map((i) => i.code)).toContain('ramp-slope-over-norm');
    expect(ctx.last()).toMatch(/Aviso: /);
  });

  it('Esc após o 1º clique cancela sem criar; o 2º Esc sai da ferramenta', () => {
    const ctx = setup();
    const t = tool('ramp', ctx.env);
    clickAt(t, 0, 0);
    t.cancel();
    expect(rampsOf(ctx)).toHaveLength(0);
    expect(ctx.done()).toBe(0);
    t.cancel();
    expect(ctx.done()).toBe(1);
  });

  it('uma criação é um passo de desfazer e remove a rampa inteira', () => {
    const ctx = setup({ mode: 'length' });
    draw(tool('ramp', ctx.env), [0, 0], [40, 0]);
    expect(rampsOf(ctx)).toHaveLength(1);
    ctx.store.undo();
    expect(rampsOf(ctx)).toHaveLength(0);
  });

  it('a prévia mostra o piso do lance e o rótulo da inclinação durante o movimento', () => {
    const ctx = setup({ mode: 'length' });
    const t = tool('ramp', ctx.env);
    t.move(P(1, 1));
    expect(t.preview()).toEqual([{ kind: 'point', at: { x: 1, y: 1 } }]);
    clickAt(t, 0, 0);
    t.move(P(40, 0));
    const items = t.preview();
    expect(items.some((i) => i.kind === 'polygon' && i.tone === 'tread')).toBe(true);
    expect(items.some((i) => i.kind === 'label' && /8,24 % \(1:12,1\).*4 lances/.test(i.text))).toBe(true);
    expect(rampsOf(ctx)).toHaveLength(0);
  });

  it('sem nível acima e sem altura positiva, recusa com a mensagem da barra', () => {
    const ctx = setup({ mode: 'length', height: 0 }, 'lv_1');
    draw(tool('ramp', ctx.env), [0, 0], [10, 0]);
    expect(rampsOf(ctx, 'lv_1')).toHaveLength(0);
    expect(ctx.last()).toBe('Sem nível de topo: escolha o nível de cima na barra de colocação (ou informe uma altura positiva).');
  });

  it('nível de topo abaixo da base recusa sem gerar', () => {
    const ctx = setup({ mode: 'length', topLevelId: 'lv_0' }, 'lv_1');
    draw(tool('ramp', ctx.env), [0, 0], [10, 0]);
    expect(rampsOf(ctx, 'lv_1')).toHaveLength(0);
    expect(ctx.last()).toBe('O nível de topo não fica acima da base: nada a gerar.');
  });
});
