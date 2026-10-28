import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, compositionCells, compositionOfType, compositionSpan, openingCompositionOf, type OpeningType } from '@hestia/model';
import { aplicaAcao, defineLuz, defineConteudo, issueDe, podeRemover, removeModulo, tamanhoDaCelula } from './compositionControls.ts';

/** Porta de 90 com referência nominal na folha (folha 0,90 × 2,10; vão 0,98 × 2,15), como nos exemplos da spec §1. */
const porta = (): OpeningType => DEFAULT_OPENING_TYPES.find((x) => x.kind === 'door' && x.nominalRef === 'leaf' && x.width === 0.9 && x.height === 2.1 && x.leaves === 1)!;
/** Janela com vão nominal (1,60 × 1,20), sem bandeira nem laterais. */
const janela = (): OpeningType => ({ ...porta(), kind: 'window', width: 1.6, height: 1.2, nominalRef: 'opening', transom: undefined, sidelights: undefined, composition: undefined });

const vao = (t: OpeningType) => compositionSpan(openingCompositionOf(t));
const idDoVidro = (t: OpeningType): string => compositionCells(openingCompositionOf(t)).find((x) => x.content.kind === 'glass')!.id;

describe('ações rápidas (spec §1, exemplos 2 a 4)', () => {
  it('bandeira superior: porta 90 vira 0,98 × 2,60', () => {
    const v = vao(aplicaAcao(porta(), 'bandeira'));
    expect(v.width).toBeCloseTo(0.98, 9);
    expect(v.height).toBeCloseTo(2.6, 9);
  });

  it('laterais esquerda e direita: porta 90 vira 1,88 × 2,15', () => {
    const v = vao(aplicaAcao(aplicaAcao(porta(), 'esquerda'), 'direita'));
    expect(v.width).toBeCloseTo(1.88, 9);
    expect(v.height).toBeCloseTo(2.15, 9);
  });

  it('laterais e bandeira: porta 90 vira 1,88 × 2,60 e tem 4 células', () => {
    const t = aplicaAcao(aplicaAcao(aplicaAcao(porta(), 'esquerda'), 'direita'), 'bandeira');
    const v = vao(t);
    expect(v.width).toBeCloseTo(1.88, 9);
    expect(v.height).toBeCloseTo(2.6, 9);
    expect(compositionCells(openingCompositionOf(t))).toHaveLength(4);
    expect(issueDe(t)).toBeNull();
  });

  it('painel fixo lateral cria célula de painel cego de 0,40', () => {
    const t = aplicaAcao(porta(), 'painel');
    const painel = compositionCells(openingCompositionOf(t)).find((x) => x.content.kind === 'panel');
    expect(painel).toBeDefined();
    expect(tamanhoDaCelula(openingCompositionOf(t), painel!.id)).toEqual({ mode: 'fixed', value: 0.4 });
    expect(vao(t).width).toBeCloseTo(1.43, 9);
  });

  it('janela: dividir em duas colunas mantém o vão total e a célula principal vira fill', () => {
    const t = aplicaAcao(janela(), 'duasColunas');
    const c = openingCompositionOf(t);
    expect(vao(t)).toEqual({ width: 1.6, height: 1.2 });
    expect(compositionCells(c)).toHaveLength(2);
    const principal = compositionCells(c).find((x) => x.content.kind === 'leaf')!;
    expect(tamanhoDaCelula(c, principal.id)).toEqual({ mode: 'fill' });
  });

  it('janela: empilhar bandeira mantém o vão total', () => {
    const v = vao(aplicaAcao(janela(), 'bandeira'));
    expect(v).toEqual({ width: 1.6, height: 1.2 });
  });
});

describe('remover módulo', () => {
  it('remover a única lateral volta à composição de uma célula', () => {
    const t = aplicaAcao(porta(), 'esquerda');
    const lateral = idDoVidro(t);
    expect(removeModulo(t, lateral).composition).toEqual(compositionOfType(porta()));
  });

  it('a célula nominal não pode ser removida', () => {
    const t = aplicaAcao(porta(), 'esquerda');
    const c = openingCompositionOf(t);
    const folha = compositionCells(c).find((x) => x.content.kind === 'leaf')!.id;
    expect(podeRemover(c, folha)).toBe(false);
    expect(removeModulo(t, folha)).toBe(t);
  });
});

describe('edição de célula e validação', () => {
  it('dois fill na mesma divisão geram erro de validação', () => {
    const t = aplicaAcao(porta(), 'esquerda');
    const bloqueado = defineLuz(t, idDoVidro(t), { mode: 'fill' });
    expect(issueDe(bloqueado)).not.toBeNull();
  });

  it('luz negativa gera erro de validação', () => {
    const t = aplicaAcao(porta(), 'esquerda');
    expect(issueDe(defineLuz(t, idDoVidro(t), { mode: 'fixed', value: -0.1 }))).not.toBeNull();
  });

  it('troca de conteúdo para painel mantém a luz da célula', () => {
    const t = aplicaAcao(porta(), 'esquerda');
    const id = idDoVidro(t);
    const novo = defineConteudo(t, id, { kind: 'panel', thickness: 0.03 });
    expect(compositionCells(openingCompositionOf(novo)).find((x) => x.id === id)?.content.kind).toBe('panel');
    expect(tamanhoDaCelula(openingCompositionOf(novo), id)).toEqual({ mode: 'fixed', value: 0.4 });
  });
});
