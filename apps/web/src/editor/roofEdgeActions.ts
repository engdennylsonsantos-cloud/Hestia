import { roofPatchProblem } from '@hestia/tools';
import type { Id, ProjectStore, Roof } from '@hestia/model';
import { useUi } from './state.ts';

const say = (msg: string): void => useUi.setState({ status: msg });

/**
 * Aplica `patch` aos telhados `ids` só se o motor ainda gerar águas para eles; senão não aplica e diz o motivo na barra
 * de status. Única porta de alteração de telhado pela interface de Propriedades e pelo modo de perímetro.
 */
export function applyRoofPatch(store: ProjectStore, ids: Id[], patch: Partial<Roof>): boolean {
  if (Object.keys(patch).length === 0) return true;
  const problem = roofPatchProblem(store.project, ids, patch);
  if (problem) {
    say(`Alteração não aplicada: ${problem}`);
    return false;
  }
  store.exec({ type: 'updateElements', ids, patch });
  return true;
}
