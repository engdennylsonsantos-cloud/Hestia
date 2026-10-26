import { create } from 'zustand';
import type { Id } from '@hestia/model';
import type { ToolId } from '@hestia/tools';
import { editor } from './controller.ts';
import { useUi } from './state.ts';

/** Quantos comandos recentes o menu mostra (o Revit mostra até 5; aqui 8 para não perder o que se usou antes). */
const MAX_RECENT = 8;

/** Comandos recentes, último comando e a seleção não vazia anterior (menu de contexto e barra de espaço). */
export interface RecentState {
  /** Ferramentas usadas, a mais recente primeiro, sem repetir. A seleção não entra (é a ferramenta padrão). */
  recent: ToolId[];
  /** Último comando (ferramenta que não é Selecionar). Null antes de qualquer uso. */
  last: ToolId | null;
  /** Última seleção não vazia que foi trocada pela atual ("Selecionar anterior"). */
  prevSelection: Id[];
}

export const useRecent = create<RecentState>()(() => ({ recent: [], last: null, prevSelection: [] }));

/** Registra o uso de uma ferramenta. Selecionar não é comando a repetir. */
export function registrarFerramenta(id: ToolId): void {
  if (id === 'select') return;
  useRecent.setState((s) => ({ recent: [id, ...s.recent.filter((x) => x !== id)].slice(0, MAX_RECENT), last: id }));
}

/** Guarda a seleção anterior quando ela não estava vazia e foi trocada. Seleção vazia não substitui a última útil. */
export function registrarSelecao(anterior: readonly Id[], atual: readonly Id[]): void {
  if (anterior.length === atual.length && anterior.every((id, i) => id === atual[i])) return;
  if (anterior.length) useRecent.setState({ prevSelection: [...anterior] });
}

/** Repete o último comando: só a partir da ferramenta Selecionar (senão a ferramenta atual é que manda). */
export function repeatLast(): boolean {
  const { last } = useRecent.getState();
  if (!last || editor.activeTool.id !== 'select') return false;
  editor.setTool(last);
  return true;
}

/** Seleciona de novo a seleção anterior, sem os elementos que já não existem no projeto. Devolve se algo foi selecionado. */
export function selectPrevious(): boolean {
  const ids = useRecent.getState().prevSelection.filter((id) => editor.project.elements[id] !== undefined);
  if (!ids.length) return false;
  if (editor.activeTool.id !== 'select') editor.setTool('select');
  useUi.setState({ selection: ids });
  return true;
}

/** Quando a barra de espaço pode repetir: sem campo de texto, diálogo, menu aberto nem foco em botão (o Espaço ativaria o botão). */
export function espacoPodeRepetir(): boolean {
  const ui = useUi.getState();
  if (ui.view === 'sheet' || ui.dialog !== null || ui.fileMenu || ui.typed || ui.prompt) return false;
  if (document.querySelector('[role="menu"], [role="dialog"], [role="listbox"]')) return false;
  const a = document.activeElement as HTMLElement | null;
  return !a || a === document.body || !!a.closest?.('.canvas-wrap');
}

let instalado = false;

/**
 * Liga os registros e a barra de espaço. Idempotente (chamado em main.tsx). O Espaço repete o último comando no soltar, só se
 * nada foi arrastado ou clicado enquanto ele estava pressionado (senão era pan) e a ferramenta ainda é Selecionar.
 */
export function installRecentCommands(): void {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  useUi.subscribe((s, prev) => {
    if (s.tool !== prev.tool) registrarFerramenta(s.tool);
    if (s.selection !== prev.selection) registrarSelecao(prev.selection, s.selection);
  });
  let espaco = { preso: false, usado: false };
  window.addEventListener('keydown', (e) => {
    // Repetição automática da tecla (e.repeat) não reabre o Espaço.
    if (e.code === 'Space' && !e.repeat) espaco = { preso: true, usado: false };
  });
  // Qualquer ponteiro ou roda com o Espaço preso é pan (ou outro gesto): não repete.
  const usou = (): void => { if (espaco.preso) espaco.usado = true; };
  window.addEventListener('pointerdown', usou, true);
  window.addEventListener('wheel', usou, true);
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    const repete = espaco.preso && !espaco.usado;
    espaco = { preso: false, usado: false };
    if (repete && espacoPodeRepetir()) repeatLast();
  });
}
