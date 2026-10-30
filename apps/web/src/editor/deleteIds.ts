import { annotationRemovals, areaPlanOf, isRoom, levelRoomSeparators, planAnnotationsOf, projectGrids, viewRemovals, type Id, type ProjectStore } from '@hestia/model';
import { useUi } from './state.ts';

/**
 * Na planta de área, a exclusão alcança as anotações da vista (cotas, textos, detalhes e etiquetas), os ambientes
 * (áreas) e as linhas de separação de ambiente/área. Paredes, portas, pisos e demais elementos de modelo continuam
 * bloqueados nela.
 */
function deletePlanSelectionIn(store: ProjectStore, planId: Id, ids: Id[]): void {
  const plan = areaPlanOf(store.project, planId);
  if (!plan) return;
  const want = new Set(ids);
  const a = planAnnotationsOf(plan);
  const next = {
    dimensions: a.dimensions.filter((x) => !want.has(x.id)),
    texts: a.texts.filter((x) => !want.has(x.id)),
    detailLines: a.detailLines.filter((x) => !want.has(x.id)),
    detailRegions: a.detailRegions.filter((x) => !want.has(x.id)),
    tags: a.tags.filter((x) => !want.has(x.id)),
  };
  const annotationIds = new Set<Id>([
    ...a.dimensions.map((x) => x.id),
    ...a.texts.map((x) => x.id),
    ...a.detailLines.map((x) => x.id),
    ...a.detailRegions.map((x) => x.id),
    ...a.tags.map((x) => x.id),
  ]);
  const removedAnnotations = annotationIds.size - (next.dimensions.length + next.texts.length + next.detailLines.length + next.detailRegions.length + next.tags.length);
  const rooms = ids.filter((id) => isRoom(store.project.elements[id]));
  const separators = levelRoomSeparators(store.project, plan.levelId).filter((r) => want.has(r.id)).map((r) => r.id);
  if (removedAnnotations === 0 && rooms.length === 0 && separators.length === 0) {
    useUi.setState({ status: 'Na planta de área dá para excluir ambientes, separadores e anotações; paredes e demais elementos de modelo continuam bloqueados.' });
    return;
  }
  store.transaction('Excluir', () => {
    if (removedAnnotations > 0) store.exec({ type: 'updateAreaPlan', id: planId, patch: { annotations: next } }, 'Excluir anotações da planta de área');
    if (rooms.length > 0) store.exec({ type: 'deleteElements', ids: rooms });
    for (const id of separators) store.exec({ type: 'removeRoomSeparator', levelId: plan.levelId, id });
  });
  useUi.setState({ selection: [], status: rooms.length > 0 ? 'Ambiente excluído.' : separators.length > 0 ? 'Separador excluído.' : 'Anotações excluídas da planta de área.' });
}

/**
 * Exclui a seleção: elementos por `deleteElements`; cotas e textos de anotação (decisão 0019) e linhas de separação de
 * ambiente (guardadas no nível, fora de project.elements) pelos próprios comandos. Tudo num único passo de desfazer.
 */
export function deleteSelectionIn(store: ProjectStore): void {
  const { selection: ids, levelId, view, planKind, areaPlanId } = useUi.getState();
  if (!ids.length) return;
  if (view === 'plan' && planKind === 'area' && areaPlanId) {
    deletePlanSelectionIn(store, areaPlanId, ids);
    return;
  }
  const notes = annotationRemovals(store.project, levelId, ids);
  const views = viewRemovals(store.project, ids);
  const separators = levelRoomSeparators(store.project, levelId).filter((r) => ids.includes(r.id)).map((r) => r.id);
  // Grades pertencem ao projeto (fora de project.elements e dos níveis): removeGrid.
  const grids = projectGrids(store.project).filter((g) => ids.includes(g.id)).map((g) => g.id);
  const gridIds = new Set(grids);
  const noteIds = new Set(notes.map((c) => c.id));
  const viewIds = new Set(views.map((c) => c.id));
  const sepIds = new Set(separators);
  const elems = ids.filter((id) => !noteIds.has(id) && !viewIds.has(id) && !sepIds.has(id) && !gridIds.has(id));
  store.transaction('Excluir', () => {
    for (const c of notes) store.exec(c);
    if (elems.length) store.exec({ type: 'deleteElements', ids: elems });
    for (const c of views) store.exec(c);
    for (const id of separators) store.exec({ type: 'removeRoomSeparator', levelId, id });
    for (const id of grids) store.exec({ type: 'removeGrid', id });
  });
  useUi.setState({ selection: [], status: 'Seleção excluída.' });
}
