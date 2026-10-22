import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoom, makeWall, ceilingsOnLevel } from '@hestia/model';
import { addCeilingsAllRooms } from './ceilingRoomActions.ts';
import { editor } from './controller.ts';
import { useUi } from './state.ts';

/** Retângulo de paredes 6 × 4 com uma divisória em x = 3: dois ambientes fechados. */
function dois(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const c = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
  c.forEach((a, i) => s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b: c[(i + 1) % 4]! }) }));
  s.exec({ type: 'addWall', wall: makeWall({ id: 'wd', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 3, y: 0 }, b: { x: 3, y: 4 } }) });
  return s;
}

describe('forro em todos os ambientes do nível (E6)', () => {
  it('cria um forro por ambiente num só passo de desfazer, e seleciona os novos', () => {
    const s = dois();
    editor.load(s.project, 'teste.hestia.json');
    editor.store.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'A', number: '1', point: { x: 1.5, y: 2 } }) });
    editor.store.exec({ type: 'addRoom', room: makeRoom({ id: 'r2', levelId: 'lv_0', name: 'B', number: '2', point: { x: 4.5, y: 2 } }) });
    useUi.setState({ levelId: 'lv_0' });
    const r = addCeilingsAllRooms();
    expect(r.count).toBe(2);
    expect(ceilingsOnLevel(editor.project, 'lv_0')).toHaveLength(2);
    expect(useUi.getState().selection).toHaveLength(2);
    editor.store.undo();
    expect(ceilingsOnLevel(editor.project, 'lv_0')).toHaveLength(0);
    expect(addCeilingsAllRooms().count).toBe(2);
    expect(addCeilingsAllRooms().count).toBe(0);
  });
});
