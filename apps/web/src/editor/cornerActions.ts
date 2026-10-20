import type { Id, ProjectStore } from '@hestia/model';
import { cornerMiterCommands } from '@hestia/tools';
import { useUi } from './state.ts';

function message(n: number, oneWall: boolean): string {
  if (n === 0) return oneWall ? 'Esta parede não tem quina em encosto ou esquadro com acabamento.' : 'Nenhuma quina em encosto ou esquadro com acabamento.';
  return `${n === 1 ? '1 quina passou' : `${n} quinas passaram`} para esquadria. Ctrl+Z desfaz.`;
}

/**
 * Troca as quinas em encosto ou esquadro com acabamento por esquadria: todo o projeto, ou só as quinas de uma parede
 * (botão "Corrigir" do aviso). Tudo em um único passo de desfazer. Atualiza a barra de status e devolve a contagem.
 */
export function miterCorners(store: ProjectStore, wallId?: Id): number {
  const cmds = cornerMiterCommands(store.project, undefined, wallId);
  const n = cmds.length;
  if (n > 0) store.exec({ type: 'batch', commands: cmds }, 'Quinas em esquadria');
  useUi.setState({ status: message(n, wallId !== undefined) });
  return n;
}
