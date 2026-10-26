import { describe, expect, it } from 'vitest';
import { resolverZoom } from './zoomOps.ts';
import { generateFanRun, generateLShape, resolveStairsOnLevel, type StairComponentSketch } from '@hestia/engine';
import { ProjectStore, createEmptyProject, defaultStairTypeId, makeStair, type Project, type StairLanding, type StairRun } from '@hestia/model';
import { riserPoints, risersInClimbOrder } from '../stairRisers.ts';
import { polyMid, stairFills } from './stairs.ts';
import { defaultPaint } from './style.ts';

/** Espessura de corte da escada no zoom dos testes (100 px/m, 1:100): antes, 1,4 px fixos. */
const RISER_PX = defaultPaint('stair', 100).cutPx;
import { LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';
import type { Vec2 } from '@hestia/geom';

const VIEW: Viewport = { cx: 0, cy: 0, zoom: 100, width: 800, height: 600 };
const P = 0.28;

/** Componentes do croqui (engine) com id, como a escada guarda no modelo. */
function toModel(cs: StairComponentSketch[]): Array<StairRun | StairLanding> {
  return cs.map((c, i) => (c.kind === 'run' ? { id: `r_${i}`, kind: 'run', ...c.run } : { id: `p_${i}`, kind: 'landing', boundary: c.landing.boundary }));
}

/** Projeto com uma escada (altura do lance: 0 → 3 m, do térreo ao 2º pavimento). */
function projectWith(components: Array<StairRun | StairLanding>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components }) });
  return s.project;
}

/** Lance reto de N espelhos subindo em +x, com caminhada explícita opcional (de (P,0) a (N·P,0), arco de flecha `sag`). */
function straightWithPath(N: number, sag: number | null): StairRun {
  const ln = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, sag: 0 });
  const x1 = (N + 1) * P;
  const path = sag === null ? [] : [{ a: { x: P, y: 0 }, b: { x: N * P, y: 0 }, sag }];
  return {
    id: 'r_path',
    kind: 'run',
    boundaryLeft: [ln(0, 0.5, x1, 0.5)],
    boundaryRight: [ln(0, -0.5, x1, -0.5)],
    risers: Array.from({ length: N }, (_, i) => ln((i + 1) * P, -1, (i + 1) * P, 1)),
    path,
  };
}

/** Seta de subida (haste e ponta) do lance: as duas linhas de traço 1,4 px, alfa 0,9, abertas. */
function arrowOf(p: Project) {
  const [st] = resolveStairsOnLevel(p, 'lv_0');
  expect(st!.issues.filter((i) => i.severity === 'error')).toEqual([]);
  const ops = resolverZoom(stairFills(p, [st!], LIGHT, false, 'medium', VIEW), VIEW.zoom).strokes;
  const arrow = ops.filter((s) => !s.closed && s.widthPx === RISER_PX && s.alpha === 0.9);
  expect(arrow).toHaveLength(2);
  return { st: st!, shaft: arrow[0]!, head: arrow[1]! };
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

describe('seta de subida segue a caminhada (decisão 0011 · interface)', () => {
  it('escada em L: um vértice por espelho, nos pontos médios em ordem de subida, com a ponta no último', () => {
    const comps = toModel(generateLShape({ start: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, width: 1, risersFirst: 8, risersSecond: 9, tread: P, turn: 'left' }));
    const p = projectWith(comps);
    const { st, shaft, head } = arrowOf(p);
    expect(st.riserCount).toBe(17);
    expect(shaft.pts).toHaveLength(17);
    const mids = risersInClimbOrder(st).map((r) => polyMid(riserPoints(r)));
    shaft.pts.forEach((q, k) => expect(dist(q, mids[k]!)).toBeLessThan(1e-9));
    expect(head.pts).toHaveLength(3);
    expect(head.pts[1]).toEqual(shaft.pts[16]);
  });

  it('escada em L: a seta acompanha a curva (não é a reta do 1º ao último espelho)', () => {
    const comps = toModel(generateLShape({ start: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, width: 1, risersFirst: 8, risersSecond: 9, tread: P, turn: 'left' }));
    const { shaft } = arrowOf(projectWith(comps));
    const first = shaft.pts[0]!;
    const last = shaft.pts[shaft.pts.length - 1]!;
    // Ponto da reta 1º→último mais afastado da curva: a seta deve sair da reta por mais de 0,2 m.
    const dev = Math.max(...shaft.pts.map((q) => {
      const t = ((q.x - first.x) * (last.x - first.x) + (q.y - first.y) * (last.y - first.y)) / dist(first, last) ** 2;
      return dist(q, { x: first.x + t * (last.x - first.x), y: first.y + t * (last.y - first.y) });
    }));
    expect(dev).toBeGreaterThan(0.2);
  });

  it('escada em leque: um vértice por espelho radial, seguindo o arco', () => {
    const fan = generateFanRun({ center: { x: 0, y: 0 }, innerRadius: 0.6, outerRadius: 2, startAngle: Math.PI / 2, endAngle: 0, risers: 17 });
    const p = projectWith(toModel([{ kind: 'run', run: fan }]));
    const { st, shaft, head } = arrowOf(p);
    expect(st.riserCount).toBe(17);
    expect(shaft.pts).toHaveLength(17);
    const mids = risersInClimbOrder(st).map((r) => polyMid(riserPoints(r)));
    shaft.pts.forEach((q, k) => expect(dist(q, mids[k]!)).toBeLessThan(1e-9));
    expect(head.pts[1]).toEqual(shaft.pts[16]);
  });

  it('caminhada explícita válida: a seta segue a caminhada do lance (com os pontos da curva), do 1º ao último espelho', () => {
    const N = 17;
    const p = projectWith([straightWithPath(N, 0.3)]);
    const { shaft, head } = arrowOf(p);
    expect(shaft.pts.length).toBeGreaterThan(N);
    expect(dist(shaft.pts[0]!, { x: P, y: 0 })).toBeLessThan(1e-9);
    expect(dist(shaft.pts[shaft.pts.length - 1]!, { x: N * P, y: 0 })).toBeLessThan(1e-9);
    expect(Math.max(...shaft.pts.map((q) => Math.abs(q.y)))).toBeGreaterThan(0.1);
    expect(head.pts[1]).toEqual(shaft.pts[shaft.pts.length - 1]);
  });

  it('sem caminhada explícita: a seta é reta entre os pontos médios (um vértice por espelho)', () => {
    const N = 17;
    const { shaft } = arrowOf(projectWith([straightWithPath(N, null)]));
    expect(shaft.pts).toHaveLength(N);
    expect(shaft.pts.every((q) => Math.abs(q.y) < 1e-9)).toBe(true);
  });

  it('o rótulo SOBE continua junto ao início da seta, mesmo com a caminhada curva', () => {
    const p = projectWith([straightWithPath(17, 0.3)]);
    const [st] = resolveStairsOnLevel(p, 'lv_0');
    const sobe = resolverZoom(stairFills(p, [st!], LIGHT, false, 'medium', VIEW), VIEW.zoom).labels.find((l) => l.text === 'SOBE')!;
    expect(sobe.at.x).toBeCloseTo(P, 9);
    expect(sobe.at.y).toBeCloseTo(0, 9);
    expect(sobe.fontPx).toBeGreaterThan(0);
  });
});

