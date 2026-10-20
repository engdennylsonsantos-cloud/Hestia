import { it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import { intersection, multiArea, type MultiPolygon } from '@hestia/geom';
import { fuseBands } from './solids.ts';
const u = { x: 0.6, y: 0.8 };
const trange = (m: MultiPolygon): string => {
  let lo = Infinity, hi = -Infinity;
  for (const p of m) for (const r of p) for (const v of r) { const t = v.x * u.x + v.y * u.y; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  return `t[${lo.toFixed(4)},${hi.toFixed(4)}]`;
};
it('dbg', () => {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'a', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 4 } }) });
  s.exec({ type: 'addOpening', opening: { id: 'j', kind: 'window', typeId: 'ot_j200', hostId: 'a', offset: 1.2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'a', offset: 3.0, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  const rw = resolveLevel(s.project, 'lv_0').walls['a']!;
  const l = rw.layers.find((x) => x.layerIndex === 0)!;
  const f = fuseBands(l.bands);
  for (const b of f) console.log('VERTS', b.z0.toFixed(1), b.z1.toFixed(1), JSON.stringify(b.poly.map((p) => p.map((r) => r.map((v) => [+(v.x*0.6+v.y*0.8).toFixed(4), +(-0.8*v.x+0.6*v.y).toFixed(4)])))));
  for (const b of f) console.log('PIECE', b.z0.toFixed(3), b.z1.toFixed(3), 'area', multiArea(b.poly).toExponential(4), trange(b.poly));
  let ov = 0;
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
    const a = f[i]!, b = f[j]!;
    if (a.z1 <= b.z0 + 1e-9 || b.z1 <= a.z0 + 1e-9) continue;
    ov += multiArea(intersection(a.poly, b.poly));
  }
  console.log('OVERLAP_AREA_SAMEZ', ov);
});
