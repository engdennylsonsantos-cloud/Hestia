import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@hestia/model';
import { SEM_ESBOCO, SEM_ESBOCO_AINDA } from '../../editor/perimeterComandos.ts';
import { ACTIONS, type RibbonCtx } from './actions.ts';
import { estadoNoEsboco } from './perimeterFace.ts';
import { act, soonS, stack, tool, type RibbonItem } from './model.ts';
import { P_MODIFY } from './panelsShared.ts';

/** Contexto da faixa com o modo aberto (ou fechado, com `perimetro: null`). */
const ctxCom = (modify: 'move' | 'trim' | 'delete' | null | undefined, selection: string[] = []): RibbonCtx =>
  ({ tool: 'perimeter', selection, perimetro: modify === undefined ? null : { modify }, p: createEmptyProject('vazio') }) as unknown as RibbonCtx;

const folhas = (items: RibbonItem[]): RibbonItem[] => items.flatMap((it) => (it.kind === 'stack' ? folhas(it.items) : [it]));

describe('faixa com o modo de perímetro aberto', () => {
  it('comando de Modificar fica pressionado só quando é o comando ligado', () => {
    expect(estadoNoEsboco(tool('move'), ctxCom('move'))).toEqual({ on: true, disabled: false });
    expect(estadoNoEsboco(tool('move'), ctxCom('trim'))).toEqual({ on: false, disabled: false });
    expect(estadoNoEsboco(tool('move'), ctxCom(null))).toEqual({ on: false, disabled: false });
  });

  it('Excluir é o comando "delete" do esboço e não precisa de seleção', () => {
    expect(estadoNoEsboco(act('delete', 'small'), ctxCom('delete'))).toEqual({ on: true, disabled: false });
    expect(ACTIONS.delete.disabled?.(ctxCom(null))).toBe(false);
    expect(ACTIONS.delete.disabled?.(ctxCom(undefined))).toBeTruthy();
  });

  it('Parede paralela e Trocar hospedeiro ficam desabilitados, com o motivo', () => {
    expect(estadoNoEsboco(tool('parallel', 'small'), ctxCom(null))).toEqual({ on: false, disabled: true, motivo: SEM_ESBOCO.parallel });
    expect(estadoNoEsboco(tool('rehost', 'small'), ctxCom(null))).toEqual({ on: false, disabled: true, motivo: SEM_ESBOCO.rehost });
  });

  it('Escala, Fixar e Desafixar (ainda não existem) ficam desabilitados, com o motivo', () => {
    expect(estadoNoEsboco(soonS('Escala'), ctxCom(null))).toEqual({ on: false, disabled: true, motivo: SEM_ESBOCO_AINDA });
  });

  it('todo botão do painel Modificar tem regra no esboço (nenhum fica com o estado normal)', () => {
    const leaves = folhas(P_MODIFY.items);
    expect(leaves.length).toBeGreaterThanOrEqual(15);
    for (const it of leaves) expect(estadoNoEsboco(it, ctxCom(null)), JSON.stringify(it)).not.toBeNull();
  });

  it('fora do modo, nenhum item recebe regra do esboço', () => {
    for (const it of folhas(P_MODIFY.items)) expect(estadoNoEsboco(it, ctxCom(undefined)), JSON.stringify(it)).toBeNull();
    expect(estadoNoEsboco(tool('wall'), ctxCom('move'))).toBeNull();
  });

  it('o painel Modificar dentro do modo traz os comandos em pilhas, como no app', () => {
    const pilhas = P_MODIFY.items.filter((it) => it.kind === 'stack');
    expect(pilhas.length).toBe(5);
    expect(pilhas.every((it) => it.kind === 'stack' && it.items.length <= 3)).toBe(true);
    expect(stack(tool('move')).kind).toBe('stack');
  });
});
