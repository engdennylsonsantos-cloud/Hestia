import { describe, expect, it } from 'vitest';
import { levelTexts } from '@hestia/model';
import { annotationAt } from './annotationPick.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Texto 'Quarto' colocado em (9, 2) m, com a planta na escala padrão; o cursor mede 0,01 m por pixel. */
const MPP = 0.01;
const criaTexto = () => {
  const ctx = makeEnv();
  const t = tool('text', ctx.env);
  clickAt(t, 9, 2);
  t.type('Quarto');
  const id = levelTexts(ctx.store.project, 'lv_0')[0]!.id;
  return { ctx, id };
};

describe('seleção de texto: o retângulo do texto, não só a âncora (D1)', () => {
  it('clicar exatamente na âncora seleciona o texto', () => {
    const { ctx, id } = criaTexto();
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 9, y: 2 }, MPP)).toEqual({ id, kind: 'text' });
  });

  it('clicar dentro do retângulo do texto, fora da âncora, seleciona', () => {
    const { ctx, id } = criaTexto();
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 9.2, y: 2.1 }, MPP)).toEqual({ id, kind: 'text' });
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 8.7, y: 1.9 }, MPP)).toEqual({ id, kind: 'text' });
  });

  it('a tolerância de pixels vale na borda do retângulo', () => {
    const { ctx, id } = criaTexto();
    // Meia largura do texto (6 caracteres) fica perto de 0,45 m; a tolerância (6 px = 0,06 m) cobre 0,5 m.
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 9.5, y: 2 }, MPP)).toEqual({ id, kind: 'text' });
  });

  it('fora do retângulo e da tolerância não seleciona', () => {
    const { ctx } = criaTexto();
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 10.5, y: 2 }, MPP)).toBeNull();
    expect(annotationAt(ctx.store.project, 'lv_0', { x: 9.4, y: 2.3 }, MPP)).toBeNull();
  });
});
