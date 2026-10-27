import { describe, expect, it } from 'vitest';
import { stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { resolveStairs, type ResolvedStair } from '@hestia/engine';
import { makeEnv, P, tool } from './testEnv.ts';
import { STAIR_RUN_SHAPE_LABEL, STAIR_RUN_SHAPES, type StairRunToolOptions } from './stairRunPlan.ts';
import { isSpiralStairType, stairTypeForShape, stairTypesForShape } from './stairRunTypes.ts';
import type { PointerInfo, Tool } from './types.ts';

const DEG = Math.PI / 180;

/** Ambiente da forma caracol: H = 2,80 m (nível 1 com topo 0,20 m abaixo) → 16 espelhos de 0,175 m. Mensagens capturadas. */
function setup(opts: Partial<StairRunToolOptions> = {}, stair: Record<string, unknown> = { topLevelId: 'lv_1', topOffset: -0.2 }) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stairRun = { shape: 'spiral', width: 1.2, turn: 'left', ...opts };
  ctx.options.stair = stair;
  return { ...ctx, msgs, last: () => msgs[msgs.length - 1] ?? '' };
}

/** Ponteiro no ponto de raio r e ângulo deg (graus, a partir do eixo X), em torno da origem. */
const at = (r: number, deg: number): PointerInfo => P(r * Math.cos(deg * DEG), r * Math.sin(deg * DEG));

/** Move o cursor de `from` a `to` (graus) a raio r, em passos de ~10°: o caminho do giro (acumula além de 360°). */
function sweepTo(t: Tool, r: number, from: number, to: number): void {
  const n = Math.max(1, Math.round(Math.abs(to - from) / 10));
  for (let i = 1; i <= n; i++) t.move(at(r, from + ((to - from) * i) / n));
}

/** Centro (0,0), raio externo r e ângulo inicial, e o giro até `sweepDeg` (graus, com sinal) e o 3º clique. */
function drawSpiral(t: Tool, sweepDeg: number, r = 1, start = 0): void {
  t.move(at(0, 0));
  t.click(at(0, 0));
  t.move(at(r, start));
  t.click(at(r, start));
  sweepTo(t, r, start, start + sweepDeg);
  t.click(at(r, start + sweepDeg));
}

const stairsOf = (ctx: { store: { project: Parameters<typeof stairsOnLevel>[0] } }, levelId = 'lv_0'): Stair[] => stairsOnLevel(ctx.store.project, levelId);
const resolved = (ctx: { store: { project: Parameters<typeof resolveStairs>[0] } }): ResolvedStair => resolveStairs(ctx.store.project)[0]!;
const errors = (r: ResolvedStair) => r.issues.filter((i) => i.severity === 'error');
const runOf = (s: Stair): StairRun => s.components[0] as StairRun;

describe('ferramenta Escada: forma caracol (3 cliques)', () => {
  it('a forma caracol existe na barra, com o rótulo "Caracol" e as cinco formas', () => {
    expect(STAIR_RUN_SHAPES).toEqual(['straight', 'lshape', 'ushape', 'winder', 'spiral']);
    expect(STAIR_RUN_SHAPE_LABEL.spiral).toBe('Caracol');
  });

  it('3 cliques com 270°: caracol de 16 espelhos, origem spiral e parâmetros; sem erro de croqui', () => {
    const ctx = setup();
    drawSpiral(tool('stairrun', ctx.env), 270);
    const [s] = stairsOf(ctx);
    expect(s).toBeDefined();
    const run = runOf(s!);
    expect(run.generatedBy).toBe('spiral');
    expect(run.risers).toHaveLength(16);
    expect(run.spiral!.sweep).toBeCloseTo((270 * Math.PI) / 180, 6);
    expect(run.spiral!.rOuter).toBeCloseTo(1, 6);
    expect(run.spiral!.rInner).toBeCloseTo(0.1, 9);
    expect(run.spiral!.startAngle).toBeCloseTo(0, 6);
    expect(run.spiral!.center).toEqual({ x: 0, y: 0 });
    const r = resolved(ctx);
    expect(r.riserCount).toBe(16);
    expect(errors(r)).toEqual([]);
    expect(ctx.last()).toMatch(/^Escada caracol criada: 16 espelhos, varredura 270°\./);
    expect(ctx.last()).toMatch(/Ctrl\+Z desfaz\.$/);
  });

  it('3 cliques com 540°: a varredura passa de 360° (acumulada), sem erro de croqui entre voltas', () => {
    const ctx = setup();
    drawSpiral(tool('stairrun', ctx.env), 540);
    const run = runOf(stairsOf(ctx)[0]!);
    expect(run.spiral!.sweep).toBeCloseTo((540 * Math.PI) / 180, 6);
    expect(run.risers).toHaveLength(16);
    const r = resolved(ctx);
    expect(errors(r)).toEqual([]);
    expect(r.riserCount).toBe(16);
  });

  it('a prévia traz "Varredura: X°" e "N espelhos" no cursor, com o caracol inteiro (degraus incluídos)', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(1, 0));
    t.click(at(1, 0));
    sweepTo(t, 1, 0, 450);
    const items = t.preview();
    expect(items.some((i) => i.kind === 'label' && i.text === 'Varredura: 450° · 16 espelhos')).toBe(true);
    expect(items.some((i) => i.kind === 'line' && i.tone === 'riser')).toBe(true);
    expect(items.some((i) => i.kind === 'polygon' && i.tone === 'tread')).toBe(true);
    expect(stairsOf(ctx)).toHaveLength(0);
  });

  it('o 2º passo mostra o círculo do raio externo e o valor do raio na dica, antes do ângulo final', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(0.6, 30));
    const items = t.preview();
    expect(items.some((i) => i.kind === 'label' && i.text === 'Raio externo 0,60 m')).toBe(true);
    expect(items.filter((i) => i.kind === 'polygon')).toHaveLength(2);
    expect(ctx.last()).toBe('Raio externo 0,60 m: clique para fixar o raio e o ângulo inicial.');
    expect(t.inputPrompt()).toBe('Raio externo (m)');
  });

  it('sentido pelo primeiro movimento: girar no horário dá varredura negativa (anti-horário é o sinal +)', () => {
    const ctx = setup();
    drawSpiral(tool('stairrun', ctx.env), -270);
    const run = runOf(stairsOf(ctx)[0]!);
    expect(run.spiral!.sweep).toBeCloseTo((-270 * Math.PI) / 180, 6);
    expect(run.generatedBy).toBe('spiral');
    expect(errors(resolved(ctx))).toEqual([]);
  });

  it('a opção de sentido horário vale para a varredura digitada', () => {
    const ctx = setup({ spiralSweep: 540, spiralSense: 'cw' });
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(1, 0));
    t.click(at(1, 0));
    expect(stairsOf(ctx)).toHaveLength(1);
    expect(runOf(stairsOf(ctx)[0]!).spiral!.sweep).toBeCloseTo(-3 * Math.PI, 6);
  });

  it('varredura digitada na barra: o 2º clique confirma (o 3º não é preciso)', () => {
    const ctx = setup({ spiralSweep: 270 });
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(1, 90));
    t.click(at(1, 90));
    expect(stairsOf(ctx)).toHaveLength(1);
    const run = runOf(stairsOf(ctx)[0]!);
    expect(run.spiral!.sweep).toBeCloseTo((270 * Math.PI) / 180, 6);
    expect(run.spiral!.startAngle).toBeCloseTo((90 * Math.PI) / 180, 6);
  });

  it('raio externo digitado: o 2º clique só fixa o ângulo, com o raio digitado (não o do cursor)', () => {
    const ctx = setup({ spiralOuter: 1.5 });
    const t = tool('stairrun', ctx.env);
    drawSpiral(t, 270, 0.4);
    const run = runOf(stairsOf(ctx)[0]!);
    expect(run.spiral!.rOuter).toBeCloseTo(1.5, 9);
    expect(run.spiral!.rInner).toBeCloseTo(0.1, 9);
  });

  it('raio interno digitado vale para o caracol criado', () => {
    const ctx = setup({ spiralInner: 0.2 });
    drawSpiral(tool('stairrun', ctx.env), 270);
    expect(runOf(stairsOf(ctx)[0]!).spiral!.rInner).toBeCloseTo(0.2, 9);
  });

  it('interno maior ou igual ao externo é recusado no 2º clique, com a mensagem', () => {
    const ctx = setup({ spiralInner: 0.5 });
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(0.3, 0));
    t.click(at(0.3, 0));
    expect(stairsOf(ctx)).toHaveLength(0);
    expect(ctx.last()).toBe('O raio externo (0,30 m) deve ser maior que o interno (0,50 m).');
  });

  it('varredura abaixo de 30° não cria: o 3º clique diz o que falta; ao girar mais, cria', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(1, 0));
    t.click(at(1, 0));
    sweepTo(t, 1, 0, 20);
    t.click(at(1, 20));
    expect(stairsOf(ctx)).toHaveLength(0);
    expect(ctx.last()).toMatch(/^A varredura mínima do caracol é de 30°\.$/);
    sweepTo(t, 1, 20, 40);
    t.click(at(1, 40));
    expect(stairsOf(ctx)).toHaveLength(1);
  });

  it('Enter confirma a varredura atual, sem o 3º clique', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(1, 0));
    t.click(at(1, 0));
    sweepTo(t, 1, 0, 180);
    t.confirm();
    expect(stairsOf(ctx)).toHaveLength(1);
    expect(runOf(stairsOf(ctx)[0]!).spiral!.sweep).toBeCloseTo(Math.PI, 6);
  });

  it('Esc cancela o passo em curso; o 2º Esc sai da ferramenta, sem criar nada', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(1, 0));
    t.click(at(1, 0));
    sweepTo(t, 1, 0, 100);
    t.cancel();
    expect(ctx.done()).toBe(0);
    expect(stairsOf(ctx)).toHaveLength(0);
    expect(t.inputPrompt()).toBeNull();
    t.cancel();
    expect(ctx.done()).toBe(1);
  });

  it('Backspace volta um passo: da varredura ao raio, do raio ao centro e depois sai do passo', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    t.move(at(1, 0));
    t.click(at(1, 0));
    expect(t.inputPrompt()).toBe('Varredura (°)');
    expect(t.deleteKey?.()).toBe(true);
    expect(t.inputPrompt()).toBe('Raio externo (m)');
    expect(t.deleteKey?.()).toBe(true);
    expect(t.inputPrompt()).toBeNull();
    expect(t.deleteKey?.()).toBe(false);
    expect(stairsOf(ctx)).toHaveLength(0);
  });

  it('desfazer leva o caracol inteiro em um só passo', () => {
    const ctx = setup();
    drawSpiral(tool('stairrun', ctx.env), 540);
    expect(stairsOf(ctx)).toHaveLength(1);
    ctx.store.undo();
    expect(stairsOf(ctx)).toHaveLength(0);
  });

  it('entrada numérica: raio externo digitado no 2º passo, depois varredura digitada (graus) cria', () => {
    const ctx = setup();
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    expect(t.type('0,8')).toBe(true);
    expect(t.inputPrompt()).toBe('Varredura (°)');
    expect(t.type('270')).toBe(true);
    expect(stairsOf(ctx)).toHaveLength(1);
    expect(runOf(stairsOf(ctx)[0]!).spiral!.rOuter).toBeCloseTo(0.8, 9);
  });

  it('o tipo da criação é o de caracol (o tipo padrão do projeto sai da lista da forma)', () => {
    const ctx = setup();
    drawSpiral(tool('stairrun', ctx.env), 270);
    const [s] = stairsOf(ctx);
    expect(s!.typeId.startsWith('stt_caracol')).toBe(true);
  });

  it('a escada reta continua com o tipo comum, mesmo que o tipo guardado seja de caracol', () => {
    const ctx = setup({ shape: 'straight', typeId: 'stt_caracol_poste' });
    const t = tool('stairrun', ctx.env);
    t.move(at(0, 0));
    t.click(at(0, 0));
    // Reta: o 2º clique é o fim do lance (4,2 m dão 16 espelhos de 28 cm de piso; 1 m seria lance curto demais).
    t.move(at(4.2, 90));
    t.click(at(4.2, 90));
    expect(stairsOf(ctx)[0]!.typeId).toBe('stt_monolitica');
  });

  it('a 1ª criação do caracol com H menor que dois espelhos recusa, sem escada', () => {
    const ctx = setup({}, { topLevelId: 'lv_1', topOffset: -2.9 });
    drawSpiral(tool('stairrun', ctx.env), 270);
    expect(stairsOf(ctx)).toHaveLength(0);
    expect(ctx.last()).toBe('A altura é menor que um espelho: nada a gerar.');
  });
});

describe('tipos compatíveis com a forma (stairRunTypes)', () => {
  it('o caracol lista só os tipos caracol; as demais formas, os outros', () => {
    const ctx = setup();
    const p = ctx.store.project;
    expect(stairTypesForShape(p, 'spiral').map((t) => t.id)).toEqual(['stt_caracol_monolitica', 'stt_caracol_poste']);
    expect(stairTypesForShape(p, 'straight').map((t) => t.id)).toEqual(['stt_monolitica', 'stt_piso_espelho']);
    expect(stairTypeForShape(p, 'spiral', 'stt_monolitica')).toBe('stt_caracol_monolitica');
    expect(stairTypeForShape(p, 'winder', 'stt_caracol_poste')).toBe('stt_monolitica');
    expect(stairTypeForShape(p, 'straight', 'stt_piso_espelho')).toBe('stt_piso_espelho');
  });

  it('um tipo caracol copiado (nome com "cópia") continua caracol', () => {
    expect(isSpiralStairType({ id: 'stt_x', name: 'Escada caracol monolítica (cópia)', runStyle: 'monolithic' })).toBe(true);
    expect(isSpiralStairType({ id: 'stt_y', name: 'Escada de piso', runStyle: 'post' })).toBe(true);
    expect(isSpiralStairType({ id: 'stt_monolitica', name: 'Escada monolítica concreto', runStyle: 'monolithic' })).toBe(false);
  });
});
