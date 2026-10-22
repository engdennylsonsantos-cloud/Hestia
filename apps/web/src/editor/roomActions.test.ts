import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, roomsOnLevel } from '@hestia/model';
import { addRoomsAllCircuits } from './roomActions.ts';
import { editor } from './controller.ts';
import { useUi } from './state.ts';

/** Retângulo de paredes 6 × 4 com uma divisória em x = 3: dois circuitos fechados. */
function dois(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const c = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
  c.forEach((a, i) => s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b: c[(i + 1) % 4]! }) }));
  s.exec({ type: 'addWall', wall: makeWall({ id: 'wd', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 3, y: 0 }, b: { x: 3, y: 4 } }) });
  return s;
}

describe('ambientes em todos os circuitos fechados (barra de opções)', () => {
  it('cria um por circuito num só passo de desfazer e não repete nos que já têm ambiente', () => {
    const s = dois();
    editor.load(s.project, 'teste.hestia.json');
    useUi.setState({ levelId: 'lv_0' });
    const r = addRoomsAllCircuits();
    expect(r.count).toBe(2);
    expect(roomsOnLevel(editor.project, 'lv_0').map((x) => x.number)).toEqual(['1', '2']);
    expect(useUi.getState().selection).toHaveLength(2);
    editor.store.undo();
    expect(roomsOnLevel(editor.project, 'lv_0')).toHaveLength(0);
    addRoomsAllCircuits();
    const again = addRoomsAllCircuits();
    expect(again.count).toBe(0);
    expect(again.message).toContain('já têm ambiente');
  });
});
