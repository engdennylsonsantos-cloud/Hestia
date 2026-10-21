import { describe, expect, it } from 'vitest';
import { pointInMulti, type Vec2 } from '@hestia/geom';
import { resolveLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeRoof, makeSlab, makeWall, type Opening, type Project, type ViewRange } from '@hestia/model';
import { straightStair } from '../stairFixture.helper.ts';
import { buildPlanDrawList, type PlanInput } from './build.ts';
import { stairFills, STAIR_RISER_WIDTH_PX } from './stairs.ts';
import { LIGHT, type StrokeOp } from './types.ts';
import type { Viewport } from '../viewport.ts';

const VIEW: Viewport = { cx: 8, cy: 6, zoom: 100, width: 800, height: 600 };
const P = (x: number, y: number): Vec2 => ({ x, y });

/*
 * Cena de planta (decisão 0013): quatro paredes de 2,80 m, de x = 0 a 3, em y = 0, 2, 4 e 6, cada uma com uma abertura
 * no meio (centro em x = 1,5): janela com peitoril 0,90 (altura 1,20), janela com peitoril 1,50, janela com peitoril
 * 2,40 e porta. Mais paredes baixas e altas (y = 8 a 14) e um telhado, uma laje e um piso fora da faixa de x de paredes.
 */
function scene(range: Partial<ViewRange> = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  const wall = (id: string, y: number, extra: Partial<Parameters<typeof makeWall>[0]> = {}) =>
    makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: P(0, y), b: P(3, y), height: 2.8, ...extra });
  const opening = (id: string, hostId: string, typeId: string, kind: 'door' | 'window', extra: Partial<Opening> = {}): Opening => ({
    id,
    kind,
    typeId,
    hostId,
    offset: 1.5,
    flipHand: false,
    flipFacing: false,
    sillOverride: null,
    mark: '',
    ...extra,
  });
  s.exec({ type: 'addWall', wall: wall('w_09', 0) });
  s.exec({ type: 'addOpening', opening: opening('j_09', 'w_09', 'ot_j120', 'window', { sillOverride: 0.9 }) });
  s.exec({ type: 'addWall', wall: wall('w_150', 2) });
  s.exec({ type: 'addOpening', opening: opening('j_150', 'w_150', 'ot_j120', 'window', { sillOverride: 1.5 }) });
  s.exec({ type: 'addWall', wall: wall('w_240', 4) });
  s.exec({ type: 'addOpening', opening: opening('j_240', 'w_240', 'ot_j120', 'window', { sillOverride: 2.4 }) });
  s.exec({ type: 'addWall', wall: wall('w_porta', 6) });
  s.exec({ type: 'addOpening', opening: opening('porta', 'w_porta', 'ot_p80', 'door') });
  // Parede baixa (topo a 0,90): projeção abaixo do corte.
  s.exec({ type: 'addWall', wall: wall('w_baixa', 8, { height: 0.9 }) });
  // Parede que começa a 1,50 (acima do corte, abaixo do topo): projeção tracejada.
  s.exec({ type: 'addWall', wall: wall('w_alta', 10, { baseOffset: 1.5, height: 1 }) });
  // Parede que começa a 2,50 (acima do topo): oculta.
  s.exec({ type: 'addWall', wall: wall('w_oculta', 12, { baseOffset: 2.5, height: 1 }) });
  // Verga abaixo do corte: janela de peitoril 0,10 e altura 0,60 (topo a 0,70).
  s.exec({ type: 'addWall', wall: wall('w_verga', 14) });
  s.exec({ type: 'addOpening', opening: opening('j_verga', 'w_verga', 'ot_j60', 'window', { sillOverride: 0.1 }) });
  // Telhado com beiral em 2,80 (acima do topo padrão), sobre x de 10 a 14.
  s.exec({
    type: 'addRoof',
    roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [P(10, 0), P(14, 0), P(14, 4), P(10, 4)], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: P(1, 0) }),
  });
  // Laje com face superior em 2,80 (oculta) e laje rente ao piso (visível); piso abaixo da base (nunca some).
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l_alta', typeId: 'ls_mac15', levelId: 'lv_0', boundary: [P(16, 0), P(19, 0), P(19, 3), P(16, 3)], heightOffset: 2.8 }) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l_rente', typeId: 'ls_mac15', levelId: 'lv_0', boundary: [P(16, 4), P(19, 4), P(19, 6), P(16, 6)] }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f_abaixo', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [P(16, 8), P(19, 8), P(19, 10), P(16, 10)], heightOffset: -1 }) });
  if (Object.keys(range).length) s.exec({ type: 'setLevelViewRange', levelId: 'lv_0', patch: range });
  return s.project;
}

function draw(p: Project, over: Partial<PlanInput> = {}) {
  const input: PlanInput = {
    project: p,
    levelId: 'lv_0',
    resolved: resolveLevel(p, 'lv_0', new Map()),
    below: null,
    viewport: VIEW,
    theme: LIGHT,
    dark: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: false,
    ...over,
  };
  return buildPlanDrawList(input);
}
type DrawList = ReturnType<typeof draw>;

/** Há preenchimento de parede (ou de qualquer outro elemento) cobrindo o ponto? */
const filled = (dl: DrawList, x: number, y: number): boolean => dl.fills.some((f) => pointInMulti({ x, y }, f.polygons));

/** Traços abertos de um símbolo de abertura: todos dentro de 0,7 m do centro (anéis fechados são outra coisa). */
const symbolAt = (dl: DrawList, x: number, y: number): StrokeOp[] => dl.strokes.filter((s) => !s.closed && s.pts.every((q) => Math.hypot(q.x - x, q.y - y) <= 0.7));

/** Anéis fechados de uma parede só de contorno (todos os vértices a menos de 0,5 m da linha y). */
const ringAt = (dl: DrawList, y: number): StrokeOp[] => dl.strokes.filter((s) => s.closed && s.pts.every((q) => Math.abs(q.y - y) < 0.5));

const solid = (ops: StrokeOp[]): StrokeOp[] => ops.filter((s) => !s.dash);
const dashed = (ops: StrokeOp[]): StrokeOp[] => ops.filter((s) => s.dash);

describe('corte da vista na planta: parede e abertura (decisão 0013 §4)', () => {
  it('corte 1,20 m (padrão): a janela de peitoril 0,90 fura a parede e o símbolo é cheio', () => {
    const dl = draw(scene());
    expect(filled(dl, 1.5, 0)).toBe(false);
    expect(solid(symbolAt(dl, 1.5, 0)).length).toBeGreaterThan(0);
    expect(dashed(symbolAt(dl, 1.5, 0))).toHaveLength(0);
  });

  it('corte 1,20 m: a janela de peitoril 1,50 não fura; a parede fica inteira e o símbolo é tracejado', () => {
    const dl = draw(scene());
    expect(filled(dl, 1.5, 2)).toBe(true);
    const sym = symbolAt(dl, 1.5, 2);
    expect(sym.length).toBeGreaterThan(0);
    expect(solid(sym)).toHaveLength(0);
  });

  it('corte 1,20 m: a janela de peitoril 2,40 está acima do topo, então a parede fica inteira e nada da janela aparece', () => {
    const dl = draw(scene());
    expect(filled(dl, 1.5, 4)).toBe(true);
    expect(symbolAt(dl, 1.5, 4)).toHaveLength(0);
  });

  it('corte 1,20 m: a porta fura a parede e o símbolo é cheio', () => {
    const dl = draw(scene());
    expect(filled(dl, 1.5, 6)).toBe(false);
    expect(dashed(symbolAt(dl, 1.5, 6))).toHaveLength(0);
  });

  it('corte 0,50 m: a janela de peitoril 0,90 passa a ficar acima do corte (parede inteira, símbolo tracejado) e a porta fura', () => {
    const dl = draw(scene({ cut: 0.5 }));
    expect(filled(dl, 1.5, 0)).toBe(true);
    expect(solid(symbolAt(dl, 1.5, 0))).toHaveLength(0);
    expect(symbolAt(dl, 1.5, 0).length).toBeGreaterThan(0);
    expect(filled(dl, 1.5, 2)).toBe(true);
    expect(solid(symbolAt(dl, 1.5, 2))).toHaveLength(0);
    expect(filled(dl, 1.5, 4)).toBe(true);
    expect(symbolAt(dl, 1.5, 4)).toHaveLength(0);
    expect(filled(dl, 1.5, 6)).toBe(false);
  });

  it('corte 1,60 m: as janelas de peitoril 0,90 e 1,50 cruzam o corte e furam; a de 2,40 segue oculta', () => {
    const dl = draw(scene({ cut: 1.6 }));
    expect(filled(dl, 1.5, 0)).toBe(false);
    expect(solid(symbolAt(dl, 1.5, 0)).length).toBeGreaterThan(0);
    expect(filled(dl, 1.5, 2)).toBe(false);
    expect(solid(symbolAt(dl, 1.5, 2)).length).toBeGreaterThan(0);
    expect(filled(dl, 1.5, 4)).toBe(true);
    expect(symbolAt(dl, 1.5, 4)).toHaveLength(0);
    expect(filled(dl, 1.5, 6)).toBe(false);
  });

  it('verga abaixo do corte: a janela de 0,10 a 0,70 não fura; o símbolo sai leve (cor secundária)', () => {
    const dl = draw(scene());
    expect(filled(dl, 1.5, 14)).toBe(true);
    const sym = symbolAt(dl, 1.5, 14);
    expect(sym.length).toBeGreaterThan(0);
    expect(sym.every((s) => s.color === LIGHT.inkSoft)).toBe(true);
  });
});

describe('paredes fora do corte: contorno, sem preenchimento (decisão 0013 §4)', () => {
  it('parede abaixo do corte (topo a 0,90): contorno fino claro, sem hachura nem preenchimento', () => {
    const dl = draw(scene());
    expect(filled(dl, 1.5, 8)).toBe(false);
    const ring = ringAt(dl, 8);
    expect(ring).toHaveLength(1);
    expect(ring[0]!.color).toBe(LIGHT.inkSoft);
    expect(ring[0]!.widthPx).toBe(1);
    expect(ring[0]!.dash).toBeUndefined();
  });

  it('parede acima do corte e abaixo do topo (começa a 1,50): contorno tracejado fino', () => {
    const dl = draw(scene());
    expect(filled(dl, 1.5, 10)).toBe(false);
    const ring = ringAt(dl, 10);
    expect(ring).toHaveLength(1);
    expect(ring[0]!.dash).toEqual([6, 3]);
    expect(ring[0]!.widthPx).toBe(1);
  });

  it('parede acima do topo (começa a 2,50): oculta, nem contorno nem preenchimento', () => {
    const dl = draw(scene());
    expect(filled(dl, 1.5, 12)).toBe(false);
    expect(ringAt(dl, 12)).toHaveLength(0);
  });

  it('"além" (abaixo da base, dentro da profundidade): contorno na cor clara de fundo', () => {
    // Parede de altura 1 começando a -2 m: fica abaixo da base (0 m) e acima da profundidade (-3 m).
    const s = new ProjectStore(scene({ depth: -3 }));
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w_alem', typeId: 'wt_alv14', levelId: 'lv_0', a: P(0, 16), b: P(3, 16), height: 1, baseOffset: -2 }) });
    const dl = draw(s.project);
    const ring = ringAt(dl, 16);
    expect(ring).toHaveLength(1);
    expect(ring[0]!.color).toBe(LIGHT.underlay);
    expect(filled(dl, 1.5, 16)).toBe(false);
  });
});

describe('telhado, laje e piso no intervalo de vista', () => {
  it('telhado com beiral acima do topo: sai da planta; a projeção tracejada da cobertura fica', () => {
    const p = scene();
    const dl = draw(p);
    expect(filled(dl, 12, 2)).toBe(false);
    const proj = dl.strokes.filter((s) => s.closed && s.dash && s.pts.every((q) => q.x > 9.9 && q.x < 14.1 && q.y > -0.1 && q.y < 4.1));
    expect(proj.length).toBeGreaterThan(0);
  });

  it('projeção da cobertura desligada: o telhado oculto não deixa nenhum traço', () => {
    const dl = draw(scene(), { showRoofProjection: false });
    expect(filled(dl, 12, 2)).toBe(false);
    expect(dl.strokes.some((s) => s.closed && s.dash && s.pts.every((q) => q.x > 9.9 && q.x < 14.1))).toBe(false);
  });

  it('com o topo subido o telhado entra na vista e é preenchido', () => {
    const dl = draw(scene({ top: 3.5 }));
    expect(filled(dl, 12, 2)).toBe(true);
  });

  it('laje com face superior acima do topo (2,80) não aparece; laje rente ao piso aparece', () => {
    const dl = draw(scene());
    expect(filled(dl, 17.5, 1.5)).toBe(false);
    expect(filled(dl, 17.5, 5)).toBe(true);
  });

  it('piso com face abaixo da base continua visível (piso nunca some por estar abaixo)', () => {
    const dl = draw(scene());
    expect(filled(dl, 17.5, 9)).toBe(true);
  });

  it('planta de cobertura: o mesmo desenho com qualquer intervalo de vista (roofPlanMode não muda)', () => {
    const roofPlan = { roofPlanMode: true };
    const a = draw(scene(), roofPlan);
    const b = draw(scene({ top: 3.5, cut: 0.5 }), roofPlan);
    expect(b).toEqual(a);
    expect(filled(a, 12, 2)).toBe(true);
  });
});

describe('escada na vista (decisão 0013 §4): cota de corte e topo da vista', () => {
  const N = 10;
  const H = 0.175;
  const ZOOM = 100;
  const VZ: Viewport = { cx: 0.5, cy: 1.5, zoom: ZOOM, width: 800, height: 600 };
  const PROJECT = createEmptyProject();
  const stair = () => straightStair({ risers: N, tread: 0.28, riserH: H, width: 1 });
  const ops = (view?: { cutZ: number; topZ: number }) => stairFills(PROJECT, [stair()], LIGHT, false, 'medium', VZ, view);
  const risers = (o: ReturnType<typeof ops>) => o.strokes.filter((s) => !s.closed && s.pts.length === 2 && !s.dash && s.widthPx === STAIR_RISER_WIDTH_PX);
  const treads = (o: ReturnType<typeof ops>) => o.strokes.filter((s) => s.closed);

  it('corte baixo (0,50 m) e topo (1,00 m): degraus acima do topo saem; acima do corte, tracejados; espelhos acima do topo saem', () => {
    const o = ops({ cutZ: 0.5, topZ: 1.0 });
    // Degraus com topo em k·H: k = 1..5 (até 0,875 m) estão na vista; k = 6..9 (1,05 a 1,575 m) saem.
    expect(treads(o)).toHaveLength(5);
    // Acima do corte (0,50 m): k = 3, 4, 5 (0,525; 0,70; 0,875 m) tracejados; k = 1 e 2 contínuos.
    expect(dashed(treads(o))).toHaveLength(3);
    expect(solid(treads(o))).toHaveLength(2);
    // Espelhos com topo até 1,00 m: k = 1..5.
    expect(risers(o)).toHaveLength(5);
    // O plano de corte (0,50 m) cruza a escada: símbolo de corte presente.
    expect(o.strokes.some((s) => !s.closed && s.pts.length === 9)).toBe(true);
  });

  it('corte alto (3,00 m, acima de toda a escada): sem símbolo de corte e todos os degraus contínuos', () => {
    const o = ops({ cutZ: 3.0, topZ: 3.5 });
    expect(treads(o)).toHaveLength(N - 1);
    expect(dashed(treads(o))).toHaveLength(0);
    expect(o.strokes.some((s) => !s.closed && s.pts.length === 9)).toBe(false);
  });

  it('sem vista: a cota de corte é 1,20 m acima da base (como antes), e não há topo', () => {
    const o = ops();
    expect(risers(o)).toHaveLength(N);
    expect(dashed(treads(o))).toHaveLength(3);
  });
});
