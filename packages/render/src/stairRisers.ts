import type { ResolvedStair, ResolvedStairRiser } from '@hestia/engine';
import type { Vec2 } from '@hestia/geom';

/** Pontos do espelho: a polilinha quando houver (espelho curvo), senão a corda. */
export const riserPoints = (r: ResolvedStairRiser): Vec2[] => (r.points.length >= 2 ? r.points : [r.a, r.b]);

/** Espelhos na ordem de subida: componente (lance, patamar...) e, dentro dele, o índice (1..N do lance). */
export const risersInClimbOrder = (s: ResolvedStair): ResolvedStairRiser[] =>
  [...s.risers].sort((p, q) => p.componentIndex - q.componentIndex || p.index - q.index);
