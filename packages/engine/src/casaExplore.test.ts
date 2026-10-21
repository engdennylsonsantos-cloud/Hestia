import { it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import { resolveLevel } from './index.ts';
import { multiArea, union } from '@hestia/geom';

it('explora clusters', () => {
  const p = buildTemplate('house-premium');
  for (const lv of ['lv_0', 'lv_1']) {
    const r = resolveLevel(p, lv);
    const sumLayers = Object.values(r.walls).reduce((s, w) => s + w.layers.reduce((t, l) => t + multiArea(l.cut), 0), 0);
    console.log(lv, 'sumLayersCut', sumLayers.toFixed(4));
    r.clusters.forEach((c, i) => console.log(lv, 'cluster', i, 'walls', c.wallIds.length, c.wallIds.join(','), 'silh area', multiArea(c.silhouette).toFixed(4), 'rings', c.silhouette.map((pg) => pg.length), 'holes', c.silhouette.map((pg) => pg.length - 1)));
    const u = union(...r.clusters.map((c) => c.silhouette));
    console.log(lv, 'union silh', multiArea(u).toFixed(4), 'polys', u.length, 'holes', u.map((pg) => pg.length - 1));
  }
});
