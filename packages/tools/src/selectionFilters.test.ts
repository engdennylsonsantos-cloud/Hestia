import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeLevel, makeWall, type Opening } from '@hestia/model';
import { idsOfCategory, idsOfType, selectedTypeId } from './selectionFilters.ts';

/** lv_0: parede A (tipo alv14) com porta; parede B (tipo outro) com janela. lv_1: parede C (alv14). */
function build() {
  const s = new ProjectStore(createEmptyProject());
  const base = s.project.wallTypes.wt_alv14!;
  s.exec({ type: 'upsertWallType', wallType: { ...structuredClone(base), id: 'wt_b', name: 'Outro' } });
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_1', name: 'Pav. 1', elevation: 3 }) });
  const wall = (id: string, typeId: string, levelId: string, ax: number, ay: number) =>
    makeWall({ id, typeId, levelId, a: { x: ax, y: ay }, b: { x: ax + 4, y: ay } });
  s.exec({ type: 'addWall', wall: wall('A', 'wt_alv14', 'lv_0', 0, 0) });
  s.exec({ type: 'addWall', wall: wall('B', 'wt_b', 'lv_0', 0, 5) });
  s.exec({ type: 'addWall', wall: wall('C', 'wt_alv14', 'lv_1', 0, 0) });
  const opening = (id: string, kind: 'door' | 'window', typeId: string, hostId: string): Opening => ({
    id, kind, typeId, hostId, offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '',
  });
  s.exec({ type: 'addOpening', opening: opening('d1', 'door', 'ot_p80', 'A') });
  s.exec({ type: 'addOpening', opening: opening('j1', 'window', 'ot_j120', 'B') });
  s.exec({ type: 'addOpening', opening: opening('d2', 'door', 'ot_p80', 'C') });
  return s.project;
}

describe('selecionar todas as instâncias do tipo (F9)', () => {
  it('paredes do mesmo tipo só no nível indicado', () => {
    const p = build();
    expect(idsOfType(p, 'lv_0', 'wt_alv14')).toEqual(['A']);
    expect(idsOfType(p, 'lv_1', 'wt_alv14')).toEqual(['C']);
  });

  it('aberturas do mesmo tipo seguem o nível do anfitrião', () => {
    const p = build();
    expect(idsOfType(p, 'lv_0', 'ot_p80')).toEqual(['d1']);
    expect(idsOfType(p, 'lv_1', 'ot_p80')).toEqual(['d2']);
  });

  it('tipo sem instâncias no nível devolve lista vazia', () => {
    expect(idsOfType(build(), 'lv_1', 'wt_b')).toEqual([]);
  });
});

describe('filtro por categoria', () => {
  it('paredes, portas e janelas do nível', () => {
    const p = build();
    expect(idsOfCategory(p, 'lv_0', 'walls').sort()).toEqual(['A', 'B']);
    expect(idsOfCategory(p, 'lv_0', 'doors')).toEqual(['d1']);
    expect(idsOfCategory(p, 'lv_0', 'windows')).toEqual(['j1']);
    expect(idsOfCategory(p, 'lv_1', 'windows')).toEqual([]);
  });
});

describe('tipo da seleção', () => {
  it('um tipo só devolve o tipo, mesmo com elementos de níveis diferentes', () => {
    expect(selectedTypeId(build(), ['d1', 'd2'])).toEqual({ typeId: 'ot_p80' });
    expect(selectedTypeId(build(), ['A', 'C'])).toEqual({ typeId: 'wt_alv14' });
  });
  it('tipos misturados recusam (parede de dois tipos ou parede com porta)', () => {
    expect('error' in selectedTypeId(build(), ['A', 'B'])).toBe(true);
    expect('error' in selectedTypeId(build(), ['A', 'd1'])).toBe(true);
  });
  it('seleção vazia ou só de ids desconhecidos recusa', () => {
    expect('error' in selectedTypeId(build(), [])).toBe(true);
    expect('error' in selectedTypeId(build(), ['zzz'])).toBe(true);
  });
});
