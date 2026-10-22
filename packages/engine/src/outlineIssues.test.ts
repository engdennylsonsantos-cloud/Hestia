import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Id } from '@hestia/model';
import { outlineIssues, resolveFloors } from './index.ts';

/** Quatro paredes de um cômodo w × h, eixo na borda. Ids: wb, wr, wt, wl. */
function rectRoom(store: ProjectStore, levelId: Id, w: number, h: number): void {
  const seg = (id: string, a: Vec2, b: Vec2) => store.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId, a, b }) });
  seg('wb', { x: 0, y: 0 }, { x: w, y: 0 });
  seg('wr', { x: w, y: 0 }, { x: w, y: h });
  seg('wt', { x: w, y: h }, { x: 0, y: h });
  seg('wl', { x: 0, y: h }, { x: 0, y: 0 });
}

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function addLinkedFloor(store: ProjectStore, id: Id, levelId: Id, seed: Vec2): void {
  store.exec({ type: 'addFloor', floor: makeFloor({ id, typeId: 'ft_ceram', levelId, boundary: rect(0.1, 0.1, 3.9, 2.9), outlineSource: { mode: 'walls-finish', seed, linked: true } }) });
}

describe('avisos do contorno associativo (decisão 0023 §8.2c, §9.2)', () => {
  it('sem paredes apagadas nem pisos duplicados não há aviso', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    expect(outlineIssues(store.project)).toEqual([]);
  });

  it('apagar a parede que fecha o circuito dá contorno-aberto no piso, e a área fica como estava', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    // O contorno gravado é o último válido (a ferramenta grava o circuito ao criar): aqui, o próprio circuito resolvido.
    const outer = resolveFloors(store.project, 'lv_0')[0]!.polygon[0]![0]!;
    store.exec({ type: 'updateElements', ids: ['f1'], patch: { boundary: outer } });
    const before = multiArea(resolveFloors(store.project, 'lv_0')[0]!.polygon);
    store.exec({ type: 'deleteElements', ids: ['wr'] });
    const [issue] = outlineIssues(store.project);
    expect(issue).toMatchObject({ severity: 'warning', code: 'contorno-aberto', elementId: 'f1' });
    expect(issue!.message).toContain('vão');
    expect(issue!.message).toContain('Mantém o último contorno');
    expect(multiArea(resolveFloors(store.project, 'lv_0')[0]!.polygon)).toBeCloseTo(before, 6);
  });

  it('semente sem paredes no nível dá o motivo "não há circuito" e a laje usa o rótulo Laje', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 6, 4), outlineSource: { mode: 'perimeter', seed: { x: 6, y: 2 }, linked: true } }) });
    const [issue] = outlineIssues(store.project);
    expect(issue).toMatchObject({ code: 'contorno-aberto', elementId: 'l1' });
    expect(issue!.message.startsWith('Laje "l1"')).toBe(true);
    expect(issue!.message).toContain('não há circuito de paredes');
  });

  it('dois pisos vinculados ao mesmo circuito no mesmo nível: aviso informativo com os dois ids', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    addLinkedFloor(store, 'f2', 'lv_0', { x: 2, y: 1.5 });
    const issues = outlineIssues(store.project);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', code: 'piso-circuito-duplicado', elementId: 'f1', ids: ['f1', 'f2'] });
  });

  it('pisos no mesmo circuito em níveis diferentes não são duplicados', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    rectRoom(store, 'lv_1', 4, 3);
    store.exec({ type: 'updateElements', ids: ['wb', 'wr', 'wt', 'wl'], patch: {} });
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    addLinkedFloor(store, 'f2', 'lv_1', { x: 2, y: 1.5 });
    expect(outlineIssues(store.project).filter((i) => i.code === 'piso-circuito-duplicado')).toEqual([]);
  });

  it('piso com circuitos diferentes (uma parede interna separa) não é duplicado', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    store.exec({ type: 'addWall', wall: makeWall({ id: 'wi', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 2, y: 0 }, b: { x: 2, y: 3 } }) });
    addLinkedFloor(store, 'f1', 'lv_0', { x: 1, y: 1.5 });
    addLinkedFloor(store, 'f2', 'lv_0', { x: 3, y: 1.5 });
    expect(outlineIssues(store.project)).toEqual([]);
  });

  it('piso estático (sem origem ou soltado) nunca gera aviso de contorno', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(1, 1, 3, 2) }) });
    addLinkedFloor(store, 'f2', 'lv_0', { x: 2, y: 1.5 });
    store.exec({ type: 'deleteElements', ids: ['wr'] });
    store.exec({ type: 'detachOutline', id: 'f2' });
    expect(outlineIssues(store.project)).toEqual([]);
  });

  it('desvincular some com o aviso; desfazer volta ao vínculo e ao aviso; revincular tem desfazer próprio', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    store.exec({ type: 'deleteElements', ids: ['wr'] });
    expect(outlineIssues(store.project)).toHaveLength(1);
    store.exec({ type: 'detachOutline', id: 'f1' });
    expect(outlineIssues(store.project)).toEqual([]);
    store.undo();
    expect(outlineIssues(store.project)[0]!.code).toBe('contorno-aberto');
    store.undo();
    expect(store.project.elements.wr).toBeDefined();
    expect(outlineIssues(store.project)).toEqual([]);
    store.exec({ type: 'detachOutline', id: 'f1' });
    store.exec({ type: 'relinkOutline', id: 'f1' });
    store.undo();
    expect((store.project.elements.f1 as { outlineSource?: { linked: boolean } }).outlineSource?.linked).toBe(false);
  });
});
