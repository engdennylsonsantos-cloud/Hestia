import { describe, expect, it } from 'vitest';
import { generateSpiralRun, resolveStairsOnLevel, type ResolvedStair } from '@hestia/engine';
import { intersection, multiArea, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeStair, type Project, type StairLanding, type StairRun } from '@hestia/model';
import { SPIRAL_POST_SIDES, spiralByComponent, spiralPostRing, stairFills } from './stairs.ts';
import { defaultPaint } from './style.ts';

/** Espessura de corte da escada no zoom dos testes (100 px/m, 1:100): antes, 1,4 px fixos. */
const RISER_PX = defaultPaint('stair', 100).cutPx;
import { LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';
import type { StrokeOp, FillOp } from './types.ts';

const VIEW: Viewport = { cx: 0, cy: 0, zoom: 100, width: 800, height: 600 };
const deg = (d: number) => (d * Math.PI) / 180;
const CENTER: Vec2 = { x: 0, y: 0 };
const RIN = 0.1;
const ROUT = 1;
/** Topo da escada: o lance sobe 3 m (lv_1 a 3 m), todos os espelhos entram na vista de 3,5 m. */
const TOP_ALL = 3.5;
const CUT = 1.2;

/** Escada com um caracol (croqui gerado pelo motor) no tipo dado; o lance tem `risers` espelhos. */
function spiralProject(sweepDeg: number, risers: number, typeId = 'stt_caracol_poste'): Project {
  const sk = generateSpiralRun({ center: CENTER, rInner: RIN, rOuter: ROUT, startAngle: 0, sweep: deg(sweepDeg), risers });
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId, levelId: 'lv_0', components: [{ id: 'r1', kind: 'run', ...sk } as StairRun] as Array<StairRun | StairLanding> }) });
  return s.project;
}

function resolved(p: Project): ResolvedStair {
  const [st] = resolveStairsOnLevel(p, 'lv_0');
  expect(st!.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return st!;
}

const isPost = (pts: Vec2[]) => pts.length === SPIRAL_POST_SIDES;
const closedStrokes = (strokes: StrokeOp[]) => strokes.filter((s) => s.closed);
const postFills = (fills: FillOp[]) => fills.filter((f) => f.polygons.length === 1 && f.polygons[0]!.length === 1 && isPost(f.polygons[0]![0]!));
const stepFills = (fills: FillOp[]) => fills.filter((f) => !postFills([f]).length);
const numbers = (labels: Array<{ text: string }>) => labels.map((l) => l.text).filter((t) => /^\d+$/.test(t));

/** Caracol de 540° (19 espelhos, 18 degraus): 7 degraus até 1,20 m (cheios), 11 acima (tracejados), voltas sobrepostas. */
describe('caracol de 540° na planta (decisão 0014 §1 item 9)', () => {
  const p = spiralProject(540, 19);
  const st = resolved(p);
  const ops = stairFills(p, [st], LIGHT, false, 'fine', VIEW, { cutZ: CUT, topZ: TOP_ALL });

  it('volta de baixo cheia, volta de cima tracejada: o contorno de cada degrau acima do corte é tracejado', () => {
    const steps = closedStrokes(ops.strokes).filter((s) => !isPost(s.pts));
    expect(steps.filter((s) => s.dash)).toHaveLength(11);
    expect(steps.filter((s) => !s.dash)).toHaveLength(7);
  });

  it('o preenchimento soma a área da união dos degraus: a volta de cima não pinta por cima da de baixo', () => {
    const plan: MultiPolygon = union(...st.steps.map((k): MultiPolygon => [[k.polygon]]));
    const filled = stepFills(ops.fills).reduce((a, f) => a + multiArea(f.polygons), 0);
    expect(filled).toBeCloseTo(multiArea(plan), 6);
  });

  it('a volta de cima que cai sobre a de baixo não tem preenchimento próprio (a de baixo fica inteira)', () => {
    const lowerArea = multiArea(union(...st.steps.filter((k) => k.z <= CUT).map((k): MultiPolygon => [[k.polygon]])));
    const fillOnLower = stepFills(ops.fills).reduce((a, f) => a + multiArea(intersection(f.polygons, union(...st.steps.filter((k) => k.z <= CUT).map((k): MultiPolygon => [[k.polygon]])))), 0);
    expect(fillOnLower).toBeCloseTo(lowerArea, 6);
  });

  it('numeração contínua 1..N−1 (18 rótulos), um por degrau, sem repetição', () => {
    const ns = numbers(ops.labels);
    expect(ns).toHaveLength(18);
    expect(new Set(ns).size).toBe(18);
    expect(ns.map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('rótulos de cima (acima do corte) em tom claro; os de baixo no tom normal', () => {
    const soft = ops.labels.filter((l) => l.tone === 'soft');
    expect(soft).toHaveLength(11);
    expect(soft.map((l) => Number(l.text)).sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(ops.labels.filter((l) => /^\d+$/.test(l.text) && !l.tone)).toHaveLength(7);
  });

  it('rótulo da volta de cima que coincide com a de baixo sai para dentro do setor (raio entre rInner e rOuter, mais perto de rInner)', () => {
    const rho = (l: { at: Vec2 }) => Math.hypot(l.at.x - CENTER.x, l.at.y - CENTER.y);
    const shifted = ops.labels.filter((l) => l.tone === 'soft' && Number(l.text) >= 13);
    for (const l of shifted) expect(rho(l)).toBeCloseTo(RIN + 0.3 * (ROUT - RIN), 6);
  });

  it('nenhum par de rótulos no mesmo lugar (distância mínima entre rótulos de degrau acima de 0,15 m)', () => {
    const at = ops.labels.filter((l) => /^\d+$/.test(l.text)).map((l) => l.at);
    let min = Infinity;
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) min = Math.min(min, Math.hypot(at[i]!.x - at[j]!.x, at[i]!.y - at[j]!.y));
    expect(min).toBeGreaterThan(0.15);
  });

  it('poste (estilo poste): círculo de rInner com preenchimento do material do poste e contorno', () => {
    const ring = spiralPostRing(CENTER, RIN);
    for (const q of ring) expect(Math.hypot(q.x, q.y)).toBeCloseTo(RIN, 9);
    const fills = postFills(ops.fills);
    expect(fills).toHaveLength(1);
    expect(multiArea(fills[0]!.polygons)).toBeCloseTo(Math.PI * RIN * RIN, 1);
    expect(closedStrokes(ops.strokes).filter((s) => isPost(s.pts) && !s.dash)).toHaveLength(1);
  });

  it('seta: a caminhada explícita (arcos) sai amostrada do 1º ao último espelho; a ponta sai do último trecho', () => {
    const shaft = ops.strokes.find((s) => !s.closed && s.widthPx === RISER_PX && s.alpha === 0.9 && s.pts.length > 3)!;
    const head = ops.strokes.find((s) => !s.closed && s.alpha === 0.9 && s.pts.length === 3)!;
    const rm = (RIN + ROUT) / 2;
    expect(Math.hypot(shaft.pts[0]!.x - rm, shaft.pts[0]!.y)).toBeLessThan(1e-6);
    expect(Math.hypot(shaft.pts[shaft.pts.length - 1]!.x + rm, shaft.pts[shaft.pts.length - 1]!.y)).toBeLessThan(1e-6);
    expect(head.pts[1]).toEqual(shaft.pts[shaft.pts.length - 1]);
    // Ponta: as duas asas a 30° da direção do último trecho, para trás.
    const tip = head.pts[1]!;
    const prev = shaft.pts[shaft.pts.length - 2]!;
    const back = { x: prev.x - tip.x, y: prev.y - tip.y };
    const bl = Math.hypot(back.x, back.y);
    for (const wing of [head.pts[0]!, head.pts[2]!]) {
      const v = { x: wing.x - tip.x, y: wing.y - tip.y };
      const cos = (v.x * back.x + v.y * back.y) / (Math.hypot(v.x, v.y) * bl);
      expect(cos).toBeCloseTo(Math.cos(Math.PI / 6), 6);
    }
  });

  it('corte: o símbolo de corte (zigue-zague de 9 pontos) cruza a caminhada na cota de 1,20 m', () => {
    expect(ops.strokes.filter((s) => !s.closed && s.pts.length === 9)).toHaveLength(1);
  });
});

describe('caracol de 720° (duas voltas completas) e limites do intervalo', () => {
  it('720° com 25 espelhos: 10 degraus abaixo de 1,20 m, 14 acima; numeração 1..24 contínua', () => {
    const p = spiralProject(720, 25);
    const st = resolved(p);
    const ops = stairFills(p, [st], LIGHT, false, 'fine', VIEW, { cutZ: CUT, topZ: TOP_ALL });
    const steps = closedStrokes(ops.strokes).filter((s) => !isPost(s.pts));
    expect(steps.filter((s) => s.dash)).toHaveLength(14);
    expect(steps.filter((s) => !s.dash)).toHaveLength(10);
    expect(numbers(ops.labels).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('topo da vista em 2,30 m: degraus e rótulos acima do topo não saem (rótulos 1..14)', () => {
    const p = spiralProject(540, 19);
    const st = resolved(p);
    const ops = stairFills(p, [st], LIGHT, false, 'fine', VIEW, { cutZ: CUT, topZ: 2.3 });
    expect(numbers(ops.labels).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(closedStrokes(ops.strokes).filter((s) => !isPost(s.pts))).toHaveLength(14);
  });

  it('caracol com a base acima do corte: o poste sai tracejado e sem preenchimento', () => {
    const p = spiralProject(540, 19);
    const st = resolved(p);
    const ops = stairFills(p, [st], LIGHT, false, 'fine', VIEW, { cutZ: -0.5, topZ: TOP_ALL });
    expect(postFills(ops.fills)).toHaveLength(0);
    const post = closedStrokes(ops.strokes).find((s) => isPost(s.pts))!;
    expect(post.dash).toBeDefined();
  });

  it('poste monolítico: só o contorno, sem preenchimento do material', () => {
    const p = spiralProject(540, 19, 'stt_caracol_monolitica');
    const st = resolved(p);
    const ops = stairFills(p, [st], LIGHT, false, 'medium', VIEW, { cutZ: CUT, topZ: TOP_ALL });
    expect(postFills(ops.fills)).toHaveLength(0);
    expect(closedStrokes(ops.strokes).filter((s) => isPost(s.pts))).toHaveLength(1);
  });

  it('grosseiro: o poste do estilo poste entra só como preenchimento; sem contornos nem rótulos', () => {
    const p = spiralProject(540, 19);
    const st = resolved(p);
    const ops = stairFills(p, [st], LIGHT, false, 'coarse', VIEW, { cutZ: CUT, topZ: TOP_ALL });
    expect(postFills(ops.fills)).toHaveLength(1);
    expect(ops.strokes).toHaveLength(0);
    expect(ops.labels).toHaveLength(0);
  });

  it('metadado do caracol por componente: o lance 0 tem o poste; o lance reto não entra', () => {
    const p = spiralProject(540, 19);
    const st = resolved(p);
    const sp = spiralByComponent(p, st);
    expect([...sp.keys()]).toEqual([0]);
    expect(sp.get(0)!.rInner).toBe(RIN);
  });
});
