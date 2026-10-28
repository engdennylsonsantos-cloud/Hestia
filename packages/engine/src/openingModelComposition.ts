import {
  compositionOfType,
  openingFamilyOf,
  openingProfilesOf,
  resolveLayout,
  resolveProfile,
  type OpeningComposition,
  type Opening,
  type OpeningType,
  type Project,
} from '@hestia/model';
import type { WallFrame } from './frame.ts';
import type { OpeningGeometry } from './types.ts';
import type { OpeningModel } from './openingModelTypes.ts';
import { makeCtx, type Ctx } from './openingModelContext.ts';
import { buildMembers } from './openingModelMembers.ts';
import { buildGlassCell, buildLeafCell, buildLouverCell, buildPanelCell } from './openingModelCells.ts';
import { windowTransomApplies } from './openingModelWindowsNew.ts';
import { buildCasing } from './openingModelCasing.ts';
import { buildLintelBeams, buildSillBoard, thresholdPart } from './openingModelDetails.ts';

/*
 * Montagem de uma composição de VÁRIAS células (spec F1 §3): quadro único (membros), conteúdo de cada célula, alizar do
 * conjunto e os extras do tipo. Os tipos de uma célula seguem nos builders por família (`buildDoor`/`buildWindow`).
 */

/**
 * Composição efetiva do tipo. Sem `composition` gravada, vale a derivada dos campos antigos, mantida a regra do E3 §7:
 * bandeira superior só nas famílias de janela que a aceitam e bandeira lateral de janela só na janela fixa.
 */
function effectiveComposition(t: OpeningType): OpeningComposition {
  if (t.composition) return t.composition;
  const legacy: Record<string, unknown> = { ...t };
  if (t.kind === 'window') {
    if (!windowTransomApplies(t)) delete legacy.transom;
    if (openingFamilyOf(t)?.id !== 'window_fixed') delete legacy.sidelights;
  }
  return compositionOfType(legacy as unknown as OpeningType);
}

/** A composição tem mais de uma célula e o vão tem folha: o caminho novo vale (vão livre segue o caminho antigo). */
export function usesComposition(t: OpeningType, g: OpeningGeometry): OpeningComposition | null {
  if (g.leaves === 0) return null;
  const comp = effectiveComposition(t);
  return comp.layout.kind === 'split' ? comp : null;
}

/** O tipo com o quadro (estilo, modo de profundidade, J e profundidade) lido da composição: ela é a fonte do batente. */
function frameSyncedType(t: OpeningType, comp: OpeningComposition, p: Project): OpeningType {
  const prof = resolveProfile(comp.frame.profile, openingProfilesOf(p));
  return {
    ...t,
    frameStyle: comp.frame.style,
    frameDepthMode: comp.frame.depthMode,
    frameWidth: prof.visibleWidth,
    frameDepth: comp.frame.fixedDepth ?? prof.depth,
  };
}

export function buildCompositionModel(p: Project, o: Opening, g: OpeningGeometry, f: WallFrame, comp: OpeningComposition): OpeningModel | null {
  const base = makeCtx(p, o, g, f);
  if (!base) return null;
  const p2: Project = { ...p, openingTypes: { ...p.openingTypes, [o.typeId]: frameSyncedType(base.t, comp, p) } };
  const c: Ctx | null = makeCtx(p2, o, g, f);
  if (!c) return null;
  const layout = resolveLayout(comp, openingProfilesOf(p), c.t.kind);
  c.hw = layout.span.width / 2;
  c.H = layout.span.height;

  buildMembers(c, layout);
  if (c.frameStyle !== 'block' && c.t.kind === 'door' && !layout.members.some((m) => m.role === 'threshold')) {
    const sill = thresholdPart(c.t, c.hw, c.J, c.Cd, c.D);
    if (sill) c.parts.push(sill);
  }
  let leaves = 0;
  for (const cell of layout.cells) {
    const x = cell.content;
    if (x.kind === 'leaf') leaves += buildLeafCell(c, cell, x, leaves);
    else if (x.kind === 'glass') buildGlassCell(c, layout, cell, x);
    else if (x.kind === 'panel') buildPanelCell(c, layout, cell, x.thickness);
    else buildLouverCell(c, cell, x.blades);
  }
  buildCasing(c, { comp, layout });
  buildSillBoard(c);
  buildLintelBeams(c);
  return {
    kind: c.t.kind,
    width: layout.span.width,
    height: layout.span.height,
    thickness: c.thickness,
    core: c.core,
    parts: c.parts,
    openings: c.openings,
    void: false,
  };
}
