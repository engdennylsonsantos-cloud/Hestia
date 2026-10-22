import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoom, validateProject } from './index.ts';

describe('validação de ambientes (modelo)', () => {
  it('nome vazio gera erro', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r', levelId: 'lv_0', name: '   ', number: '1', point: { x: 0, y: 0 } }) });
    const issues = validateProject(s.project).filter((i) => i.code === 'room-empty-name');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', elementId: 'r' });
  });

  it('nível inexistente gera erro (arquivo manipulado, pois o comando já recusa)', () => {
    const p = createEmptyProject();
    p.elements.r = { ...makeRoom({ id: 'r', levelId: 'lv_x', name: 'Sala', number: '1', point: { x: 0, y: 0 } }), order: 1 };
    const issues = validateProject(p).filter((i) => i.code === 'room-level-missing');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', elementId: 'r' });
  });

  it('ambiente saudável não gera problema de modelo', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoom', room: makeRoom({ id: 'r', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 1, y: 1 } }) });
    expect(validateProject(s.project).filter((i) => i.code.startsWith('room-'))).toEqual([]);
  });
});
