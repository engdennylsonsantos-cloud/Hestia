import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { computeSection } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeSlab } from '@hestia/model';
import { LIGHT } from '../plan/types.ts';
import { buildSectionDrawList, type SectionInput } from './build.ts';

const RECT: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
const LINE = { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 };

function slabInput(): SectionInput {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_cobertura', levelId: 'lv_0', boundary: RECT }) });
  return {
    project: s.project,
    section: computeSection(s.project, LINE),
    viewport: { cx: 3, cy: 0, zoom: 60, width: 800, height: 600 },
    theme: LIGHT,
    dark: false,
    showGrid: false,
  };
}

describe('desenho do corte com membrana de laje (decisão 0023 §5)', () => {
  it('a membrana sai como linha tracejada aberta na cota da face, sem preenchimento próprio', () => {
    const input = slabInput();
    const draw = buildSectionDrawList(input);
    expect(input.section.membranes).toHaveLength(1);
    // Só a membrana usa o tracejado 6-3 aberto nesta cena (sem paredes nem aberturas além do plano).
    const line = draw.strokes.filter((st) => !st.closed && st.dash?.join() === '6,3');
    expect(line).toHaveLength(1);
    expect(line[0]!.pts).toEqual(input.section.membranes[0]!.pts);
  });
});
