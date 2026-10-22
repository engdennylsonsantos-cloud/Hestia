import { describe, expect, it } from 'vitest';
import { dimensionValue, levelDimensions, levelTexts, type Project } from '@hestia/model';
import { annotationAt } from './annotationPick.ts';
import { clickAt, drawWall, makeEnv, P, tool } from './testEnv.ts';

const dims = (s: { project: Project }) => levelDimensions(s.project, 'lv_0');

describe('ferramenta Cota', () => {
  it('sequência de cliques cria a cota: A, B e o lado da linha de cota', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 2, 1);
    expect(dims(ctx.store)).toHaveLength(1);
    const d = dims(ctx.store)[0]!;
    expect(dimensionValue(ctx.store.project, d)).toBe(4);
    expect(d.offset).toBeCloseTo(1, 9);
    expect(t.inputPrompt()).toBeNull();
  });

  it('digitar o deslocamento confirma no lado do cursor', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    t.move(P(2, -3));
    expect(t.inputPrompt()).toBe('Deslocamento');
    expect(t.type('0,8')).toBe(true);
    expect(dims(ctx.store)[0]!.offset).toBeCloseTo(-0.8, 9);
  });

  it('recusa deslocamento inválido e segue esperando', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    expect(t.type('-1')).toBe(false);
    expect(dims(ctx.store)).toHaveLength(0);
  });

  it('dois pontos iguais não criam cota', () => {
    const ctx = makeEnv();
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    const t = tool('dimension', ctx.env);
    clickAt(t, 1, 1);
    clickAt(t, 1, 1);
    expect(dims(ctx.store)).toHaveLength(0);
    expect(msgs.some((m) => m.includes('mesmo'))).toBe(true);
  });

  it('ponto sobre a extremidade de parede cria referência: a cota acompanha a parede', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 2, 1);
    const d = dims(ctx.store)[0]!;
    expect(d.refs?.a).toEqual({ wallId: expect.any(String), end: 'a' });
    expect(d.refs?.b).toEqual({ wallId: expect.any(String), end: 'b' });
  });

  it('ponto livre não guarda referência', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0.5, 0.5);
    clickAt(t, 3.5, 0.5);
    clickAt(t, 2, 1.5);
    expect(dims(ctx.store)[0]!.refs).toBeUndefined();
  });

  it('Esc no meio do passo cancela sem criar nada', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    t.cancel();
    expect(dims(ctx.store)).toHaveLength(0);
    expect(ctx.done()).toBe(0);
    t.cancel();
    expect(ctx.done()).toBe(1);
  });
});

describe('ferramenta Texto', () => {
  it('clique no ponto, digite e Enter: cria o texto nesse ponto', () => {
    const ctx = makeEnv();
    const t = tool('text', ctx.env);
    expect(t.inputPrompt()).toBeNull();
    clickAt(t, 1, 2);
    expect(t.inputPrompt()).toBe('Texto');
    expect(t.type('  Sala de estar ')).toBe(true);
    const notes = levelTexts(ctx.store.project, 'lv_0');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ text: 'Sala de estar', at: { x: 1, y: 2 }, rotation: 0, height: 2.5 });
  });

  it('texto vazio ou sem ponto não cria nada', () => {
    const ctx = makeEnv();
    const t = tool('text', ctx.env);
    expect(t.type('Olá')).toBe(false);
    clickAt(t, 1, 2);
    expect(t.type('   ')).toBe(false);
    expect(levelTexts(ctx.store.project, 'lv_0')).toHaveLength(0);
  });

  it('aceita letras no campo (freeText)', () => {
    expect(tool('text', makeEnv().env).freeText).toBe(true);
    expect(tool('dimension', makeEnv().env).freeText).toBeFalsy();
  });
});

describe('seleção de anotações', () => {
  it('a linha de cota e o texto são achados pelo cursor; longe deles, nada', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 2, 1);
    const d = dims(ctx.store)[0]!;
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 2, y: 1 }, 0.01)).toEqual({ id: d.id, kind: 'dimension' });
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 2, y: 5 }, 0.01)).toBeNull();
  });

  it('o seletor escolhe a cota e a seleção aparece', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 2, 1);
    const sel = tool('select', ctx.env);
    sel.move(P(2, 1));
    sel.down!(P(2, 1));
    sel.up!(P(2, 1));
    expect(ctx.sel()).toEqual([dims(ctx.store)[0]!.id]);
  });

  it('texto escrito é achado pelo cursor no centro', () => {
    const ctx = makeEnv();
    const t = tool('text', ctx.env);
    clickAt(t, 1, 2);
    t.type('Sala');
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 1.001, y: 2 }, 0.01)).toEqual({ id: levelTexts(ctx.store.project, 'lv_0')[0]!.id, kind: 'text' });
  });
});

describe('alça de deslocamento da cota', () => {
  it('arrastar a alça do ponto médio muda o deslocamento para o lado do cursor', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 2, 1);
    const id = dims(ctx.store)[0]!.id;
    const sel = tool('select', ctx.env);
    sel.move(P(2, 1));
    sel.down!(P(2, 1));
    sel.up!(P(2, 1));
    expect(ctx.sel()).toEqual([id]);
    // A alça fica no ponto médio da linha de cota (2, 1): arrastar até (2, −1,5) põe a linha do outro lado.
    sel.move(P(2, 1));
    sel.down!(P(2, 1));
    sel.drag!(P(2, -1.5));
    sel.up!(P(2, -1.5));
    expect(dims(ctx.store)[0]!.offset).toBeCloseTo(-1.5, 9);
  });
});

describe('mover e copiar anotações pelas ferramentas de edição', () => {
  it('Mover desloca a cota e o texto selecionados; Copiar cria cópias com ids novos', () => {
    const ctx = makeEnv();
    const t = tool('dimension', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 2, 1);
    const tx = tool('text', ctx.env);
    clickAt(tx, 1, 2);
    tx.type('Sala');
    const dimId = dims(ctx.store)[0]!.id;
    const txtId = levelTexts(ctx.store.project, 'lv_0')[0]!.id;
    ctx.env.setSelection([dimId, txtId]);
    const mv = tool('move', ctx.env);
    clickAt(mv, 0, 0);
    clickAt(mv, 1, 0);
    const moved = dims(ctx.store)[0]!;
    expect(moved.a).toEqual({ x: 1, y: 0 });
    expect(moved.b).toEqual({ x: 5, y: 0 });
    expect(levelTexts(ctx.store.project, 'lv_0')[0]!.at).toEqual({ x: 2, y: 2 });
    ctx.env.setSelection([dimId, txtId]);
    const cp = tool('copy', ctx.env);
    clickAt(cp, 0, 0);
    clickAt(cp, 0, 3);
    cp.cancel();
    expect(dims(ctx.store)).toHaveLength(2);
    expect(levelTexts(ctx.store.project, 'lv_0')).toHaveLength(2);
  });
});
