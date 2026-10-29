import { describe, expect, it, vi } from 'vitest';
import { arcFromSagitta, validateSketch, type SketchDraft, type SketchIssue, type SketchLoop, type SketchResult, type SketchSeg, type SketchTarget, type Vec2 } from '@hestia/geom';
import { worldToScreen, type Viewport } from '../viewport.ts';
import { sketchHitSeg, sketchOps, sketchTriangleAt, SKETCH_ISSUE } from './sketch.ts';
import { DARK, LIGHT, type FillOp, type StrokeOp } from './types.ts';

vi.mock('@hestia/geom', async (importOriginal) => {
  const real = await importOriginal<typeof import('@hestia/geom')>();
  return { ...real, validateSketch: vi.fn(real.validateSketch) };
});

const P = (x: number, y: number): Vec2 => ({ x, y });
const VIEW: Viewport = { cx: 0.5, cy: 0.5, zoom: 100, width: 800, height: 600 };
const DEFAULTS = { definesSlope: true, slopePct: 30, overhang: 0.3 };

/** Segmentos ligando os pontos em ciclo: a aresta i vai de pts[i] a pts[i+1]. */
function segsOf(pts: Vec2[], prefix = 's'): SketchSeg[] {
  return pts.map((a, i) => ({ id: `${prefix}${i}`, a, b: pts[(i + 1) % pts.length]! }));
}

const SQUARE = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
const DIAMOND = [P(0.5, 0), P(1, 0.5), P(0.5, 1), P(0, 0.5)];

function draftOf(target: SketchTarget, segs: SketchSeg[], over: Partial<SketchDraft> = {}): SketchDraft {
  return { target, segs, selected: [], defaults: DEFAULTS, ...over };
}

function resultOf(loops: SketchLoop[] = [], issues: SketchIssue[] = []): SketchResult {
  return { loops, issues, ok: loops.some((l) => l.role === 'outer') && issues.length === 0 };
}

function outerOf(segs: SketchSeg[], ring: Vec2[]): SketchResult {
  return resultOf([{ role: 'outer', segs, ring }]);
}

/** Triângulos: fills de três vértices em pixels (os quadradinhos de vértice têm quatro). */
const triangles = (fills: FillOp[]): FillOp[] => fills.filter((f) => f.deslocamentoPx?.[0]?.[0]?.length === 3);

describe('sketchOps: linhas e vértices', () => {
  it('uma linha rosa de 1,5 px por aresta e um quadradinho por vértice; fora do telhado não há triângulo nem texto', () => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf('floor', segs), outerOf(segs, SQUARE), LIGHT, VIEW);
    const lines = ops.strokes.filter((s) => s.color === LIGHT.roofFootprint && !s.closed && s.widthPx === 1.5);
    expect(lines).toHaveLength(4);
    expect(ops.fills.filter((f) => f.color === LIGHT.roofFootprint)).toHaveLength(4);
    expect(ops.labels).toEqual([]);
  });

  it('arco desenhado como arco: a polilinha fica sobre o círculo da flecha e vai de a até b', () => {
    const seg: SketchSeg = { id: 'arc', a: P(0, 0), b: P(2, 0), sag: 0.5 };
    const ops = sketchOps(draftOf('floor', [seg]), resultOf(), LIGHT, VIEW);
    const arc = arcFromSagitta(seg.a, seg.b, seg.sag!)!;
    const line = ops.strokes.find((s) => s.color === LIGHT.roofFootprint && s.widthPx === 1.5)!;
    expect(line.pts.length).toBeGreaterThan(8);
    for (const p of line.pts) expect(Math.hypot(p.x - arc.center.x, p.y - arc.center.y)).toBeCloseTo(arc.radius, 9);
    expect(line.pts[0]!.x).toBeCloseTo(0, 9);
    expect(line.pts.at(-1)!.x).toBeCloseTo(2, 9);
  });

  it('tema escuro usa o rosa do tema escuro', () => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf('floor', segs), outerOf(segs, SQUARE), DARK, VIEW);
    expect(ops.strokes.some((s) => s.color === DARK.roofFootprint)).toBe(true);
    expect(ops.strokes.some((s) => s.color === LIGHT.roofFootprint)).toBe(false);
  });

  it('seleção: azul sólido mais grosso que a linha rosa, com discos nas pontas e no meio; cursor em azul claro', () => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf('floor', segs, { selected: ['s0'] }), outerOf(segs, SQUARE), LIGHT, VIEW, 's2');
    const selected = ops.strokes.find((s) => s.color === LIGHT.select)!;
    const hover = ops.strokes.find((s) => s.color === LIGHT.selectHover)!;
    expect(selected).toMatchObject({ widthPx: 4, alpha: 1 });
    expect(hover).toMatchObject({ widthPx: 3, alpha: 1 });
    expect(ops.strokes.indexOf(selected)).toBeGreaterThan(ops.strokes.findIndex((s) => s.color === LIGHT.roofFootprint));
    const discs = ops.fills.filter((f) => f.color === LIGHT.select);
    expect(discs).toHaveLength(3);
    expect(discs.map((f) => f.polygons[0]![0]![0])).toEqual([P(0, 0), P(1, 0), P(0.5, 0)]);
  });

  it('tema escuro: seleção em azul sólido e cursor em azul claro, com os discos do tema', () => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf('floor', segs, { selected: ['s0'] }), outerOf(segs, SQUARE), DARK, VIEW, 's2');
    expect(ops.strokes.find((s) => s.color === DARK.select)).toMatchObject({ widthPx: 4, alpha: 1 });
    expect(ops.strokes.find((s) => s.color === DARK.selectHover)).toMatchObject({ widthPx: 3, alpha: 1 });
    expect(ops.fills.filter((f) => f.color === DARK.select)).toHaveLength(3);
  });

  it('cursor sem seleção: só a linha clara, sem discos', () => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf('floor', segs), outerOf(segs, SQUARE), LIGHT, VIEW, 's2');
    expect(ops.strokes.filter((s) => s.color === LIGHT.selectHover)).toHaveLength(1);
    expect(ops.fills.some((f) => f.color === LIGHT.select)).toBe(false);
  });

  it('janela de seleção: retângulo tracejado; preenchido só da esquerda para a direita', () => {
    const segs = segsOf(SQUARE);
    const draft = draftOf('floor', segs);
    const result = outerOf(segs, SQUARE);
    const win = sketchOps(draft, result, LIGHT, VIEW, null, { a: P(0, 0), b: P(1, 1), window: true });
    const cross = sketchOps(draft, result, LIGHT, VIEW, null, { a: P(1, 1), b: P(0, 0), window: false });
    expect(win.fills.some((f) => f.color === LIGHT.select && f.alpha === 0.12)).toBe(true);
    expect(cross.fills.some((f) => f.color === LIGHT.select && f.alpha === 0.12)).toBe(false);
    const boxStroke = win.strokes.at(-1)!;
    expect(boxStroke).toMatchObject({ closed: true, color: LIGHT.select, dash: [6, 4] });
  });

  it('esboço vazio, sem laço externo, não quebra e não desenha triângulo', () => {
    const ops = sketchOps(draftOf('roof', []), { loops: [], issues: [{ code: 'empty', message: 'Esboço vazio.', segIds: [] }], ok: false }, LIGHT, VIEW);
    expect(ops.fills).toEqual([]);
    expect(ops.labels).toEqual([]);
  });
});

describe('sketchOps: triângulo de inclinação (só telhado)', () => {
  it('um triângulo cheio por aresta do laço externo, com o texto da inclinação ao lado', () => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf('roof', segs), outerOf(segs, SQUARE), LIGHT, VIEW);
    expect(triangles(ops.fills)).toHaveLength(4);
    expect(ops.labels.filter((l) => l.text === '30 %')).toHaveLength(4);
  });

  it('a aresta de baixo fica para fora do laço, a 38 px, com os vértices em (-9,-29) (-9,-47) (9,-47)', () => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf('roof', segs), outerOf(segs, SQUARE), LIGHT, VIEW);
    const tri = triangles(ops.fills).find((f) => f.polygons[0]![0]![0]!.x === 0.5 && f.polygons[0]![0]![0]!.y === 0)!;
    const offs = tri.deslocamentoPx![0]![0]!;
    const want = [P(-9, -29), P(-9, -47), P(9, -47)];
    offs.forEach((o, i) => {
      expect(o.x).toBeCloseTo(want[i]!.x, 9);
      expect(o.y).toBeCloseTo(want[i]!.y, 9);
    });
  });

  it('catetos sempre nos eixos da tela, mesmo numa aresta inclinada; todos os triângulos apontam para fora', () => {
    const segs = segsOf(DIAMOND);
    const ops = sketchOps(draftOf('roof', segs), outerOf(segs, DIAMOND), LIGHT, VIEW);
    const tris = triangles(ops.fills);
    expect(tris).toHaveLength(4);
    for (const f of tris) {
      const offs = f.deslocamentoPx![0]![0]!;
      const leg1 = { x: offs[1]!.x - offs[0]!.x, y: offs[1]!.y - offs[0]!.y };
      const leg2 = { x: offs[2]!.x - offs[1]!.x, y: offs[2]!.y - offs[1]!.y };
      expect(leg1.x).toBeCloseTo(0, 9);
      expect(Math.abs(leg1.y)).toBeCloseTo(18, 9);
      expect(leg2.y).toBeCloseTo(0, 9);
      expect(Math.abs(leg2.x)).toBeCloseTo(18, 9);
      const anchor = f.polygons[0]![0]![0]!;
      const centroid = P(0.5, 0.5);
      const mean = { x: (offs[0]!.x + offs[1]!.x + offs[2]!.x) / 3, y: (offs[0]!.y + offs[1]!.y + offs[2]!.y) / 3 };
      expect(mean.x * (anchor.x - centroid.x) + mean.y * (anchor.y - centroid.y)).toBeGreaterThan(0);
    }
  });

  it('aresta com definesSlope falso: só contorno, sem preenchimento nem texto', () => {
    const segs = segsOf(SQUARE);
    segs[0] = { ...segs[0]!, definesSlope: false };
    const ops = sketchOps(draftOf('roof', segs), outerOf(segs, SQUARE), LIGHT, VIEW);
    expect(triangles(ops.fills)).toHaveLength(3);
    const outlines = ops.strokes.filter((s: StrokeOp) => s.closed && s.pts.length === 3 && s.color === LIGHT.roofFootprint);
    expect(outlines).toHaveLength(1);
    expect(ops.labels.filter((l) => l.text === '30 %')).toHaveLength(3);
  });

  it('a aresta própria do rascunho vale sobre o padrão: slopePct 12 vira "12 %"', () => {
    const segs = segsOf(SQUARE);
    segs[1] = { ...segs[1]!, slopePct: 12 };
    const ops = sketchOps(draftOf('roof', segs), outerOf(segs, SQUARE), LIGHT, VIEW);
    expect(ops.labels.map((l) => l.text).sort()).toEqual(['12 %', '30 %', '30 %', '30 %']);
  });

  it.each<SketchTarget>(['floor', 'slab', 'ceiling'])('%s: nenhum triângulo nem texto de inclinação', (target) => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf(target, segs), outerOf(segs, SQUARE), LIGHT, VIEW);
    expect(triangles(ops.fills)).toHaveLength(0);
    expect(ops.labels.filter((l) => l.text.endsWith('%'))).toHaveLength(0);
  });

  it('snapshot das operações de um telhado quadrado', () => {
    const segs = segsOf(SQUARE);
    expect(sketchOps(draftOf('roof', segs), outerOf(segs, SQUARE), LIGHT, VIEW)).toMatchSnapshot();
  });
});

describe('sketchOps: furos, problemas', () => {
  it('laço hole: laranja translúcido sem hachura e legenda "furo"', () => {
    const outer = segsOf(SQUARE, 'o');
    const hole = segsOf([P(0.3, 0.3), P(0.6, 0.3), P(0.6, 0.6), P(0.3, 0.6)], 'h');
    const result = resultOf([
      { role: 'outer', segs: outer, ring: SQUARE },
      { role: 'hole', segs: hole, ring: hole.map((s) => s.a) },
    ]);
    const ops = sketchOps(draftOf('floor', [...outer, ...hole]), result, LIGHT, VIEW);
    const furo = ops.fills.filter((f) => f.color === LIGHT.sketchHole);
    expect(furo).toHaveLength(1);
    expect(furo[0]).toMatchObject({ alpha: 0.28 });
    expect(furo[0]!.hatch).toBeUndefined();
    expect(ops.fills.some((f) => f.hatch !== undefined)).toBe(false);
    expect(ops.labels.filter((l) => l.text === 'furo')).toHaveLength(1);
  });

  it('problema: linha citada em vermelho e balão "!" no ponto do problema', () => {
    const segs = segsOf(SQUARE);
    const issue: SketchIssue = { code: 'self-cross', message: 'Linha cruza outra.', segIds: ['s1', 'missing'], at: P(1, 0.5) };
    const ops = sketchOps(draftOf('floor', segs), resultOf([], [issue]), LIGHT, VIEW);
    const red = ops.strokes.filter((s) => s.color === SKETCH_ISSUE && s.widthPx === 2.5);
    expect(red).toHaveLength(1);
    expect(red[0]!.pts).toHaveLength(2);
    const balloon = ops.labels.find((l) => l.text === '!')!;
    expect(balloon.at).toEqual(P(1, 0.5));
    expect(ops.fills.some((f) => f.color === '#ffffff')).toBe(true);
  });

  it('problema sem ponto: só a linha vermelha, sem balão', () => {
    const segs = segsOf(SQUARE);
    const ops = sketchOps(draftOf('floor', segs), resultOf([], [{ code: 'open', message: 'Aberto.', segIds: ['s0'] }]), LIGHT, VIEW);
    expect(ops.labels.some((l) => l.text === '!')).toBe(false);
    expect(ops.strokes.filter((s) => s.color === SKETCH_ISSUE)).toHaveLength(1);
  });
});

describe('hit-test', () => {
  it('sketchHitSeg: acha a aresta sob o ponto de tela e ignora o que está longe', () => {
    const segs = segsOf(SQUARE);
    const draft = draftOf('floor', segs);
    expect(sketchHitSeg(draft, worldToScreen(VIEW, P(0.5, 0)), VIEW)).toBe('s0');
    expect(sketchHitSeg(draft, worldToScreen(VIEW, P(1, 0.5)), VIEW)).toBe('s1');
    expect(sketchHitSeg(draft, worldToScreen(VIEW, P(0.5, 0.5)), VIEW)).toBeNull();
  });

  it('sketchTriangleAt: centro em pixels de tela, 38 px para fora da aresta, e raio do círculo que contém o triângulo', () => {
    const segs = segsOf(SQUARE);
    vi.mocked(validateSketch).mockReturnValueOnce(outerOf(segs, SQUARE));
    const hit = sketchTriangleAt(draftOf('roof', segs), 's0', VIEW)!;
    expect(hit.center.x).toBeCloseTo(400, 9);
    expect(hit.center.y).toBeCloseTo(388, 9);
    expect(hit.r).toBeCloseTo(9 * Math.SQRT2, 9);
  });

  it('sketchTriangleAt: null fora do telhado e para aresta que não é do laço externo', () => {
    const segs = segsOf(SQUARE);
    expect(sketchTriangleAt(draftOf('floor', segs), 's0', VIEW)).toBeNull();
    vi.mocked(validateSketch).mockReturnValueOnce(outerOf(segs, SQUARE));
    expect(sketchTriangleAt(draftOf('roof', segs), 'nope', VIEW)).toBeNull();
  });
});
