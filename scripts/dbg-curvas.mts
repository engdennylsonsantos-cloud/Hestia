import { arcFromSagitta, arcTangentAt, multiArea, norm, ringArea, union, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type JoinKind, type Project, type Wall } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';

const GROSSA = 'wt_ext19';
const FINA = 'wt_alv14';
const rad = (g: number) => (g * Math.PI) / 180;
const girar = (d: Vec2, g: number): Vec2 => { const a = rad(g); return { x: d.x * Math.cos(a) - d.y * Math.sin(a), y: d.x * Math.sin(a) + d.y * Math.cos(a) }; };
const R = Number(process.env.R ?? 4), graus = Number(process.env.G ?? 90), sentido = Number(process.env.S ?? 1), lado = Number(process.env.L ?? 1);
const kind = (process.env.K ?? 'butt') as JoinKind;
const c = Math.max(2, 2 * R * Math.sin(rad(15)));
const h = R - Math.sqrt(R * R - (c * c) / 4);
const A: Vec2 = { x: 0, y: 0 };
const N: Vec2 = { x: c, y: 0 };
const sag = process.env.FLAT ? 0 : sentido * h;
const arc = arcFromSagitta(A, N, sag);
const tN = arc ? arcTangentAt(arc, arc.length) : norm({ x: N.x - A.x, y: N.y - A.y });
const dNo = girar({ x: -tN.x, y: -tN.y }, lado * graus);
const B = { x: N.x + dNo.x * 3, y: N.y + dNo.y * 3 };
const pecas = [
  { id: 'g', typeId: GROSSA, a: A, b: N, sag, lado: 'end' as const },
  { id: 'f', typeId: FINA, a: N, b: B, sag: 0, lado: 'start' as const },
];
const s = new ProjectStore(createEmptyProject());
for (const p of pecas) s.exec({ type: 'addWall', wall: makeWall({ id: p.id, typeId: p.typeId, levelId: 'lv_0', a: p.a, b: p.b, sag: p.sag }) });
const elements = { ...s.project.elements };
for (const p of pecas) { const w = elements[p.id] as Wall; elements[p.id] = { ...w, joinStart: p.lado === 'start' ? { kind, flip: false } : w.joinStart, joinEnd: p.lado === 'end' ? { kind, flip: false } : w.joinEnd }; }
const proj = { ...s.project, elements } as Project;
const res = resolveLevel(proj, 'lv_0', new Map());
const cortes = pecas.flatMap((p) => res.walls[p.id]!.layers.filter((l) => l.cut.length > 0).map((l) => ({ w: p.id, li: l.layerIndex, mat: l.materialId, cut: l.cut })));
const sil = union(...cortes.map((x) => x.cut));
console.log('c', c.toFixed(3), 'h', h.toFixed(4), 'N', N, 'B', B, 'ext', sil.length);
for (const [i, poly] of sil.entries()) {
  console.log('poly', i, 'rings', poly.length);
  for (const hole of poly.slice(1)) {
    const xs = hole.map((p) => p.x), ys = hole.map((p) => p.y);
    console.log(' hole area', Math.abs(ringArea(hole)).toExponential(3), 'bbox', Math.min(...xs).toFixed(4), Math.min(...ys).toFixed(4), Math.max(...xs).toFixed(4), Math.max(...ys).toFixed(4), 'nverts', hole.length);
  }
}
console.log('soma-silh', (cortes.reduce((a, x) => a + multiArea(x.cut), 0) - multiArea(sil)).toExponential(2));
for (const x of cortes) console.log(x.w, x.li, x.mat, 'area', multiArea(x.cut).toFixed(6), 'n', x.cut.reduce((a, p) => a + p.reduce((b, r) => b + r.length, 0), 0));
console.log('--- vertices within 0.25 of node');
for (const x of cortes) {
  for (const ring of x.cut) for (const r of ring) {
    const pts = r.filter((p) => Math.hypot(p.x - N.x, p.y - N.y) < 0.25);
    if (pts.length) console.log(x.w, x.li, x.mat, pts.map((p) => `(${p.x.toFixed(4)},${p.y.toFixed(4)})`).join(' '));
  }
}
import { buildFrame, pointAt, toLocal, wallType as wt } from '@hestia/engine';
const frames = new Map(pecas.map((p) => [p.id, buildFrame(proj.elements[p.id] as Wall, wt(proj, proj.elements[p.id] as Wall))!]));
const fora = (x: string, y: string, noP: Vec2 = N): number => {
  const fx = frames.get(x)!, fy = frames.get(y)!;
  const noEmA = Math.hypot(fx.a.x - noP.x, fx.a.y - noP.y) <= Math.hypot(fx.b.x - noP.x, fx.b.y - noP.y);
  const pX = noEmA ? pointAt(fx, 0.1, 0) : pointAt(fx, fx.length - 0.1, 0);
  const sg = Math.sign(toLocal(fy, pX).s - toLocal(fy, noP).s);
  let pior = 0; let quem = '';
  for (const x2 of cortes.filter((q) => q.w === x)) for (const ring of x2.cut) for (const p of ring[0] ? ring : []) for (const q of p) {
    if (Math.hypot(q.x - noP.x, q.y - noP.y) > 0.8) continue;
    const l = toLocal(fy, q);
    if (l.t <= 1e-6 || l.t >= fy.length - 1e-6) continue;
    const v = sg > 0 ? fy.sLo - l.s : l.s - fy.sHi;
    if (v > pior) { pior = v; quem = `${x2.mat}#${x2.li} (${q.x.toFixed(4)},${q.y.toFixed(4)}) t=${l.t.toFixed(4)} s=${l.s.toFixed(4)} sLo=${fy.sLo.toFixed(4)} sHi=${fy.sHi.toFixed(4)}`; }
  }
  if (quem) console.log('ponta', x, 'sobre', y, pior.toExponential(2), quem);
  return pior;
};
console.log('protrusion g->f', fora('g', 'f').toExponential(2), 'f->g', fora('f', 'g').toExponential(2));
