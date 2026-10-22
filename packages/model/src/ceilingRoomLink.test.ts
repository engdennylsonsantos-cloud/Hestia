import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, followsRoom, makeCeiling, makeRoom, type Ceiling } from './index.ts';
import { transformCeiling } from './transformPlanar.ts';

const sq = [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 0 }];

/** Projeto com um ambiente e um forro criado a partir dele (roomId, sem `roomLinked`). */
function comForroDeAmbiente(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 1.5 } }) });
  s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq, roomId: 'r1' }) });
  return s;
}

describe('vínculo do forro com o ambiente (decisão 0023 §13, P-5)', () => {
  it('forro com roomId acompanha; sem roomId ou com roomLinked falso, não', () => {
    expect(followsRoom({ roomId: 'r1' })).toBe(true);
    expect(followsRoom({ roomId: 'r1', roomLinked: true })).toBe(true);
    expect(followsRoom({ roomId: 'r1', roomLinked: false })).toBe(false);
    expect(followsRoom({ roomId: null })).toBe(false);
    expect(followsRoom({})).toBe(false);
  });

  it('soltar grava roomLinked falso e mantém o roomId; desfazer volta a acompanhar', () => {
    const s = comForroDeAmbiente();
    s.exec({ type: 'detachCeilingRoom', id: 'c1' });
    const c = s.project.elements.c1 as Ceiling;
    expect(c.roomLinked).toBe(false);
    expect(c.roomId).toBe('r1');
    s.undo();
    expect(followsRoom(s.project.elements.c1 as Ceiling)).toBe(true);
  });

  it('soltar um forro sem ambiente não muda nada', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c2', typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq }) });
    s.exec({ type: 'detachCeilingRoom', id: 'c2' });
    expect((s.project.elements.c2 as Ceiling).roomLinked).toBeUndefined();
  });

  it('relincular grava o ambiente escolhido e volta a acompanhar, com um só desfazer', () => {
    const s = comForroDeAmbiente();
    s.exec({ type: 'detachCeilingRoom', id: 'c1' });
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r2', levelId: 'lv_0', name: 'Outra', number: '102', point: { x: 1, y: 1 } }) });
    s.exec({ type: 'relinkCeilingRoom', id: 'c1', roomId: 'r2' });
    expect(s.project.elements.c1).toMatchObject({ roomId: 'r2', roomLinked: true });
    s.undo();
    expect(s.project.elements.c1).toMatchObject({ roomId: 'r1', roomLinked: false });
  });

  it('relincular exige um ambiente existente', () => {
    const s = comForroDeAmbiente();
    expect(() => s.exec({ type: 'relinkCeilingRoom', id: 'c1', roomId: 'nao_existe' })).toThrow();
    expect(() => s.exec({ type: 'detachCeilingRoom', id: 'nao_existe' })).toThrow();
  });

  it('mover o forro solta o vínculo; a cópia herda o vínculo', () => {
    const c = makeCeiling({ id: 'c1', typeId: 'ct_gesso', levelId: 'lv_0', boundary: sq, roomId: 'r1' }) as Ceiling;
    const t = { kind: 'translate' as const, d: { x: 1, y: 0 } };
    expect(transformCeiling({ ...c, order: 1 }, t).roomLinked).toBe(false);
    expect(transformCeiling({ ...c, order: 1 }, t, true).roomLinked).toBeUndefined();
  });
});
