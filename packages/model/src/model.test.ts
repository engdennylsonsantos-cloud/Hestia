import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, migrateProject, newId, openingsOfWall, wallsOnLevel, coreRange, totalThickness, SchemaError, type Wall } from './index.ts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by } });

describe('comandos e histórico', () => {
  it('cria, desfaz e refaz', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('w1', 0, 0, 4, 0) });
    expect(wallsOnLevel(s.project, 'lv_0')).toHaveLength(1);
    s.undo();
    expect(wallsOnLevel(s.project, 'lv_0')).toHaveLength(0);
    s.redo();
    expect(wallsOnLevel(s.project, 'lv_0')).toHaveLength(1);
  });
  it('transação vira um único passo', () => {
    const s = new ProjectStore(createEmptyProject());
    s.transaction('casa', () => {
      s.exec({ type: 'addWall', wall: wall('a', 0, 0, 4, 0) });
      s.exec({ type: 'addWall', wall: wall('b', 4, 0, 4, 3) });
    });
    expect(wallsOnLevel(s.project, 'lv_0')).toHaveLength(2);
    s.undo();
    expect(wallsOnLevel(s.project, 'lv_0')).toHaveLength(0);
  });
  it('abertura exige anfitriã e segue o dono ao excluir', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(() => s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'x', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } })).toThrow();
    s.exec({ type: 'addWall', wall: wall('w', 0, 0, 4, 0) });
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'w', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    expect(openingsOfWall(s.project, 'w')).toHaveLength(1);
    s.exec({ type: 'deleteElements', ids: ['w'] });
    expect(Object.keys(s.project.elements)).toHaveLength(0);
  });
  it('espelhar inverte o lado externo e copiar leva as aberturas', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('w', 0, 0, 4, 0) });
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'w', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    s.exec({ type: 'transform', ids: ['w'], transform: { kind: 'mirror', a: { x: 0, y: 1 }, b: { x: 1, y: 1 } }, copy: { idMap: { w: 'w2', d: 'd2' } } });
    const w2 = s.project.elements.w2 as Wall;
    expect(w2.a.y).toBeCloseTo(2);
    expect(w2.flipped).toBe(true);
    expect(openingsOfWall(s.project, 'w2')).toHaveLength(1);
  });
  it('não exclui tipo em uso', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('w', 0, 0, 4, 0) });
    expect(() => s.exec({ type: 'deleteWallType', id: 'wt_alv14' })).toThrow();
  });
});

describe('tipo de parede', () => {
  it('núcleo e espessura', () => {
    const p = createEmptyProject();
    const t = p.wallTypes.wt_alv14!;
    expect(totalThickness(t)).toBeCloseTo(0.184, 9);
    expect(coreRange(t)).toEqual({ first: 2, last: 2 });
  });
});

describe('arquivo', () => {
  it('migra o esquema atual e rejeita versão futura', () => {
    const p = createEmptyProject('x');
    expect(migrateProject(JSON.parse(JSON.stringify(p))).name).toBe('x');
    expect(() => migrateProject({ ...p, schemaVersion: 99 })).toThrow(SchemaError);
    expect(() => migrateProject(null)).toThrow(SchemaError);
  });
  it('ids únicos', () => {
    expect(newId('w')).not.toBe(newId('w'));
  });
});
