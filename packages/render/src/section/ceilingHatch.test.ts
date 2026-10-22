import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { computeSection } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeCeiling } from '@hestia/model';
import { LIGHT } from '../plan/types.ts';
import { buildSectionDrawList } from './build.ts';

const RECT: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];

/** Projeto com um forro de gesso (hachura 'gesso' no tipo) e a seção ao vivo, como em build.test.ts. */
function ceilingProject() {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addCeiling', ceiling: makeCeiling({ id: 'c', typeId: 'ct_gesso', levelId: 'lv_0', boundary: RECT, heightOffset: 2.6 }) });
  return s.project;
}

describe('hachura do forro no corte e na elevação (decisão 0021, D3)', () => {
  it('o corte do forro leva a hachura do tipo ("gesso"), mesmo com material sem hachura', () => {
    const project = ceilingProject();
    const line = { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 };
    const draw = buildSectionDrawList({ project, section: computeSection(project, line), viewport: { cx: 3, cy: 1.3, zoom: 60, width: 800, height: 600 }, theme: LIGHT, dark: false, showGrid: false });
    expect(draw.fills.some((f) => f.hatch?.kind === 'gesso')).toBe(true);
  });

  it('a elevação do forro (além do plano) também leva a hachura do tipo', () => {
    const project = ceilingProject();
    const line = { a: { x: -1, y: -2 }, b: { x: 7, y: -2 }, depth: 8 };
    const draw = buildSectionDrawList({ project, section: computeSection(project, line), viewport: { cx: 3, cy: 1.3, zoom: 60, width: 800, height: 600 }, theme: LIGHT, dark: false, showGrid: false });
    expect(draw.fills.some((f) => f.hatch?.kind === 'gesso')).toBe(true);
  });
});
