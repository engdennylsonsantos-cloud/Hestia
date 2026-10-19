import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, wallsOnLevel, type Wall } from '@hestia/model';
import { Transfer } from './transfer.ts';
import { useUi } from './state.ts';

function setup() {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: { id: 'lv_1', name: 'Pav. 1', elevation: 3 } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'A', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'B', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 9 }, b: { x: 2, y: 9 } }) });
  useUi.setState({ selection: ['A'], levelId: 'lv_0' });
  return s;
}

describe('transferência do editor (copiar, colar alinhado, mesmo tipo)', () => {
  it('copia a seleção e cola alinhado no nível pedido, selecionando o resultado', () => {
    const s = setup();
    const t = new Transfer();
    expect(t.copy(s.project, ['A'])).toBe(true);
    expect(t.paste(s, 'lv_1')).toBe(true);
    const onLv1 = wallsOnLevel(s.project, 'lv_1') as Wall[];
    expect(onLv1).toHaveLength(2);
    expect(onLv1[1]!.a).toEqual({ x: 0, y: 0 });
    expect(useUi.getState().selection).toHaveLength(1);
    s.undo();
    expect(wallsOnLevel(s.project, 'lv_1')).toHaveLength(1);
  });

  it('copiar sem parede mantém o buffer anterior', () => {
    const s = setup();
    const t = new Transfer();
    t.copy(s.project, ['A']);
    expect(t.copy(s.project, [])).toBe(false);
    expect(t.paste(s, 'lv_1')).toBe(true);
  });

  it('colar sem nada copiado não altera o modelo', () => {
    const s = setup();
    expect(new Transfer().paste(s, 'lv_1')).toBe(false);
    expect(wallsOnLevel(s.project, 'lv_1')).toHaveLength(1);
  });

  it('mesmo tipo seleciona todas do tipo no nível ativo', () => {
    const s = setup();
    useUi.setState({ selection: ['A'], levelId: 'lv_0' });
    expect(new Transfer().sameType(s.project, 'lv_0')).toBe(1);
    expect(useUi.getState().selection).toEqual(['A']);
  });

  it('mesmo tipo com seleção vazia informa e não seleciona', () => {
    const s = setup();
    useUi.setState({ selection: [], levelId: 'lv_0' });
    expect(new Transfer().sameType(s.project, 'lv_0')).toBe(0);
    expect(useUi.getState().status).toMatch(/Selecione/);
  });
});
