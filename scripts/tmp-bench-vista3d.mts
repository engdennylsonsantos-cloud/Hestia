import { performance } from 'node:perf_hooks';
import { buildTemplate, emptyTitleBlock, makeView3DPoint, type Sheet, type SheetViewport } from '@hestia/model';
import { buildSheetDrawList } from '@hestia/render';

/** Folha A3 deitada com uma vista 3D de 250 × 160 mm. */
function comPrancha(projeto: ReturnType<typeof buildTemplate>, pointId?: string): ReturnType<typeof buildTemplate> {
  const vp: SheetViewport = { id: 'v3', view: pointId ? { kind: '3d', pointId } : { kind: '3d' }, at: { x: 20, y: 20 }, size: { w: 250, h: 160 }, scale: 100 };
  const sheet: Sheet = { id: 'sh1', number: 'A-101', name: '3D', size: 'A3', orientation: 'landscape', margin: 10, titleBlock: emptyTitleBlock(), viewports: [vp] };
  return { ...projeto, sheets: [sheet] };
}

for (const id of ['house2', 'house-premium', 'predio10'] as const) {
  const base = buildTemplate(id);
  const ponto = makeView3DPoint({ azimuth: -Math.PI / 4, elevation: 0.5, distance: 30, target: { x: 0, y: 0, z: 3 }, ortho: false }, 'Perspectiva');
  const p = comPrancha({ ...base, view3dPoints: [ponto] }, ponto.id);
  const t0 = performance.now();
  const lista = buildSheetDrawList(p, 'sh1')!;
  const t1 = performance.now();
  console.log(JSON.stringify({ modelo: id, ms: Math.round(t1 - t0), caminhos: lista.groups[0]!.paths.length }));
}
