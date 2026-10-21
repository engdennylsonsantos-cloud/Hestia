import { it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoof, type RoofProfilePoint } from '@hestia/model';
import { quantifyRoofs } from './index.ts';
import { defaultExtrusionProfile } from './roofExtrusion.ts';
import { presetArco, presetMansarda, presetDenteSerra } from './roofProfilePresets.ts';
const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
function q(boundary: any, profile: RoofProfilePoint[]) {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary, shape: 'extrusion', dir: { x: 1, y: 0 }, profile }) });
  const r = quantifyRoofs(s.project, 'lv_0').roofs[0]!;
  return { eave: r.eaveLength, gable: r.gableLength, gableArea: r.gableArea, face: r.faceArea, plan: r.planArea, vol: r.volume, ridge: r.ridgeLength, valley: r.valleyLength };
}
it('probe', () => {
  console.log('REPRO', JSON.stringify(q(rect(0, 0, 12, 6), [{ t: 0, z: 0 }, { t: 3, z: 1.5 }, { t: 6, z: 0 }])));
  console.log('ARCO', JSON.stringify(q(rect(0, 0, 10, 8), presetArco(8, 1))));
  console.log('MANS', JSON.stringify(q(rect(0, 0, 10, 8), presetMansarda(8, 1, 2, 2.5))));
  console.log('DENTE', JSON.stringify(q(rect(0, 0, 10, 6), presetDenteSerra(6, 3, 2))));
});
