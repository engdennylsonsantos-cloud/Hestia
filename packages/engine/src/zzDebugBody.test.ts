import { it } from 'vitest';
import { multiArea, asMulti, union, type Vec2 } from '@hestia/geom';
import { DEFAULT_STAIR_TYPES, ProjectStore, createEmptyProject, makeStair, type StairCurve } from '@hestia/model';
import { generateFanRun, resolveStairs, stairBody, stairRunSteps } from './index.ts';

it('debug arc', () => {
  const run = generateFanRun({ center: { x: 0, y: 0 }, innerRadius: 1.0, outerRadius: 1.8, startAngle: 0, endAngle: 1.5 * Math.PI, risers: 16 });
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0', components: [{ id: 'c', kind: 'run', ...run }], topOffset: -0.2 }) });
  const st = resolveStairs(s.project)[0]!;
  console.log('issues', st.issues.map((i) => i.code), 'steps', st.steps.map((x) => [x.kind, x.index, x.z.toFixed(3), multiArea([[x.polygon]]).toFixed(4)]));
  const raw = stairRunSteps(run, { baseZ: 0, riserHeight: st.riserHeight });
  console.log('raw treads area sum', raw.treads.reduce((a, t) => a + multiArea([[t.polygon]]), 0), 'union', multiArea(raw.footprint));
  const { pieces } = stairBody(st);
  console.log('pieces', pieces.map((p) => [p.kind, p.index, p.zTop.toFixed(3), p.bottom.a.toFixed(3), p.bottom.b.toFixed(3), p.bottom.c.toFixed(3), multiArea([[p.polygon]]).toFixed(4)]));
  const pairs: string[] = [];
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = multiArea(asMulti(pieces[i]!.polygon).length ? [[pieces[i]!.polygon]] : []);
    const ov = multiArea(require_intersection(pieces[i]!.polygon, pieces[j]!.polygon));
    if (ov > 1e-9) pairs.push(`${i}-${j} idx ${pieces[i]!.index}/${pieces[j]!.index} ov ${ov.toFixed(4)} a ${a.toFixed(3)}`);
  }
  console.log('overlaps', pairs);
});
import { intersection } from '@hestia/geom';
function require_intersection(a: Vec2[], b: Vec2[]) { return intersection([[a]], [[b]]); }
