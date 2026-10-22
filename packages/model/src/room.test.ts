import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoom, migrateProject, roomCeilingHeight, roomsOnLevel, SCHEMA_VERSION, type Room } from './index.ts';

const room = (id: string, point: { x: number; y: number } = { x: 0, y: 0 }, over: Partial<Omit<Room, 'order' | 'kind' | 'id'>> = {}): Omit<Room, 'order'> =>
  makeRoom({ id, levelId: 'lv_0', name: 'Sala', number: '101', point, ...over });

describe('makeRoom', () => {
  it('preenche os padrões (altura 0 e acabamentos vazios) e não atribui order', () => {
    const r = room('r1');
    expect(r).toMatchObject({ kind: 'room', heightOffset: 0, floorFinish: '', wallFinish: '', ceilingFinish: '' });
    expect(r).not.toHaveProperty('order');
  });
});

describe('roomsOnLevel', () => {
  it('filtra por nível e ordena pela ordem de criação', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoom', room: room('r2') });
    s.exec({ type: 'addRoom', room: room('r1') });
    s.exec({ type: 'addRoom', room: room('r3', { x: 0, y: 0 }, { levelId: 'lv_1' }) });
    expect(roomsOnLevel(s.project, 'lv_0').map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(roomsOnLevel(s.project, 'lv_1').map((r) => r.id)).toEqual(['r3']);
  });
});

describe('roomCeilingHeight', () => {
  it('usa o campo ceilingHeight ou, ausente, a altura padrão de parede', () => {
    const p = createEmptyProject();
    p.elements.a = { ...room('a'), order: 1 };
    p.elements.b = { ...room('b', { x: 0, y: 0 }, { ceilingHeight: 3 }), order: 2 };
    expect(roomCeilingHeight(p, p.elements.a as Room)).toBe(2.8);
    expect(roomCeilingHeight(p, p.elements.b as Room)).toBe(3);
  });
});

describe('comandos de ambiente', () => {
  it('addRoom exige nível existente', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(() => s.exec({ type: 'addRoom', room: makeRoom({ id: 'r', levelId: 'lv_x', name: 'Sala', number: '1', point: { x: 0, y: 0 } }) })).toThrow('Nível inexistente');
  });

  it('addRoom, updateRoom e removeRoom com desfazer e refazer', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoom', room: room('r') });
    expect(s.project.elements.r).toMatchObject({ kind: 'room', name: 'Sala' });
    s.exec({ type: 'updateRoom', id: 'r', patch: { name: 'Quarto' } });
    expect((s.project.elements.r as Room).name).toBe('Quarto');
    s.exec({ type: 'removeRoom', id: 'r' });
    expect(s.project.elements.r).toBeUndefined();
    s.undo();
    expect((s.project.elements.r as Room).name).toBe('Quarto');
    s.undo();
    expect((s.project.elements.r as Room).name).toBe('Sala');
    s.redo();
    expect((s.project.elements.r as Room).name).toBe('Quarto');
  });

  it('updateElements em lote altera ambientes', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoom', room: room('r1') });
    s.exec({ type: 'addRoom', room: room('r2') });
    s.exec({ type: 'updateElements', ids: ['r1', 'r2'], patch: { ceilingHeight: 3.2 } });
    expect((s.project.elements.r1 as Room).ceilingHeight).toBe(3.2);
    expect((s.project.elements.r2 as Room).ceilingHeight).toBe(3.2);
  });

  it('transform move só o ponto interior (o contorno é derivado do circuito)', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoom', room: room('r', { x: 1, y: 2 }) });
    s.exec({ type: 'transform', ids: ['r'], transform: { kind: 'translate', d: { x: 10, y: -4 } } });
    expect((s.project.elements.r as Room).point).toEqual({ x: 11, y: -2 });
  });
});

describe('migração 16 → 17 (ambientes)', () => {
  it('arquivo v16 sem ambientes avança a versão e preserva o restante', () => {
    const p = createEmptyProject();
    const legacy = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
    legacy.schemaVersion = 16;
    const m = migrateProject(legacy);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.elements).toEqual(p.elements);
  });

  it('ida e volta de JSON preserva os ambientes', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({
      type: 'addRoom',
      room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 1, y: 2 }, ceilingHeight: 3, floorFinish: 'Porcelanato', color: '#aabbcc' }),
    });
    const back = migrateProject(JSON.parse(JSON.stringify(s.project)));
    expect(back.elements).toEqual(s.project.elements);
    expect(back.elements.r1).toMatchObject({ kind: 'room', ceilingHeight: 3, floorFinish: 'Porcelanato', color: '#aabbcc' });
  });
});
