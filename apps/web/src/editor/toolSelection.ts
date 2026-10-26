import type { ToolId } from '@hestia/tools';

/** Ferramentas de colocação limpam a seleção antiga. A Inclinação fica de fora: usa o elemento selecionado como alvo. */
export function clearSelectionForTool(id: ToolId): boolean {
  return ['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'roofextrusion', 'stair', 'stairrun', 'room', 'roomsep', 'dimension', 'text', 'section'].includes(id);
}
