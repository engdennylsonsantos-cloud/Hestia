import { openingEdge, openingExtents, type WallFrame } from '@hestia/engine';
import { openingsOfWall, type OpeningDimRef, type Project } from '@hestia/model';
import type { HostTarget } from '../refs.ts';

/**
 * Alvo de cota formado pela borda da esquadria vizinha, na mesma parede, mais próxima do centro `offset` em cada lado.
 * A borda segue a referência `ref` da esquadria (centro, vão livre, vão externo, com alizar). `selfId` (a esquadria
 * cotada, quando já existe) fica de fora. Sem vizinha no lado, o lado vem `null`.
 */
export function neighborOpeningTargets(
  project: Project,
  frame: WallFrame,
  offset: number,
  selfId: string | undefined,
  ref: OpeningDimRef,
  side: 1 | -1,
): { left: HostTarget | null; right: HostTarget | null } {
  let left: HostTarget | null = null;
  let right: HostTarget | null = null;
  for (const o of openingsOfWall(project, frame.wall.id)) {
    if (o.id === selfId) continue;
    const edge = openingEdge(openingExtents(project, o, frame, side), ref);
    if (o.offset < offset) {
      const t = o.offset + edge;
      if (!left || t > left.t) left = { t, ownerId: o.id, kind: 'opening' };
    } else {
      const t = o.offset - edge;
      if (!right || t < right.t) right = { t, ownerId: o.id, kind: 'opening' };
    }
  }
  return { left, right };
}
