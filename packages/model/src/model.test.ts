import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, migrateProject, newId, openingsOfWall, wallsOnLevel, coreRange, totalThickness, SchemaError, type Opening, type Wall } from './index.ts';

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

describe('migração de esquema', () => {
  it('migra um arquivo v1 (sem junções, flecha e configurações) para o atual', () => {
    const p = createEmptyProject('antigo');
    const raw = JSON.parse(JSON.stringify(p));
    raw.schemaVersion = 1;
    delete raw.settings;
    raw.elements = { w: { id: 'w', kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false, mark: '', comments: '', order: 1 } };
    const m = migrateProject(raw);
    const w = m.elements.w as Wall;
    expect(w.joinStart).toEqual({ kind: 'butt', flip: false });
    expect(w.sag).toBe(0);
    expect(m.settings.joinTolerance).toBeCloseTo(0.02);
    expect(m.schemaVersion).toBeGreaterThanOrEqual(3);
  });
});

describe('vistas de corte', () => {
  it('cria, altera, desfaz e migra v5 sem vistas', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addView', view: { id: 'v1', name: 'Corte AA', kind: 'section', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, depth: 5 } });
    s.exec({ type: 'updateView', id: 'v1', patch: { depth: 8 } });
    expect(s.project.views[0]!.depth).toBe(8);
    s.undo();
    expect(s.project.views[0]!.depth).toBe(5);
    s.exec({ type: 'deleteView', id: 'v1' });
    expect(s.project.views).toHaveLength(0);
    const raw = JSON.parse(JSON.stringify(createEmptyProject()));
    raw.schemaVersion = 5;
    delete raw.views;
    expect(migrateProject(raw).views).toEqual([]);
  });
});

describe('trocar a parede anfitriã de uma abertura (D7)', () => {
  const door = (id: string, hostId: string, offset: number) => ({ id, kind: 'door' as const, typeId: 'ot_p80', hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' });
  function setup() {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('A', 0, 0, 4, 0) });
    s.exec({ type: 'addWall', wall: wall('B', 0, 2, 6, 2) });
    s.exec({ type: 'addOpening', opening: door('d', 'A', 1) });
    return s;
  }
  const width = (s: ProjectStore) => s.project.openingTypes.ot_p80!.width;

  it('move a abertura para outra parede na posição dada e desfaz num passo', () => {
    const s = setup();
    s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'B', offset: 3 });
    const d = s.project.elements.d as Opening;
    expect(d.hostId).toBe('B');
    expect(d.offset).toBeCloseTo(3);
    expect(openingsOfWall(s.project, 'A')).toHaveLength(0);
    expect(openingsOfWall(s.project, 'B')).toHaveLength(1);
    s.undo();
    expect((s.project.elements.d as Opening).hostId).toBe('A');
  });

  it('reposiciona na mesma parede', () => {
    const s = setup();
    s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'A', offset: 2 });
    expect((s.project.elements.d as Opening).offset).toBeCloseTo(2);
  });

  it('recusa anfitriã que não é parede, sem alterar nada', () => {
    const s = setup();
    expect(() => s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'nada', offset: 1 })).toThrow('anfitriã');
    expect(() => s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'nada', offset: 1 })).toThrow();
    expect((s.project.elements.d as Opening).hostId).toBe('A');
  });

  it('recusa parede de outro nível', () => {
    const s = setup();
    s.exec({ type: 'upsertLevel', level: { id: 'lv_1', name: 'Pav. 1', elevation: 3 } });
    s.exec({ type: 'addWall', wall: { ...wall('C', 0, 0, 4, 0), levelId: 'lv_1' } });
    expect(() => s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'C', offset: 1 })).toThrow('mesmo nível');
  });

  it('recusa posição que deixaria o vão fora da parede', () => {
    const s = setup();
    expect(() => s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'B', offset: 0.05 })).toThrow('fora da parede');
    expect(() => s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'B', offset: 5.95 })).toThrow('fora da parede');
  });

  it('recusa parede que não comporta o vão', () => {
    const s = setup();
    s.exec({ type: 'addWall', wall: wall('curta', 0, 4, 0.3, 4) });
    expect(width(s)).toBeGreaterThan(0.3);
    expect(() => s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'curta', offset: 0.15 })).toThrow('não cabe');
  });

  it('recusa sobreposição com outra abertura da nova parede', () => {
    const s = setup();
    s.exec({ type: 'addOpening', opening: door('e', 'B', 3) });
    expect(() => s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'B', offset: 3 + width(s) / 2 - 0.1 })).toThrow('sobreporia');
    // encostado, sem sobrepor, passa
    s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'B', offset: 3 + width(s) });
    expect(openingsOfWall(s.project, 'B')).toHaveLength(2);
  });

  it('não conta a própria abertura como sobreposição', () => {
    const s = setup();
    s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'B', offset: 3 });
    s.exec({ type: 'setOpeningHost', id: 'd', hostId: 'B', offset: 3.2 });
    expect((s.project.elements.d as Opening).offset).toBeCloseTo(3.2);
  });
});
