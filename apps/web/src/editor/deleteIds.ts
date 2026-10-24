import { annotationRemovals, viewRemovals, type ProjectStore } from '@hestia/model';
import { useUi } from './state.ts';

/**
 * Exclui a seleção: elementos por `deleteElements`; cotas e textos de anotação (decisão 0019) pelos próprios comandos.
 * Tudo num único passo de desfazer.
 */
export function deleteSelectionIn(store: ProjectStore): void {
  const { selection: ids, levelId } = useUi.getState();
  if (!ids.length) return;
  const notes = annotationRemovals(store.project, levelId, ids);
  const views = viewRemovals(store.project, ids);
  const noteIds = new Set(notes.map((c) => c.id));
  const viewIds = new Set(views.map((c) => c.id));
  const elems = ids.filter((id) => !noteIds.has(id) && !viewIds.has(id));
  store.transaction('Excluir', () => {
    if (elems.length) store.exec({ type: 'deleteElements', ids: elems });
    for (const c of notes) store.exec(c);
    for (const c of views) store.exec(c);
  });
  useUi.setState({ selection: [], status: 'Seleção excluída.' });
}
