import { useMemo } from 'react';
import { dimensionSettingsOf } from '@hestia/model';
import { registerBuiltinDimProviders, selectionDims, type DimContext, type TempDim } from '@hestia/tools';
import { editor, useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';

// Inicialização do editor: liga os provedores que acompanham o Hestia (idempotente).
registerBuiltinDimProviders();

/** Contexto de cotas do nível atual com as trocas de referência da sessão. */
export function useDimContext(): DimContext {
  const project = useProject();
  const levelId = useUi((s) => s.levelId);
  const overrides = useUi((s) => s.dimOverrides);
  return useMemo(() => ({ project, levelId, settings: dimensionSettingsOf(project), overrides }), [project, levelId, overrides]);
}

/**
 * Cotas dinâmicas do que está selecionado (um elemento com provedor registrado). Recalcula quando o projeto, a
 * seleção, as trocas de referência ou a configuração mudam.
 */
export function useSelectionDims(): TempDim[] {
  const ctx = useDimContext();
  const selection = useUi((s) => s.selection);
  return useMemo(() => selectionDims(ctx, selection), [ctx, selection]);
}

/** Cotas da prévia da ferramenta ativa (vazio para Selecionar ou ferramenta sem `tempDims`). */
export function toolDims(): TempDim[] {
  const tool = editor.activeTool;
  return tool.id === 'select' || !tool.tempDims ? [] : tool.tempDims();
}
