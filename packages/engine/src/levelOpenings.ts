import { union, type MultiPolygon } from '@hestia/geom';
import type { Id, Project } from '@hestia/model';
import { rampHolesFor, rampOpeningsOnLevel, type RampOpening } from './rampOpenings.ts';
import { stairHolesFor, stairOpeningsOnLevel, type StairOpening } from './stairOpenings.ts';

/** Escadas e rampas que furam as lajes/pisos de um nível. */
export interface LevelOpenings {
  stairs: StairOpening[];
  ramps: RampOpening[];
}

/** Abre as duas famílias de uma vez (uma passada só em quem recorta piso, laje e forro). */
export function openingsOnLevel(p: Project, levelId: Id): LevelOpenings {
  return { stairs: stairOpeningsOnLevel(p, levelId), ramps: rampOpeningsOnLevel(p, levelId) };
}

/** União dos furos das escadas e das rampas na cota da face inferior do elemento. */
export function holesFor(o: LevelOpenings, undersideZ: number): MultiPolygon {
  const parts = [stairHolesFor(o.stairs, undersideZ), rampHolesFor(o.ramps, undersideZ)].filter((region) => region.length > 0);
  return parts.length ? union(...parts) : [];
}
