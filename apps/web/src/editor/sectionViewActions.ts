import { viewNameIssue, type Id, type ProjectStore, type SectionView } from '@hestia/model';
import { useUi } from './state.ts';

/** Altera uma vista pelos comandos validados; devolve a mensagem de recusa, ou null. */
export function updateViewAction(store: ProjectStore, id: Id, patch: Partial<Omit<SectionView, 'id'>>): string | null {
  try {
    store.exec({ type: 'updateView', id, patch }, 'Alterar vista');
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Alteração recusada.';
  }
}

/** Renomeia com a mesma validação do comando; nome vazio ou repetido fica na barra de estado. */
export function renameViewAction(store: ProjectStore, id: Id, name: string): boolean {
  const clean = name.trim();
  const issue = viewNameIssue(store.project.views, clean, id);
  if (issue) {
    useUi.setState({ status: issue });
    return false;
  }
  const err = updateViewAction(store, id, { name: clean });
  if (err) useUi.setState({ status: err });
  return err === null;
}

/** Exclui a vista e os viewports que a mostram, num único passo de desfazer. */
export function deleteViewAction(store: ProjectStore, id: Id): void {
  const v = store.project.views.find((x) => x.id === id);
  if (!v) return;
  store.exec({ type: 'deleteView', id });
  useUi.setState({ status: `${v.name} excluído. Ctrl+Z desfaz.` });
}
