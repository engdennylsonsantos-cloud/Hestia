import { describe, expect, it } from 'vitest';
import { TOOL_LABEL } from '@hestia/tools';
import { createEmptyProject, type Project } from '@hestia/model';
import { ACTIONS, type RibbonCtx } from './actions.ts';
import { contextTab, perimeterTab } from './context.ts';
import { txt, type RibbonItem, type RibbonPanel } from './model.ts';
import { TABS, TAB_ORDER } from './tabs.ts';

const leaves = (items: RibbonItem[]): RibbonItem[] =>
  items.flatMap((it) => (it.kind === 'stack' ? leaves(it.items) : it.kind === 'split' ? [it.main, ...leaves(it.menu)] : [it]));
const allPanels = (): RibbonPanel[] => TABS.flatMap((tb) => tb.panels);

describe('faixa guiada por dados', () => {
  it('abas na ordem do Revit 2024, Modificar por último', () => {
    expect(TAB_ORDER).toEqual(['arquitetura', 'estrutura', 'aco', 'premoldado', 'sistemas', 'inserir', 'anotar', 'analisar', 'massa', 'colaborar', 'vista', 'gerenciar', 'suplementos', 'modificar']);
    expect(TABS.map((tb) => txt(tb.label, 'pt'))).toEqual(['Arquitetura', 'Estrutura', 'Aço', 'Pré-moldado', 'Sistemas', 'Inserir', 'Anotar', 'Analisar', 'Massa e terreno', 'Colaborar', 'Vista', 'Gerenciar', 'Suplementos', 'Modificar']);
  });

  it('toda ferramenta e ação citada existe', () => {
    for (const it of leaves(allPanels().flatMap((p) => p.items))) {
      if (it.kind === 'tool') expect(TOOL_LABEL[it.tool], it.tool).toBeTruthy();
      if (it.kind === 'action') expect(ACTIONS[it.action], it.action).toBeDefined();
    }
  });

  it('pilha tem no máximo 3 botões pequenos e só folhas', () => {
    for (const p of allPanels()) {
      for (const it of p.items) {
        if (it.kind !== 'stack') continue;
        expect(it.items.length, p.id).toBeLessThanOrEqual(3);
        for (const s of it.items) expect(['tool', 'action', 'soon', 'option']).toContain(s.kind);
      }
    }
  });

  it('ids de painel são únicos dentro de cada aba', () => {
    for (const tb of TABS) {
      const ids = tb.panels.map((p) => p.id);
      expect(new Set(ids).size, tb.id).toBe(ids.length);
    }
  });

  it('toda ferramenta do registro aparece na faixa (nenhuma ficou sem acesso)', () => {
    const naFaixa = new Set(leaves(allPanels().flatMap((p) => p.items)).flatMap((it) => (it.kind === 'tool' ? [it.tool] : [])));
    const ctx = ['wall', 'roofarrow', 'slope', 'attachroof', 'detachroof', 'rehost', 'roomsep'] as const;
    // Pendente: o modo de perímetro ainda não tem botão de criação na faixa (abre por `perimeterActions.begin`).
    const pendente = ['perimeter'] as const;
    for (const id of Object.keys(TOOL_LABEL)) {
      if ((ctx as readonly string[]).includes(id) || (pendente as readonly string[]).includes(id)) continue;
      expect(naFaixa.has(id as never), id).toBe(true);
    }
  });
});

describe('aba contextual', () => {
  const p = createEmptyProject('vazio');
  it('ferramenta de criação abre "Modificar | Colocar X"', () => {
    const c = contextTab('wall', [], p);
    expect(c?.key).toBe('tool:wall');
    expect(txt(c!.tab.label, 'pt')).toBe('Modificar | Colocar Parede');
    expect(txt(c!.tab.label, 'en')).toBe('Modify | Place Wall');
    expect(c!.tab.panels.map((x) => x.id)).toContain('desenhar');
  });
  it('ferramenta de edição e nada selecionado não abrem aba', () => {
    expect(contextTab('move', [], p)).toBeNull();
    expect(contextTab('select', [], p)).toBeNull();
  });
});

describe('disposição dos painéis na faixa', () => {
  const comLados = (sides: RibbonCtx['sides']): RibbonCtx => ({ sides } as RibbonCtx);

  it('ações de lado e de restaurar estão no menu Interface do usuário', () => {
    const acoes = leaves(allPanels().flatMap((pn) => pn.items)).flatMap((it) => (it.kind === 'action' ? [it.action] : []));
    expect(acoes).toEqual(expect.arrayContaining(['propsSide', 'browserSide', 'resetDock']));
  });

  it('"pressionado" só quando o painel está à direita', () => {
    const sides = { props: 'right' as const, browser: 'left' as const };
    expect(ACTIONS.propsSide.pressed?.(comLados(sides))).toBe(true);
    expect(ACTIONS.browserSide.pressed?.(comLados(sides))).toBe(false);
  });
});

describe('perímetro na faixa', () => {
  const p = createEmptyProject('vazio');
  const comRoof = { ...p, elements: { r1: { id: 'r1', kind: 'roof' } } } as unknown as Project;
  it('modo de criar: "Modificar | Criar perímetro do telhado" com o slot do perímetro no fim', () => {
    const tab = perimeterTab('roof');
    expect(tab.key).toBe('perimeter:roof');
    expect(txt(tab.label, 'pt')).toBe('Modificar | Criar perímetro do telhado');
    expect(tab.slots.map((s) => (s.kind === 'panel' ? s.panel.id : s.kind))).toEqual(['selecionar', 'propriedades', 'modificar', 'medir', 'perimetro']);
  });
  it('modo de editar: título "Editar perímetro do …" e chave própria do elemento', () => {
    const tab = perimeterTab('floor', 'f1');
    expect(tab.key).toBe('perimeter:floor:f1');
    expect(txt(tab.label, 'pt')).toBe('Modificar | Editar perímetro do piso');
    expect(txt(tab.label, 'en')).toBe('Modify | Edit Floor Perimeter');
  });
  it('telhado, piso, laje e forro selecionados ganham o painel "Editar perímetro"', () => {
    const c = contextTab('select', ['r1'], comRoof);
    expect(c?.tab.panels.flatMap((x) => x.items.map((it) => (it.kind === 'action' ? it.action : '')))).toContain('editPerimeter');
  });
  it('"Editar perímetro" fica desabilitado sem elemento editável, com o motivo', () => {
    expect(ACTIONS.editPerimeter.disabled?.({ p, selection: [] } as unknown as RibbonCtx)).toBeTruthy();
    expect(ACTIONS.editPerimeter.disabled?.({ p: comRoof, selection: ['r1'] } as unknown as RibbonCtx)).toBe(false);
  });
});
