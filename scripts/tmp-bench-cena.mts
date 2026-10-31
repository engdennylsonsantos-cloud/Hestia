import { performance } from 'node:perf_hooks';
import { buildTemplate, view3dOf, type Project } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import { ModelScene } from '@hestia/render';

const p = buildTemplate('predio10');
const projeto: Project = { ...p, view3d: { ...view3dOf(p), style: 'hiddenLine', edges: true } };
for (const instanciar of [true, false]) {
  const t0 = performance.now();
  const cena = new ModelScene({ instanciar });
  cena.update(projeto, p.levels.map((l) => resolveLevel(projeto, l.id)), { dark: false, edges: true, shadows: false });
  const t1 = performance.now();
  const v = cena.exportarVetores();
  const t2 = performance.now();
  console.log(JSON.stringify({ instanciar, update: Math.round(t1 - t0), export: Math.round(t2 - t1), tris: v.triangleIndices.length / 3, arestas: v.edges.length / 6 }));
  cena.dispose();
}
