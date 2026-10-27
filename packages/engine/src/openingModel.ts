import type { Opening, Project } from '@hestia/model';
import type { WallFrame } from './frame.ts';
import type { OpeningGeometry } from './types.ts';
import type { OpeningModel } from './openingModelTypes.ts';
import { makeCtx, openingCore } from './openingModelContext.ts';
import { buildDoor } from './openingModelDoors.ts';
import { buildWindow, buildVoid } from './openingModelWindows.ts';
import {
  buildCasing,
  buildLintelBeams,
  buildSidelights,
  buildSillBoard,
  buildTransom,
} from './openingModelDetails.ts';

export * from './openingModelContext.ts';
export * from './openingModelDoors.ts';
export * from './openingModelWindows.ts';
export * from './openingModelDetails.ts';
export * from './openingModelTransforms.ts';

export function buildOpeningModel(p: Project, o: Opening, g: OpeningGeometry, f: WallFrame): OpeningModel {
  const c = makeCtx(p, o, g, f);
  if (!c) {
    return {
      kind: o.kind,
      width: g.width,
      height: g.height,
      thickness: f.thickness,
      core: openingCore(f),
      parts: [],
      openings: [],
      void: g.leaves === 0,
    };
  }
  if (g.leaves === 0) {
    // Vão livre: sem batente, folha ou vidro; só o acabamento que existir.
    buildVoid(c);
  } else if (c.t.kind === 'door') {
    buildDoor(c);
  } else {
    buildWindow(c);
  }
  if (g.leaves > 0) {
    buildSidelights(c);
    buildTransom(c);
  }
  buildCasing(c);
  buildSillBoard(c);
  buildLintelBeams(c);
  return {
    kind: c.t.kind,
    width: c.hw * 2,
    height: c.H,
    thickness: c.thickness,
    core: c.core,
    parts: c.parts,
    openings: c.openings,
    void: g.leaves === 0,
  };
}
