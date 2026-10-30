import { describe, expect, it } from 'vitest';
import { DEFAULT_AREA_GRAPHICS, ProjectStore, createEmptyProject, type AreaPlan } from '@hestia/model';
import { hiddenCreationWarning } from './profileWarning.ts';

const plan = (g: Partial<typeof DEFAULT_AREA_GRAPHICS>): AreaPlan => ({
  id: 'ap1', name: 'A', levelId: 'lv_0', scale: 50, graphics: { ...DEFAULT_AREA_GRAPHICS, ...g }, tags: [],
});

const wall = { type: 'addWall', wall: { id: 'w1', kind: 'wall', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, typeId: 'wt_alv14', locationLine: 'wallCenter', height: 2.8, baseOffset: 0 } } as never;

function run(g: Partial<typeof DEFAULT_AREA_GRAPHICS>) {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addAreaPlan', plan: plan(g) });
  const before = s.project;
  s.exec(wall);
  return hiddenCreationWarning(before, s.project, 'ap1');
}

describe('aviso R1 (criar em camada oculta pelo perfil)', () => {
  it('avisa ao criar parede com paredes ocultas', () => {
    expect(run({ showWalls: 'hidden' })).toMatch(/paredes/);
  });
  it('não avisa com a parede visível', () => {
    expect(run({ showWalls: 'normal' })).toBeNull();
  });
});
