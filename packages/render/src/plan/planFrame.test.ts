import { describe, expect, it } from 'vitest';
import { resolveLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeWall, type Project } from '@hestia/model';
import { buildPlanGeometry, buildPlanOverlay, planGeometrySelection, type PlanInput } from './build.ts';
import { PlanFrame, planFrameUpdateOf, sameLabels, type PlanViewState } from './planFrame.ts';
import { PlanScene } from './gpuPlan.ts';
import { gridCovers, gridLayer } from './grid.ts';
import { LIGHT } from './types.ts';
import type { LabelOp, PlanOps, StrokeOp } from './types.ts';
import type { Viewport } from '../viewport.ts';

const V: Viewport = { cx: 0, cy: 0, zoom: 50, width: 800, height: 600 };

/** Sem GPU: a cena recebe as camadas e não faz nada com elas (o quadro só guarda o que desenharia). */
const NULL_SINK = { setSlot: (): void => {}, setBackground: (): void => {} };

/** Funções de geometria e sobreposição que contam quantas vezes foram refeitas. */
function ops(count: { g: number; o: number }) {
  const stroke = (x: number): StrokeOp => ({ pts: [{ x, y: 0 }, { x, y: 5 }], closed: false, widthPx: 2, color: '#000', alpha: 1 });
  const geometry = (): PlanOps => {
    count.g++;
    return { fills: [{ polygons: [[[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]]], color: '#abc', alpha: 1 }], strokes: [stroke(1)], labels: [] };
  };
  const overlay = (): PlanOps => {
    count.o++;
    return { fills: [], strokes: [stroke(2)], labels: [] };
  };
  return { geometry, overlay };
}

/** Malhas de cada camada da cena, na ordem (fillsBase, fillsOver, grid, strokesBase, strokesOver). */
const slotMeshes = (scene: PlanScene): unknown[][] => scene.scene.children.map((g) => [...g.children]);
/** Mesmas malhas, na mesma ordem (identidade, não igualdade estrutural). */
const sameMeshes = (a: unknown[], b: unknown[]): boolean => a.length === b.length && a.every((m, i) => m === b[i]);

describe('quadro da planta (PlanFrame)', () => {
  it('pan dentro da área coberta não refaz a geometria nem a sobreposição (as malhas ficam as mesmas)', () => {
    const scene = new PlanScene();
    const frame = new PlanFrame(scene);
    const count = { g: 0, o: 0 };
    const { geometry, overlay } = ops(count);
    const upd = (v: Viewport): void => frame.update({ v, theme: LIGHT, gpu: true, showGrid: true, geometryKey: 'g1', overlayKey: 'o1', geometry, overlay });
    upd(V);
    const before = slotMeshes(scene);
    upd({ ...V, cx: 0.2 });
    upd({ ...V, cx: -0.3, cy: 0.1 });
    expect(count).toEqual({ g: 1, o: 1 });
    const after = slotMeshes(scene);
    // Geometria (fillsBase, strokesBase) e sobreposição (fillsOver, strokesOver): mesmas malhas. A grade pode ser refeita.
    for (const i of [0, 1, 3, 4]) expect(sameMeshes(after[i]!, before[i]!)).toBe(true);
    scene.dispose();
  });

  it('mudança só da sobreposição refaz só a sobreposição', () => {
    const scene = new PlanScene();
    const frame = new PlanFrame(scene);
    const count = { g: 0, o: 0 };
    const { geometry, overlay } = ops(count);
    frame.update({ v: V, theme: LIGHT, gpu: true, showGrid: false, geometryKey: 'g1', overlayKey: 'o1', geometry, overlay });
    const before = slotMeshes(scene);
    frame.update({ v: V, theme: LIGHT, gpu: true, showGrid: false, geometryKey: 'g1', overlayKey: 'o2', geometry, overlay });
    expect(count).toEqual({ g: 1, o: 2 });
    const after = slotMeshes(scene);
    expect(sameMeshes(after[0]!, before[0]!)).toBe(true);
    expect(sameMeshes(after[3]!, before[3]!)).toBe(true);
    expect(sameMeshes(after[4]!, before[4]!)).toBe(false);
    scene.dispose();
  });

  it('mudança da chave da geometria (zoom ou nível) refaz a geometria', () => {
    const frame = new PlanFrame(NULL_SINK);
    const count = { g: 0, o: 0 };
    const { geometry, overlay } = ops(count);
    frame.update({ v: V, theme: LIGHT, gpu: false, showGrid: false, geometryKey: 'g1', overlayKey: 'o1', geometry, overlay });
    frame.update({ v: { ...V, zoom: 80 }, theme: LIGHT, gpu: false, showGrid: false, geometryKey: 'g2', overlayKey: 'o1', geometry, overlay });
    expect(count.g).toBe(2);
  });

  it('rótulos: a referência só muda quando o conteúdo muda', () => {
    const frame = new PlanFrame(NULL_SINK);
    const count = { g: 0, o: 0 };
    const geo = ops(count).geometry;
    const label = (text: string): LabelOp => ({ at: { x: 1, y: 1 }, text, dy: -12, tone: 'info' });
    let ov: LabelOp[] = [label('2,00 m')];
    const run = (key: string): void => frame.update({ v: V, theme: LIGHT, gpu: false, showGrid: false, geometryKey: 'g', overlayKey: key, geometry: geo, overlay: () => ({ fills: [], strokes: [], labels: ov }) });
    run('a');
    const first = frame.labels;
    ov = [label('2,00 m')];
    run('b');
    expect(frame.labels).toBe(first);
    ov = [label('3,00 m')];
    run('c');
    expect(frame.labels).not.toBe(first);
    expect(frame.labels[0]?.text).toBe('3,00 m');
  });

  it('sem grade, a camada da grade fica vazia; com grade, ela segue a vista', () => {
    const scene = new PlanScene();
    const frame = new PlanFrame(scene);
    const count = { g: 0, o: 0 };
    const { geometry, overlay } = ops(count);
    frame.update({ v: V, theme: LIGHT, gpu: true, showGrid: true, geometryKey: 'g', overlayKey: 'o', geometry, overlay });
    expect(scene.scene.children[2]!.children.length).toBeGreaterThan(0);
    frame.update({ v: V, theme: LIGHT, gpu: true, showGrid: false, geometryKey: 'g', overlayKey: 'o', geometry, overlay });
    expect(scene.scene.children[2]!.children.length).toBe(0);
    scene.dispose();
  });

  it('drawList junta as camadas na ordem de desenho: preenchimentos, depois traços da geometria e da sobreposição', () => {
    const frame = new PlanFrame(NULL_SINK);
    const count = { g: 0, o: 0 };
    const { geometry, overlay } = ops(count);
    frame.update({ v: V, theme: LIGHT, gpu: false, showGrid: false, geometryKey: 'g', overlayKey: 'o', geometry, overlay });
    const dl = frame.drawList(LIGHT);
    expect(dl.fills).toHaveLength(1);
    expect(dl.strokes.map((s) => s.pts[0]!.x)).toEqual([1, 2]);
  });
});

describe('rótulos iguais (sameLabels)', () => {
  it('compara texto, posição e estilo, na mesma ordem', () => {
    const a: LabelOp[] = [{ at: { x: 1, y: 2 }, text: 'A', tone: 'soft' }];
    expect(sameLabels(a, [{ at: { x: 1, y: 2 }, text: 'A', tone: 'soft' }])).toBe(true);
    expect(sameLabels(a, [{ at: { x: 1, y: 2 }, text: 'B', tone: 'soft' }])).toBe(false);
    expect(sameLabels(a, [{ at: { x: 1, y: 3 }, text: 'A', tone: 'soft' }])).toBe(false);
    expect(sameLabels(a, [])).toBe(false);
    expect(sameLabels([], [])).toBe(true);
  });
});

describe('grade com área coberta (gridLayer)', () => {
  it('cobre a vista; uma vista deslocada para fora da área pede nova grade', () => {
    const layer = gridLayer(V, LIGHT);
    expect(layer.strokes.length).toBeGreaterThan(0);
    expect(gridCovers(layer, V)).toBe(true);
    expect(gridCovers(layer, { ...V, cx: V.cx + 3 * V.width / V.zoom })).toBe(false);
  });
});

describe('geometria e sobreposição separadas (build)', () => {
  function proj(): Project {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    s.exec({ type: 'addDimension', levelId: 'lv_0', dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
    return s.project;
  }
  const input = (p: Project, selection: string[], hover: string | null = null): PlanInput => ({
    project: p,
    levelId: 'lv_0',
    resolved: resolveLevel(p, 'lv_0', new Map()),
    below: null,
    viewport: V,
    theme: LIGHT,
    dark: false,
    selection,
    hover,
    preview: [],
    inference: null,
    showGrid: false,
  });

  it('a seleção só entra na geometria pelas cotas do nível', () => {
    const p = proj();
    expect(planGeometrySelection(p, 'lv_0', ['w1', 'd1', 'x'])).toEqual(['d1']);
    expect(planGeometrySelection(p, 'lv_0', ['w1'])).toEqual([]);
    const semSel = buildPlanGeometry(input(p, []));
    expect(buildPlanGeometry(input(p, ['w1'])).strokes).toEqual(semSel.strokes);
    expect(buildPlanGeometry(input(p, ['d1'])).strokes).not.toEqual(semSel.strokes);
  });

  it('a sobreposição depende da seleção e do cursor, e a geometria não', () => {
    const p = proj();
    const base = buildPlanOverlay(input(p, []));
    const sel = buildPlanOverlay(input(p, ['w1']));
    expect(sel.fills.length).toBeGreaterThan(base.fills.length);
    expect(buildPlanOverlay(input(p, [], 'w1')).fills.length).toBeGreaterThan(0);
    expect(base.fills).toHaveLength(0);
  });
});

describe('estado da planta para o quadro (planFrameUpdateOf)', () => {
  const p = (() => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    s.exec({ type: 'addDimension', levelId: 'lv_0', dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
    return s.project;
  })();
  const state = (over: Partial<PlanViewState> = {}): PlanViewState => ({
    project: p,
    version: 1,
    levelId: 'lv_0',
    v: V,
    theme: LIGHT,
    dark: false,
    gpu: true,
    showGrid: false,
    showUnderlay: false,
    showRoofProjection: true,
    thinLines: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    resolve: () => resolveLevel(p, 'lv_0', new Map()),
    ...over,
  });

  it('a geometria só muda pelo que ela lê (zoom, versão, cotas selecionadas); seleção de parede e cursor não', () => {
    const base = planFrameUpdateOf(state());
    expect(planFrameUpdateOf(state({ selection: ['w1'] })).geometryKey).toBe(base.geometryKey);
    expect(planFrameUpdateOf(state({ hover: 'w1' })).geometryKey).toBe(base.geometryKey);
    expect(planFrameUpdateOf(state({ selection: ['d1'] })).geometryKey).not.toBe(base.geometryKey);
    expect(planFrameUpdateOf(state({ v: { ...V, zoom: 80 } })).geometryKey).not.toBe(base.geometryKey);
    expect(planFrameUpdateOf(state({ version: 2 })).geometryKey).not.toBe(base.geometryKey);
  });

  it('abrir a planta não resolve o nível atual (a geometria vem da vista); só o nível de baixo é resolvido', () => {
    const chamadas: string[] = [];
    const resolve = (id: string) => {
      chamadas.push(id);
      return resolveLevel(p, id, new Map());
    };
    planFrameUpdateOf(state({ levelId: 'lv_1', showUnderlay: true, resolve })).geometry();
    expect(chamadas).toEqual(['lv_0']);
    chamadas.length = 0;
    planFrameUpdateOf(state({ levelId: 'lv_0', showUnderlay: true, resolve })).geometry();
    expect(chamadas).toEqual([]);
  });

  it('a sobreposição muda com a seleção e o cursor, mas não com o pan', () => {
    const base = planFrameUpdateOf(state());
    expect(planFrameUpdateOf(state({ hover: 'w1' })).overlayKey).not.toBe(base.overlayKey);
    expect(planFrameUpdateOf(state({ selection: ['w1'] })).overlayKey).not.toBe(base.overlayKey);
    expect(planFrameUpdateOf(state({ v: { ...V, cx: 9 } })).overlayKey).toBe(base.overlayKey);
  });
});
