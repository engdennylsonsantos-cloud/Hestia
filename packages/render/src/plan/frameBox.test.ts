import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import { levelBox, levelFrameBox } from './build.ts';

const LV0 = 'lv_0';

describe('caixa de enquadramento da planta', () => {
  it('sem cotas, é a mesma caixa das paredes (levelBox)', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: LV0, a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    expect(levelFrameBox(s.project, LV0)).toEqual(levelBox(s.project, LV0));
  });

  it('com cota afastada da parede, a caixa cobre a linha de cota (a borda não corta a cota de baixo)', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: LV0, a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    // Cota abaixo da parede (lado direito do sentido a→b): offset negativo, 1,5 m para baixo.
    s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'c1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: -1.5 } });
    const box = levelFrameBox(s.project, LV0)!;
    expect(box.minY).toBeLessThanOrEqual(-1.5);
    expect(box.maxY).toBeGreaterThanOrEqual(0);
  });
});
