import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoof } from '@hestia/model';
import { roofPatchProblem } from './roofCheck.ts';

function store(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary, shape: 'hip', slopePercent: 30 }) });
  return s;
}

describe('mansarda pelo painel (roofPatchProblem)', () => {
  it('aceita uma mansarda que cabe', () => {
    expect(roofPatchProblem(store().project, ['r1'], { mansard: { lowerPercent: 100, upperPercent: 30, run: 2 } })).toBeNull();
  });
  it('recusa largura que chega ao centro, com mensagem em português', () => {
    expect(roofPatchProblem(store().project, ['r1'], { mansard: { lowerPercent: 100, upperPercent: 30, run: 4.5 } })).toMatch(/chega ao centro/);
  });
  it('recusa inclinação fora de (0, 300] e largura nula', () => {
    expect(roofPatchProblem(store().project, ['r1'], { mansard: { lowerPercent: 400, upperPercent: 30, run: 1 } })).toMatch(/entre 0 e 300/);
    expect(roofPatchProblem(store().project, ['r1'], { mansard: { lowerPercent: 100, upperPercent: 30, run: 0 } })).toMatch(/maior que zero/);
  });
});
