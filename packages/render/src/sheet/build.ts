import { sheetDimsMm, sheetOf, type Id, type Project, type SheetViewport } from '@hestia/model';
import { furnitureParts } from './frame.ts';
import { planPartsOf, sectionPartsOf } from './viewports.ts';
import { emptyParts, type SheetDrawList, type ViewportParts } from './types.ts';

/** Vista 3D não vai para o papel (sem imagem raster): o quadro traz o aviso. Decisão 0022. */
const threeDParts = (v: SheetViewport): ViewportParts => {
  const parts = emptyParts();
  parts.texts.push({
    at: { x: v.at.x + v.size.w / 2, y: v.at.y + v.size.h / 2 },
    text: '3D não vai no PDF',
    sizeMm: 3,
    rotation: 0,
    center: true,
    color: '#7a828c',
  });
  return parts;
};

function partsOfViewport(p: Project, v: SheetViewport): ViewportParts {
  switch (v.view.kind) {
    case 'plan':
      return planPartsOf(p, v.view.levelId, v);
    case 'section':
      return sectionPartsOf(p, v.view.sectionId, v);
    case '3d':
      return threeDParts(v);
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
    clip: { x: v.at.x, y: v.at.y, w: v.size.w, h: v.size.h },
    ...partsOfViewport(p, v),
  }));
  groups.push({ clip: null, ...furnitureParts(p, s) });
  return { widthMm: d.w, heightMm: d.h, groups };
}
