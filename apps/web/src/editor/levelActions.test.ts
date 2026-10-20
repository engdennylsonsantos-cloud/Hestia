import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Floor, type Wall } from '@hestia/model';
import { levelBearingIds, moveToLevel, readLevelKeep, writeLevelKeep } from './levelActions.ts';

const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];

function store(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 1 }, b: { x: 3, y: 1 } }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: square }) });
  return s;
}

describe('moveToLevel (F6: Mover para o nível)', () => {
  it('move a seleção em um passo e informa a contagem no singular e no plural', () => {
    const s = store();
    const r = moveToLevel(s, ['w1', 'w2', 'f1'], 'lv_1', 'elevation', 'lv_1');
    expect(r).toEqual({ ok: true, moved: 3, message: '3 elementos movidos para Pavimento 2. Ctrl+Z desfaz.' });
    expect((s.project.elements.w1 as Wall).levelId).toBe('lv_1');
    expect((s.project.elements.f1 as Floor).levelId).toBe('lv_1');
    s.undo();
    expect((s.project.elements.w1 as Wall).levelId).toBe('lv_0');
    expect((s.project.elements.f1 as Floor).levelId).toBe('lv_0');
    const um = moveToLevel(s, ['w1'], 'lv_1', 'offset', 'lv_1');
    expect(um.message).toBe('1 elemento movido para Pavimento 2. Ctrl+Z desfaz.');
  });

  it('ids repetidos contam uma vez na mensagem', () => {
    const s = store();
    expect(moveToLevel(s, ['w1', 'w1'], 'lv_1', 'elevation', 'lv_1').message).toBe('1 elemento movido para Pavimento 2. Ctrl+Z desfaz.');
  });

  it('avisa quando o nível novo não é o da vista, sem mudar a vista', () => {
    const s = store();
    const r = moveToLevel(s, ['w1'], 'lv_1', 'elevation', 'lv_0');
    expect(r.message).toBe('1 elemento movido para Pavimento 2, fora do nível da vista. Ctrl+Z desfaz.');
  });

  it('ignora aberturas da seleção (acompanham a parede) e diz isso', () => {
    const s = store();
    const r = moveToLevel(s, ['w1', 'nao_existe_aberta'], 'lv_1', 'elevation', 'lv_1');
    expect(r.moved).toBe(1);
    expect(levelBearingIds(s.project, ['w1', 'nao_existe_aberta'])).toEqual(['w1']);
  });

  it('seleção vazia ou só de aberturas não faz nada', () => {
    const s = store();
    s.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'w1', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    expect(moveToLevel(s, [], 'lv_1', 'elevation', 'lv_0')).toMatchObject({ ok: false, moved: 0 });
    expect(moveToLevel(s, ['d1'], 'lv_1', 'elevation', 'lv_0')).toMatchObject({ ok: false, moved: 0 });
    expect(s.undoLabel).toBe('Inserir porta');
  });

  it('nível inexistente é recusado e nada muda', () => {
    const s = store();
    const r = moveToLevel(s, ['w1'], 'lv_x', 'elevation', 'lv_0');
    expect(r).toMatchObject({ ok: false, moved: 0, message: 'Nível inexistente.' });
    expect((s.project.elements.w1 as Wall).levelId).toBe('lv_0');
  });

  it('elementos já no nível dado não são contados nem geram passo de desfazer', () => {
    const s = store();
    const before = s.undoLabel;
    const r = moveToLevel(s, ['w1'], 'lv_0', 'elevation', 'lv_0');
    expect(r).toMatchObject({ ok: true, moved: 0, message: 'Já está em Térreo.' });
    expect(s.undoLabel).toBe(before);
  });
});

describe('preferência "Ao trocar" (memorizada no navegador)', () => {
  it('sem armazenamento (ambiente sem localStorage) vale manter a cota e não lança', () => {
    expect(readLevelKeep()).toBe('elevation');
    expect(() => writeLevelKeep('offset')).not.toThrow();
  });
});
