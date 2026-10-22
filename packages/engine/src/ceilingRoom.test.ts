import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeCeiling, makeRoom, makeWall, totalThickness, type Ceiling, type Id, type Project } from '@hestia/model';
import { ceilingDraftsFromRooms, ceilingIssues, ceilingOutline, ceilingRoomFor, circuitRecalcCount, resetCircuitCache, resetCircuitRecalcCount, resetRegionCache, resolveCeilings } from './index.ts';

/** Retângulo de paredes com o eixo na borda (como em outlineBound.test.ts). */
function rectRoom(store: ProjectStore, levelId: Id, w: number, h: number): Record<string, Id> {
  const ids = { bottom: 'wb', right: 'wr', top: 'wt', left: 'wl' };
  store.exec({ type: 'addWall', wall: makeWall({ id: ids.bottom, typeId: 'wt_alv14', levelId, a: { x: 0, y: 0 }, b: { x: w, y: 0 } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: ids.right, typeId: 'wt_alv14', levelId, a: { x: w, y: 0 }, b: { x: w, y: h } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: ids.top, typeId: 'wt_alv14', levelId, a: { x: w, y: h }, b: { x: 0, y: h } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: ids.left, typeId: 'wt_alv14', levelId, a: { x: 0, y: h }, b: { x: 0, y: 0 } }) });
  return ids;
}

/** Sala 4 × 3 m com um ambiente e um forro criado a partir dele ("Forro no ambiente"). */
function salaComForro(): ProjectStore {
  resetCircuitCache();
  resetRegionCache();
  const store = new ProjectStore(createEmptyProject());
  rectRoom(store, 'lv_0', 4, 3);
  store.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 1.5 } }) });
  const [d] = ceilingDraftsFromRooms(store.project, 'lv_0', 'ct_gesso', () => 'c1');
  store.exec({ type: 'addCeiling', ceiling: d! });
  return store;
}

const areaOf = (p: Project, id = 'c1'): number => multiArea(resolveCeilings(p, 'lv_0').find((r) => r.ceilingId === id)!.polygon);
const problemOf = (p: Project, id = 'c1') => resolveCeilings(p, 'lv_0').find((r) => r.ceilingId === id)!.problem;
const issueCodes = (p: Project): string[] => ceilingIssues(p).map((i) => i.code);
const T = totalThickness(createEmptyProject().wallTypes.wt_alv14!);
const ceilingOf = (p: Project): Ceiling => p.elements.c1 as Ceiling;

/** Move a parede direita para x = `x` (as duas pontas de canto acompanham, como a alça faria). */
function moveRight(store: ProjectStore, x: number): void {
  store.exec({ type: 'updateElements', ids: ['wr'], patch: { a: { x, y: 0 }, b: { x, y: 3 } } });
  store.exec({ type: 'updateElements', ids: ['wb'], patch: { b: { x, y: 0 } } });
  store.exec({ type: 'updateElements', ids: ['wt'], patch: { a: { x, y: 3 } } });
}

describe('forro no ambiente acompanha o ambiente (decisão 0023 §13, P-5)', () => {
  it('forro criado no ambiente tem a área do espaço livre entre as faces', () => {
    const store = salaComForro();
    expect(areaOf(store.project)).toBeCloseTo((4 - T) * (3 - T), 6);
    expect(problemOf(store.project)).toBeNull();
  });

  it('mover uma parede faz o forro acompanhar o ambiente', () => {
    const store = salaComForro();
    moveRight(store, 5);
    expect(areaOf(store.project)).toBeCloseTo((5 - T) * (3 - T), 6);
    expect(issueCodes(store.project)).not.toContain('forro-ambiente-aberto');
  });

  it('trocar o tipo das paredes (espessura) muda a área do forro', () => {
    const store = salaComForro();
    const t2 = totalThickness(store.project.wallTypes.wt_ext19!);
    for (const id of ['wb', 'wr', 'wt', 'wl']) store.exec({ type: 'updateElements', ids: [id], patch: { typeId: 'wt_ext19' } });
    expect(areaOf(store.project)).toBeCloseTo((4 - t2) * (3 - t2), 6);
  });

  it('abrir porta na parede não muda a área do forro', () => {
    const store = salaComForro();
    const before = areaOf(store.project);
    store.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'wb', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    expect(areaOf(store.project)).toBeCloseTo(before, 6);
  });

  it('apagar a parede que fecha o circuito mantém o último contorno e avisa', () => {
    const store = salaComForro();
    const before = areaOf(store.project);
    store.exec({ type: 'deleteElements', ids: ['wr'] });
    expect(problemOf(store.project)).toBe('aberto');
    expect(areaOf(store.project)).toBeCloseTo(before, 6);
    expect(issueCodes(store.project)).toContain('forro-ambiente-aberto');
  });

  it('apagar o ambiente mantém o último contorno e avisa', () => {
    const store = salaComForro();
    const before = areaOf(store.project);
    store.exec({ type: 'deleteElements', ids: ['r1'] });
    moveRight(store, 5);
    expect(problemOf(store.project)).toBe('apagado');
    expect(areaOf(store.project)).toBeCloseTo(before, 6);
    expect(issueCodes(store.project)).toContain('forro-ambiente-aberto');
  });

  it('forro desenhado à mão (sem ambiente) fica estático ao mover a parede', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    store.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', boundary: [{ x: 0.5, y: 0.5 }, { x: 3, y: 0.5 }, { x: 3, y: 2.5 }, { x: 0.5, y: 2.5 }] }) });
    const before = areaOf(store.project);
    moveRight(store, 5);
    expect(areaOf(store.project)).toBeCloseTo(before, 6);
    expect(problemOf(store.project)).toBeNull();
    expect(issueCodes(store.project)).not.toContain('forro-ambiente-aberto');
  });

  it('forro solto do ambiente (roomLinked falso) fica estático, mesmo com ambiente', () => {
    const store = salaComForro();
    store.exec({ type: 'detachCeilingRoom', id: 'c1' });
    const before = areaOf(store.project);
    moveRight(store, 5);
    expect(areaOf(store.project)).toBeCloseTo(before, 6);
    expect(ceilingOutline(store.project, ceilingOf(store.project)).problem).toBeNull();
  });

  it('forro antigo com roomId (sem o campo roomLinked) acompanha o ambiente', () => {
    const store = salaComForro();
    const c = store.project.elements.c1 as { roomLinked?: boolean };
    delete c.roomLinked;
    moveRight(store, 5);
    expect(areaOf(store.project)).toBeCloseTo((5 - T) * (3 - T), 6);
  });

  it('nível não editado não recalcula o espaço livre (cache por nível)', () => {
    const store = salaComForro();
    store.exec({ type: 'addWall', wall: makeWall({ id: 'other', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 0 }, b: { x: 2, y: 0 } }) });
    resolveCeilings(store.project, 'lv_0');
    resetCircuitRecalcCount();
    resolveCeilings(store.project, 'lv_0');
    expect(circuitRecalcCount()).toBe(0);
    moveRight(store, 5);
    resetCircuitRecalcCount();
    resolveCeilings(store.project, 'lv_1');
    expect(circuitRecalcCount()).toBe(0);
    resolveCeilings(store.project, 'lv_0');
    expect(circuitRecalcCount()).toBeGreaterThan(0);
  });

  it('ceilingRoomFor devolve o ambiente de origem quando ele existe', () => {
    const store = salaComForro();
    expect(ceilingRoomFor(store.project, ceilingOf(store.project))).toBe('r1');
  });

  it('ceilingRoomFor acha o ambiente que contém o forro quando o original foi apagado', () => {
    const store = salaComForro();
    store.exec({ type: 'deleteElements', ids: ['r1'] });
    store.exec({ type: 'addRoom', room: makeRoom({ id: 'r2', levelId: 'lv_0', name: 'Outra', number: '102', point: { x: 1, y: 1 } }) });
    expect(ceilingRoomFor(store.project, ceilingOf(store.project))).toBe('r2');
  });

  it('ceilingRoomFor devolve null quando nenhum ambiente contém o forro', () => {
    const store = salaComForro();
    store.exec({ type: 'deleteElements', ids: ['r1', 'wb', 'wr', 'wt', 'wl'] });
    expect(ceilingRoomFor(store.project, ceilingOf(store.project))).toBeNull();
  });
});
