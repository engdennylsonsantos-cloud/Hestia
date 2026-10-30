import { annotationRemovals, areaPlanOf, levelRoomSeparators, projectGrids, viewRemovals, type ProjectStore } from '@hestia/model';
import { useUi } from './state.ts';

/**
 * Exclui a seleção: elementos por `deleteElements`; cotas e textos de anotação (decisão 0019) e linhas de separação de
 * ambiente (guardadas no nível, fora de project.elements) pelos próprios comandos. Tudo num único passo de desfazer.
 */
export function deleteSelectionIn(store: ProjectStore): void {
  const { selection: ids, levelId, view, planKind, areaPlanId } = useUi.getState();
  if (!ids.length) return;
  // Na planta de área, as anotações da vista (planId) entram junto com o modelo, no mesmo passo de desfazer.
  const planId = view === 'plan' && planKind === 'area' && areaPlanId ? areaPlanId : undefined;
  const notes = annotationRemovals(store.project, levelId, ids, planId);
  const views = viewRemovals(store.project, ids);
  const separators = levelRoomSeparators(store.project, levelId).filter((r) => ids.includes(r.id)).map((r) => r.id);
  // Grades pertencem ao projeto (fora de project.elements e dos níveis): removeGrid.
  const grids = projectGrids(store.project).filter((g) => ids.includes(g.id)).map((g) => g.id);
  const gridIds = new Set(grids);
  // Etiquetas de ambiente (RoomTag) da planta de área: removeRoomTag no mesmo passo de desfazer.
  const roomTags = planId ? (areaPlanOf(store.project, planId)?.tags ?? []).filter((t) => ids.includes(t.id)).map((t) => t.id) : [];
  const noteIds = new Set([...notes.map((c) => c.id), ...roomTags]);
  const viewIds = new Set(views.map((c) => c.id));
  const sepIds = new Set(separators);
  const elems = ids.filter((id) => !noteIds.has(id) && !viewIds.has(id) && !sepIds.has(id) && !gridIds.has(id));
  store.transaction('Excluir', () => {
    for (const c of notes) store.exec(c);
    for (const id of roomTags) if (planId) store.exec({ type: 'removeRoomTag', planId, id });
    if (elems.length) store.exec({ type: 'deleteElements', ids: elems });
    for (const c of views) store.exec(c);
    for (const id of separators) store.exec({ type: 'removeRoomSeparator', levelId, id });
    for (const id of grids) store.exec({ type: 'removeGrid', id });
  });
  useUi.setState({ selection: [], status: 'Seleção excluída.' });
}
