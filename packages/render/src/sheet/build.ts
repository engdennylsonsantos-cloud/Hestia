import { sheetDimsMm, sheetOf, viewportClipped, type Id, type Project, type SheetViewport } from '@hestia/model';
import { furnitureParts } from './frame.ts';
import { areaTablePartsOf, areaPlanPartsOf, planPartsOf, sectionPartsOf } from './viewports.ts';
import { vista3dParts } from './vista3d.ts';
import { type SheetDrawList, type ViewportParts } from './types.ts';

function partsOfViewport(p: Project, v: SheetViewport): ViewportParts {
  switch (v.view.kind) {
    case 'plan':
      return planPartsOf(p, v.view.levelId, v);
    case 'areaPlan':
      return areaPlanPartsOf(p, v.view.planId, v);
    case 'areaTable':
      return areaTablePartsOf(p, v);
    case 'section':
      return sectionPartsOf(p, v.view.sectionId, v);
    case '3d':
      return vista3dParts(p, v);
  }
}

/**
 * Lista de desenho de uma prancha em mm de papel (decisão 0022): cada vista num grupo recortado à sua caixa e, por
 * último, a moldura, as legendas e o carimbo. Prancha inexistente: null.
 */
export function buildSheetDrawList(p: Project, sheetId: Id): SheetDrawList | null {
  const s = sheetOf(p, sheetId);
  if (!s) return null;
  const d = sheetDimsMm(s);
  const groups: SheetDrawList['groups'] = s.viewports.map((v) => ({
    // `clip: false` deixa o desenho transbordar a caixa (detalhes); ausente = recorta, como no Revit.
    clip: viewportClipped(v) ? { x: v.at.x, y: v.at.y, w: v.size.w, h: v.size.h } : null,
    ...partsOfViewport(p, v),
  }));
  groups.push({ clip: null, ...furnitureParts(p, s) });
  return { widthMm: d.w, heightMm: d.h, groups };
}
