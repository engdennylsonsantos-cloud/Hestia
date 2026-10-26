import { DEFAULT_DOCK, normalizeDock, saveDock, type DockLayout } from './dockLayout.ts';
import { useUi } from './state.ts';

/** Altera a disposição dos painéis (larguras, divisória, lado e ordem) e, por padrão, guarda no navegador. */
export function setDock(patch: Partial<DockLayout>, save = true): void {
  const dock = normalizeDock({ ...useUi.getState().dock, ...patch });
  useUi.setState({ dock });
  if (save) saveDock(dock);
}

/** Volta a disposição ao padrão (Propriedades e Navegador à esquerda, Propriedades em cima). Não reabre painéis fechados. */
export function resetDock(): void {
  setDock(DEFAULT_DOCK);
}
