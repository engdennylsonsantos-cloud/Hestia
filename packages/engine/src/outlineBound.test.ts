import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, totalThickness, type Id, type Project } from '@hestia/model';
import { circuitRecalcCount, resetCircuitRecalcCount, resolveBoundary, resolveFloors, resolveSlabs } from './index.ts';

/** Retângulo de paredes com o eixo na borda, fechando um cômodo w × h. Devolve os ids das quatro paredes. */
function rectRoom(store: ProjectStore, levelId: Id, w: number, h: number): Record<string, Id> {
  const ids = { bottom: 'wb', right: 'wr', top: 'wt', left: 'wl' };
  store.exec({ type: 'addWall', wall: makeWall({ id: ids.bottom, typeId: 'wt_alv14', levelId, a: { x: 0, y: 0 }, b: { x: w, y: 0 } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: ids.right, typeId: 'wt_alv14', levelId, a: { x: w, y: 0 }, b: { x: w, y: h } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: ids.top, typeId: 'wt_alv14', levelId, a: { x: w, y: h }, b: { x: 0, y: h } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: ids.left, typeId: 'wt_alv14', levelId, a: { x: 0, y: h }, b: { x: 0, y: 0 } }) });
  return ids;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Piso vinculado à face de acabamento, com a semente no centro do cômodo. */
function addLinkedFloor(store: ProjectStore, id: Id, levelId: Id, seed: Vec2, boundary: Vec2[] = rect(0.1, 0.1, 3.9, 2.9)): void {
  store.exec({ type: 'addFloor', floor: makeFloor({ id, typeId: 'ft_ceram', levelId, boundary, outlineSource: { mode: 'walls-finish', seed, linked: true } }) });
}

const floorArea = (p: Project, levelId: Id, id: Id): number => multiArea(resolveFloors(p, levelId).find((r) => r.floorId === id)!.polygon);

describe('contorno associativo de piso (decisão 0023 §8.2, §9.2)', () => {
  it('piso por paredes: área é a do espaço livre entre as faces de acabamento', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo((4 - t) * (3 - t), 6);
  });

  it('mover uma parede (circuito fechado) faz a área acompanhar, sem comando de piso', () => {
    const store = new ProjectStore(createEmptyProject());
    const ids = rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo((4 - t) * (3 - t), 6);
    // Move a parede direita para x = 5, levando os cantos junto (o circuito continua fechado).
    store.exec({ type: 'updateElements', ids: [ids.right!], patch: { a: { x: 5, y: 0 }, b: { x: 5, y: 3 } } });
    store.exec({ type: 'updateElements', ids: [ids.bottom!], patch: { b: { x: 5, y: 0 } } });
    store.exec({ type: 'updateElements', ids: [ids.top!], patch: { a: { x: 5, y: 3 } } });
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo((5 - t) * (3 - t), 6);
  });

  it('trocar o tipo de parede (espessura) muda a área; abrir porta não muda', () => {
    const store = new ProjectStore(createEmptyProject());
    const ids = rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    const before = floorArea(store.project, 'lv_0', 'f1');
    // Troca o tipo das quatro paredes (wt_alv14 0,184 m → wt_ext19 0,242 m).
    const t2 = totalThickness(store.project.wallTypes.wt_ext19!);
    for (const id of Object.values(ids)) store.exec({ type: 'updateElements', ids: [id!], patch: { typeId: 'wt_ext19' } });
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo((4 - t2) * (3 - t2), 6);
    // Uma porta na parede de baixo não altera o circuito (a silhueta ignora os vãos).
    store.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: ids.bottom!, offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo((4 - t2) * (3 - t2), 6);
    expect(before).not.toBeCloseTo((4 - t2) * (3 - t2), 6);
  });

  it('apagar a parede que fecha o circuito mantém o último contorno e devolve problem', () => {
    const store = new ProjectStore(createEmptyProject());
    const ids = rectRoom(store, 'lv_0', 4, 3);
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    // O contorno gravado é o último contorno válido (a face de acabamento, como a ferramenta grava ao criar por paredes).
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 }, rect(t / 2, t / 2, 4 - t / 2, 3 - t / 2));
    const area = floorArea(store.project, 'lv_0', 'f1');
    expect(area).toBeCloseTo((4 - t) * (3 - t), 6);
    store.exec({ type: 'deleteElements', ids: [ids.right!] });
    const r = resolveFloors(store.project, 'lv_0').find((x) => x.floorId === 'f1')!;
    expect(r.problem).toBe('aberto');
    expect(multiArea(r.polygon)).toBeCloseTo(area, 6);
  });

  it('dois pisos no mesmo circuito: os dois acompanham e ficam corretos', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    addLinkedFloor(store, 'f2', 'lv_0', { x: 2, y: 1.5 });
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo((4 - t) * (3 - t), 6);
    expect(floorArea(store.project, 'lv_0', 'f2')).toBeCloseTo((4 - t) * (3 - t), 6);
  });

  it('piso estático (sem origem) não acompanha a parede', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(1, 1, 3, 2) }) });
    const area = floorArea(store.project, 'lv_0', 'f1');
    store.exec({ type: 'updateElements', ids: ['wr'], patch: { a: { x: 5, y: 0 }, b: { x: 5, y: 3 } } });
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo(area, 6);
    expect(resolveFloors(store.project, 'lv_0').find((r) => r.floorId === 'f1')!.problem).toBeNull();
  });

  it('soltar o vínculo (detachOutline) volta ao contorno gravado; revincular deriva de novo', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f1', 'lv_0', { x: 2, y: 1.5 });
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo((4 - t) * (3 - t), 6);
    store.exec({ type: 'detachOutline', id: 'f1' });
    // Solto: vale o contorno gravado (retângulo 0,1..3,9 × 0,1..2,9), não o circuito.
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo(3.8 * 2.8, 6);
    store.exec({ type: 'relinkOutline', id: 'f1' });
    expect(floorArea(store.project, 'lv_0', 'f1')).toBeCloseTo((4 - t) * (3 - t), 6);
  });
});

describe('contorno associativo de laje (perímetro externo)', () => {
  it('laje pelo perímetro externo acompanha as paredes', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 6, 4);
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 6, 4), outlineSource: { mode: 'perimeter', seed: { x: 6, y: 2 }, linked: true } }) });
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    const area = multiArea(resolveSlabs(store.project, 'lv_0').find((r) => r.slabId === 'l1')!.polygon);
    expect(area).toBeCloseTo((6 + t) * (4 + t), 6);
    // resolveBoundary devolve o perímetro derivado.
    const slab = store.project.elements.l1;
    expect(slab && slab.kind === 'slab').toBe(true);
    const outline = resolveBoundary(store.project, 'lv_0', slab as Extract<typeof slab, { kind: 'slab' }>);
    expect(outline.problem).toBeNull();
    expect(multiArea([outline.polygon!])).toBeCloseTo((6 + t) * (4 + t), 6);
  });
});

describe('cache de circuitos por nível (decisão 0023 §11)', () => {
  it('editar uma parede do nível 0 não recalcula o circuito do nível 1', () => {
    const store = new ProjectStore(createEmptyProject());
    const lv0 = rectRoom(store, 'lv_0', 4, 3);
    addLinkedFloor(store, 'f0', 'lv_0', { x: 2, y: 1.5 });
    // Nível 1: outro cômodo (nível superior), com as paredes em ids próprios.
    const ids1 = ['ub', 'ur', 'ut', 'ul'];
    store.exec({ type: 'addWall', wall: makeWall({ id: ids1[0]!, typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: ids1[1]!, typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 6, y: 0 }, b: { x: 6, y: 4 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: ids1[2]!, typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 6, y: 4 }, b: { x: 0, y: 4 } }) });
    store.exec({ type: 'addWall', wall: makeWall({ id: ids1[3]!, typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 4 }, b: { x: 0, y: 0 } }) });
    addLinkedFloor(store, 'f1', 'lv_1', { x: 3, y: 2 });

    resolveFloors(store.project, 'lv_0');
    resolveFloors(store.project, 'lv_1');
    resetCircuitRecalcCount();
    expect(circuitRecalcCount()).toBe(0);

    // Move a parede direita do nível 0 (e os cantos) — o nível 1 não muda.
    store.exec({ type: 'updateElements', ids: [lv0.right!], patch: { a: { x: 5, y: 0 }, b: { x: 5, y: 3 } } });
    store.exec({ type: 'updateElements', ids: [lv0.bottom!], patch: { b: { x: 5, y: 0 } } });
    store.exec({ type: 'updateElements', ids: [lv0.top!], patch: { a: { x: 5, y: 3 } } });

    resolveFloors(store.project, 'lv_0');
    expect(circuitRecalcCount()).toBe(1);
    resolveFloors(store.project, 'lv_1');
    expect(circuitRecalcCount()).toBe(1);
  });
});
