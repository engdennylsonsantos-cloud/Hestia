import type { ToolId, ToolOptions } from '@hestia/tools';

/** Placement tools clear an old selection, except modes that need the selected element as their target. */
export function clearSelectionForTool(id: ToolId, options: ToolOptions): boolean {
  const creates = ['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'roofextrusion', 'stair', 'stairrun', 'room', 'roomsep', 'dimension', 'text', 'section'].includes(id);
  const needsTarget = id === 'slope'
    || (id === 'floor' && options.floorMode === 'hole')
    || (id === 'slab' && options.slabMode === 'hole')
    || (id === 'ceiling' && options.ceilingMode === 'hole')
    || (id === 'roof' && options.roofMode === 'hole');
  return creates && !needsTarget;
}
