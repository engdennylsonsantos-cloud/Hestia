import type { Project, Sheet, SheetViewport, SheetViewSource } from '@hestia/model';
import { sectionTitleOf, sheetInnerBox } from '@hestia/model';
import { emptyParts, type ViewportParts } from './types.ts';

/** Altura das linhas do carimbo e largura da caixa (mm de papel). */
export const STAMP_W = 120;
export const STAMP_ROW = 8;
export const STAMP_HEAD = 12;
export const STAMP_H = STAMP_HEAD + STAMP_ROW * 4;
/** Tinta do desenho impresso (o mesmo tom escuro da planta em papel). */
const paperInk = '#16181c';
const FRAME_MM = 0.5;
const VIEW_MM = 0.25;
const LINE_MM = 0.25;

const rectPts = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Nome da vista na legenda: nível, corte ou "3D", com a escala. Vista sem origem válida fica "Vista inexistente". */
export function captionOf(p: Project, view: SheetViewSource, vp: SheetViewport): string {
  const base = vp.title?.trim() ? vp.title.trim() : sourceName(p, view);
  return `${base} · 1:${vp.scale}`;
}

function sourceName(p: Project, view: SheetViewSource): string {
  if (view.kind === 'plan') return p.levels.find((l) => l.id === view.levelId)?.name ?? 'Vista inexistente';
  if (view.kind === 'section') {
    const found = p.views.find((v) => v.id === view.sectionId);
    return found ? sectionTitleOf(found) : 'Vista inexistente';
  }
  return '3D';
}

/** Escalas usadas na prancha, sem repetição, em ordem: "1:50 · 1:100". */
function scalesLine(s: Sheet): string {
  const set = [...new Set(s.viewports.map((v) => v.scale))];
  return set.map((k) => `1:${k}`).join(' · ');
}

/**
 * Moldura, legenda de cada vista e carimbo, em mm de papel. Fica por cima das vistas (o carimbo tem fundo branco e
 * cobre o que estiver sob ele).
 */
export function furnitureParts(p: Project, s: Sheet): ViewportParts {
  const out = emptyParts();
  const box = sheetInnerBox(s);
  out.paths.push({ pts: rectPts(box.x0, box.y0, box.x1, box.y1), closed: true, widthMm: FRAME_MM, color: paperInk });
  for (const v of s.viewports) {
    out.paths.push({ pts: rectPts(v.at.x, v.at.y, v.at.x + v.size.w, v.at.y + v.size.h), closed: true, widthMm: VIEW_MM, color: paperInk });
    out.texts.push({ at: { x: v.at.x, y: v.at.y - 3.5 }, text: captionOf(p, v.view, v), sizeMm: 2.5, rotation: 0, center: false, color: paperInk });
  }
  const tb = s.titleBlock;
  const x0 = box.x1 - STAMP_W;
  const y0 = box.y0;
  const top = y0 + STAMP_H;
  out.fills.push({ polygons: [[rectPts(x0, y0, box.x1, top)]], color: '#ffffff' });
  out.paths.push({ pts: rectPts(x0, y0, box.x1, top), closed: true, widthMm: FRAME_MM, color: paperInk });
  for (let i = 1; i <= 4; i++) {
    const y = top - STAMP_HEAD - (i - 1) * STAMP_ROW;
    out.paths.push({ pts: [{ x: x0, y }, { x: box.x1, y }], closed: false, widthMm: LINE_MM, color: paperInk });
  }
  const text = (x: number, y: number, t: string, size = 2.5) => out.texts.push({ at: { x, y }, text: t, sizeMm: size, rotation: 0, center: false, color: paperInk });
  text(x0 + 3, top - 8, `${s.number}  ${s.name}`, 4.5);
  const row = (i: number) => top - STAMP_HEAD - (i - 1) * STAMP_ROW - 5;
  text(x0 + 3, row(1), `Projeto: ${tb.project}`);
  text(x0 + 3, row(2), `Cliente: ${tb.client}`);
  text(x0 + 3, row(3), `Autor: ${tb.author}`);
  text(x0 + 62, row(3), `Data: ${tb.date}`);
  text(x0 + 3, row(4), `Revisão: ${tb.revision}`);
  text(x0 + 62, row(4), `Escala: ${tb.scaleNote?.trim() ? tb.scaleNote : scalesLine(s)}`);
  return out;
}
