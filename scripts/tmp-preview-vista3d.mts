import { writeFileSync } from 'node:fs';
import { buildTemplate, emptyTitleBlock, makeView3DPoint, type Sheet, type SheetViewport } from '@hestia/model';
import { buildSheetDrawList } from '@hestia/render';

function svg(id: 'house2' | 'predio10'): string {
  const base = buildTemplate(id);
  const ponto = makeView3DPoint({ azimuth: -Math.PI / 4, elevation: 0.5, distance: id === 'predio10' ? 70 : 18, target: { x: 0, y: 0, z: id === 'predio10' ? 12 : 1.5 }, ortho: false }, 'Perspectiva');
  const vp: SheetViewport = { id: 'v3', view: { kind: '3d' }, at: { x: 20, y: 20 }, size: { w: 260, h: 170 }, scale: 100 };
  const sheet: Sheet = { id: 'sh1', number: 'A-101', name: '3D', size: 'A3', orientation: 'landscape', margin: 10, titleBlock: emptyTitleBlock(), viewports: [vp] };
  const p = { ...base, view3dPoints: [ponto], sheets: [sheet] };
  const lista = buildSheetDrawList(p, 'sh1')!;
  const esc = 4;
  const body = lista.groups[0]!.paths
    .map((s) => `<path d="M${s.pts.map((q) => `${(q.x * esc).toFixed(2)},${((lista.heightMm - q.y) * esc).toFixed(2)}`).join(' L')}" fill="none" stroke="${s.color}" stroke-width="${(s.widthMm * esc).toFixed(2)}" stroke-linecap="round"/>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lista.widthMm * esc}" height="${lista.heightMm * esc}" viewBox="0 0 ${lista.widthMm * esc} ${lista.heightMm * esc}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
}

for (const id of ['house2', 'predio10'] as const) {
  const out = `C:/Users/Dennylson/Desktop/programas/Hestia/_local/preview-${id}.svg`;
  writeFileSync(out, svg(id));
  console.log(out);
}
