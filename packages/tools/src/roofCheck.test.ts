import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeRoof, ProjectStore } from '@hestia/model';
import { roofPatchProblem } from './roofCheck.ts';

const RECT = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];

describe('recusa de alteração de telhado', () => {
  it('a mensagem da mansarda segue as unidades do projeto', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'setSettings', patch: { units: { length: { unit: 'cm', decimals: 1 } } } });
    s.exec({
      type: 'addRoof',
      roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', slopePercent: 30, shape: 'hip', boundary: RECT, mansard: { lowerPercent: 100, upperPercent: 30, run: 4 } }),
    });
    expect(roofPatchProblem(s.project, ['r1'], { slopePercent: 30 })).toContain('400,0 cm');
  });
});
