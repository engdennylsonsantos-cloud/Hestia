import * as THREE from 'three';
import { createEmptyProject, makeView3DPoint, makeWall, view3dOf, type Project } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import { ModelScene, OrbitCamera, aplicarCameraNaOrbita, vista3dParts } from '@hestia/render';

const p = createEmptyProject();
const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
const lados = [['a', 0, 1], ['b', 1, 2], ['c', 2, 3], ['d', 3, 0]] as const;
let order = 1;
for (const [id, i, j] of lados) {
  const w = makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: pts[i]!, b: pts[j]! });
  p.elements[w.id] = { ...w, order: order++ };
}
p.nextOrder = order;
const proj: Project = { ...p, view3d: { ...view3dOf(p), style: 'hiddenLine', edges: true } };
const cena = new ModelScene({ instanciar: false });
cena.update(proj, p.levels.map((l) => resolveLevel(proj, l.id)), { dark: false, edges: true, shadows: false });
const v = cena.exportarVetores();
const box = (arr: Float32Array) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < arr.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, arr[i + k]!); max[k] = Math.max(max[k]!, arr[i + k]!); }
  return { min, max };
};
console.log('tri box', v.box.min.toArray(), v.box.max.toArray());
console.log('edges box', JSON.stringify(box(v.edges)));
console.log('edge0', Array.from(v.edges.slice(0, 12)));
console.log('tris', v.triangleIndices.length / 3, 'edges', v.edges.length / 6);
cena.dispose();

const ponto = makeView3DPoint({ azimuth: -Math.PI / 4, elevation: 0.5, distance: 18, target: { x: 2, y: 1.5, z: 1.4 }, ortho: false }, 'P');
const orb = new OrbitCamera();
orb.sceneRadius = 3;
aplicarCameraNaOrbita(orb, ponto.camera);
orb.setAspect(180, 120);
orb.apply();
orb.camera.updateMatrixWorld(true);
orb.camera.matrixWorldInverse.copy(orb.camera.matrixWorld).invert();
console.log('cam', { az: orb.azimuth, el: orb.elevation, d: orb.distance, ortho: orb.ortho, fov: (orb.camera as THREE.PerspectiveCamera).fov, aspect: (orb.camera as THREE.PerspectiveCamera).aspect, pos: orb.camera.position.toArray() });
for (const c of [[0, 0, 0], [4, 0, 0], [4, 3, 2.8], [0, 3, 2.8]]) {
  const v = new THREE.Vector3(c[0]!, c[1]!, c[2]!).project(orb.camera);
  console.log('proj', c, v.toArray().map((n) => n.toFixed(3)));
}
const pp = { ...p, view3dPoints: [ponto] };
const vp = { id: 'v', view: { kind: '3d' as const, pointId: ponto.id }, at: { x: 0, y: 0 }, size: { w: 180, h: 120 }, scale: 100 };
const parts = vista3dParts(pp, vp);
let total = 0;
for (const s of parts.paths) total += Math.hypot(s.pts[1]!.x - s.pts[0]!.x, s.pts[1]!.y - s.pts[0]!.y);
console.log('paths', parts.paths.length, 'total mm', total.toFixed(1));
console.log(parts.paths.slice(0, 5).map((s) => s.pts));
