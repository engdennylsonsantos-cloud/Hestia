import { annotationRemovals, levelRoomSeparators, viewRemovals, type ProjectStore } from '@hestia/model';
import { useUi } from './state.ts';

/**
 * Exclui a seleção: elementos por `deleteElements`; cotas e textos de anotação (decisão 0019) e linhas de separação de
 * ambiente (guardadas no nível, fora de project.elements) pelos próprios comandos. Tudo num único passo de desfazer.
 */
export function deleteSelectionIn(store: ProjectStore): void {
  const { selection: ids, levelId } = useUi.getState();
  if (!ids.length) return;
  const notes = annotationRemovals(store.project, levelId, ids);
  const views = viewRemovals(store.project, ids);
  const separators = levelRoomSeparators(store.project, levelId).filter((r) => ids.includes(r.id)).map((r) => r.id);
  const noteIds = new Set(notes.map((c) => c.id));
  const viewIds = new Set(views.map((c) => c.id));
  const sepIds = new Set(separators);
  const elems = ids.filter((id) => !noteIds.has(id) && !viewIds.has(id) && !sepIds.has(id));
  store.transaction('Excluir', () => {
    for (const c of notes) store.exec(c);
    if (elems.length) store.exec({ type: 'deleteElements', ids: elems });
    for (const c of views) store.exec(c);
    for (const id of separators) store.exec({ type: 'removeRoomSeparator', levelId, id });
  });
  useUi.setState({ selection: [], status: 'Seleção excluída.' });
}
