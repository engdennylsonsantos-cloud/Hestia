import { normalizeDock, saveDock, type DockLayout } from './dockLayout.ts';
import { useUi } from './state.ts';

/** Altera a disposição dos painéis (largura, divisória, lado do navegador) e, por padrão, guarda no navegador. */
export function setDock(patch: Partial<DockLayout>, save = true): void {
  const dock = normalizeDock({ ...useUi.getState().dock, ...patch });
  useUi.setState({ dock });
  if (save) saveDock(dock);
}
