import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, validateProject, type Wall } from '@hestia/model';
import { miterCorners } from './cornerActions.ts';
import { useUi } from './state.ts';

function store(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'a', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'b', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 3 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'c', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 0 }, b: { x: 0, y: 3 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'd', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 3 }, b: { x: 4, y: 3 } }) });
  return s;
}

const corners = (s: ProjectStore) => validateProject(s.project).filter((i) => i.code === 'wall-corner-butt-finish');
const status = () => useUi.getState().status;

describe('miterCorners (quinas em esquadria, lote)', () => {
  it('converte as quinas de todos os níveis, conta e zera os avisos', () => {
    const s = store();
    expect(corners(s)).toHaveLength(2);
    expect(miterCorners(s)).toBe(2);
    expect(status()).toBe('2 quinas passaram para esquadria. Ctrl+Z desfaz.');
    expect(corners(s)).toEqual([]);
    expect((s.project.elements['b'] as Wall).joinStart.kind).toBe('miter');
  });

  it('é um só passo de desfazer', () => {
    const s = store();
    miterCorners(s);
    s.undo();
    expect(corners(s)).toHaveLength(2);
  });

  it('segunda chamada não faz nada (idempotente)', () => {
    const s = store();
    miterCorners(s);
    const before = s.project;
    expect(miterCorners(s)).toBe(0);
    expect(status()).toBe('Nenhuma quina em encosto ou esquadro com acabamento.');
    expect(s.project).toBe(before);
  });

  it('com parede informada, converte só as quinas dela', () => {
    const s = store();
    expect(miterCorners(s, 'd')).toBe(1);
    expect(status()).toBe('1 quina passou para esquadria. Ctrl+Z desfaz.');
    expect(corners(s)).toHaveLength(1);
    expect(miterCorners(s, 'd')).toBe(0);
    expect(status()).toBe('Esta parede não tem quina em encosto ou esquadro com acabamento.');
  });

  it('quina em esquadro com acabamento também entra no lote, em um passo', () => {
    const s = new ProjectStore(createEmptyProject());
    const SQ = { kind: 'square' as const, flip: false };
    s.exec({ type: 'addWall', wall: makeWall({ id: 'a', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, joinEnd: SQ }) });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'b', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 3 }, joinStart: SQ }) });
    expect(corners(s)).toHaveLength(1);
    expect(miterCorners(s)).toBe(1);
    expect(status()).toBe('1 quina passou para esquadria. Ctrl+Z desfaz.');
    expect(corners(s)).toEqual([]);
    expect((s.project.elements['a'] as Wall).joinEnd.kind).toBe('miter');
    expect(miterCorners(s)).toBe(0);
    expect(status()).toBe('Nenhuma quina em encosto ou esquadro com acabamento.');
  });
});
