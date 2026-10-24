import type { Id } from '@hestia/model';

/**
 * Vista aberta na barra de vistas. É estado de sessão (não é salvo no projeto): separa "níveis do projeto"
 * de "vistas abertas". Plantas são por nível; corte/elevação por id da vista; prancha por id da folha.
 */
export type OpenView =
  | { kind: 'plan'; levelId: Id }
  | { kind: '3d' }
  | { kind: 'section'; viewId: Id }
  | { kind: 'sheet'; sheetId: Id };

/** Campos de vista da interface que determinam a vista ativa (subconjunto de `UiState`). */
export interface ActiveViewFields {
  view: 'plan' | '3d' | 'section' | 'sheet';
  levelId: Id;
  sectionId: Id | null;
  sheetId: Id | null;
}

/** Padrão ao abrir um projeto: só o nível ativo, que é o primeiro nível do projeto. */
export function defaultOpenViews(levelIds: readonly Id[]): OpenView[] {
  return [{ kind: 'plan', levelId: levelIds[0] ?? 'lv_0' }];
}

/** Mensagem exibida quando o usuário tenta fechar a última vista aberta. */
export const LAST_VIEW_MESSAGE = 'Não é possível fechar a última vista aberta.';

/** Chave estável de uma vista (serve de `key` na barra e para comparar vistas). */
export function viewKey(v: OpenView): string {
  switch (v.kind) {
    case 'plan':
      return `plan:${v.levelId}`;
    case '3d':
      return '3d';
    case 'section':
      return `section:${v.viewId}`;
    case 'sheet':
      return `sheet:${v.sheetId}`;
  }
}

/** Duas vistas são a mesma quando têm a mesma chave. */
export function sameView(a: OpenView, b: OpenView): boolean {
  return viewKey(a) === viewKey(b);
}

/** Indica se a vista já está na lista. */
export function hasView(list: readonly OpenView[], v: OpenView): boolean {
  return list.some((x) => sameView(x, v));
}

/**
 * Acrescenta a vista ao fim, se ainda não estiver aberta. Se já estiver, devolve a própria lista (só ativa, sem duplicar).
 * Não muta a lista recebida.
 */
export function addView(list: readonly OpenView[], v: OpenView): OpenView[] {
  return hasView(list, v) ? (list as OpenView[]) : [...list, v];
}

/** Remove a vista da lista (a ordem das demais se mantém). Não muta a lista recebida. */
export function removeView(list: readonly OpenView[], v: OpenView): OpenView[] {
  return list.filter((x) => !sameView(x, v));
}

/**
 * Vista que ocupa o lugar de `v` ao fechá-la: a da direita; na última posição, a da esquerda.
 * Devolve null quando `v` não está na lista ou é a única.
 */
export function neighborOf(list: readonly OpenView[], v: OpenView): OpenView | null {
  const i = list.findIndex((x) => sameView(x, v));
  if (i < 0 || list.length < 2) return null;
  return list[i + 1] ?? list[i - 1] ?? null;
}

/** Pode fechar uma vista? Nunca se a lista ficaria vazia. */
export function canClose(list: readonly OpenView[]): boolean {
  return list.length > 1;
}

/** Resultado de fechar uma vista: recusado (com a mensagem), ou a nova lista e a vista a ativar (se a fechada era a ativa). */
export type CloseResult = { ok: false; message: string } | { ok: true; list: OpenView[]; activate: OpenView | null };

/**
 * Regras de fechar uma aba (sem efeitos colaterais). `active` é a vista ativa agora.
 * - Última vista aberta: recusada.
 * - Vista que não está aberta: nada muda.
 * - Fechar a ativa: a nova lista e a vizinha (`activate`) para o chamador ativar.
 * - Fechar outra vista: só sai da lista; a ativa não muda.
 */
export function closeView(list: readonly OpenView[], target: OpenView, active: OpenView | null): CloseResult {
  if (!canClose(list)) return { ok: false, message: LAST_VIEW_MESSAGE };
  if (!hasView(list, target)) return { ok: true, list: [...list], activate: null };
  const wasActive = active !== null && sameView(active, target);
  return { ok: true, list: removeView(list, target), activate: wasActive ? neighborOf(list, target) : null };
}

/**
 * Mantém só as vistas que ainda existem no projeto (ex.: nível ou corte excluído). Preserva a ordem.
 */
export function pruneViews(list: readonly OpenView[], exists: (v: OpenView) => boolean): OpenView[] {
  return list.filter(exists);
}

/** Vista ativa segundo os campos da interface; null quando a vista pede um id que não está definido (corte ou prancha sem id). */
export function activeViewOf(ui: ActiveViewFields): OpenView | null {
  switch (ui.view) {
    case 'plan':
      return { kind: 'plan', levelId: ui.levelId };
    case '3d':
      return { kind: '3d' };
    case 'section':
      return ui.sectionId ? { kind: 'section', viewId: ui.sectionId } : null;
    case 'sheet':
      return ui.sheetId ? { kind: 'sheet', sheetId: ui.sheetId } : null;
  }
}
