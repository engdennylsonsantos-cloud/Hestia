import { useShallow } from 'zustand/react/shallow';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import type { RibbonCtx } from './actions.ts';

/** Estado que a faixa (e a barra de acesso rápido) lê; o seletor raso evita redesenhar a cada movimento do cursor. */
export function useRibbonCtx(): RibbonCtx {
  const p = useProject();
  const ui = useUi(useShallow((s) => ({
    tool: s.tool, selection: s.selection, view: s.view, levelId: s.levelId, showGrid: s.showGrid, showUnderlay: s.showUnderlay,
    showRoofProjection: s.showRoofProjection, propsOpen: s.propsOpen, browserOpen: s.browserOpen, sides: s.dock.sides, options: s.options,
  })));
  return { ...ui, p };
}
