import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { computeSection } from '@hestia/engine';
import { ProjectStore, createEmptyProject, defaultStairTypeId, makeStair, makeWall, type StairCurve, type StairRun } from '@hestia/model';
import { LIGHT } from '../plan/types.ts';
import { buildSectionDrawList, type SectionInput } from './build.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

function stairProject() {
  const base = createEmptyProject();
  const store = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: 2.8 } : l)) });
  const xs = Array.from({ length: 16 }, (_, k) => k * 0.28);
  const run: StairRun = {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(-0.3, 0.6, 4.5, 0.6)],
    boundaryRight: [ln(-0.3, -0.6, 4.5, -0.6)],
    risers: xs.map((x) => ln(x, -1, x, 1)),
    path: [],
  };
  store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [run] }) });
  return store.project;
}

const input = (line: { a: Vec2; b: Vec2; depth: number }, zoom = 60): SectionInput => {
  const project = stairProject();
  return {
    project,
    section: computeSection(project, line),
    viewport: { cx: 2, cy: 1.4, zoom, width: 800, height: 600 },
    theme: LIGHT,
    dark: false,
    showGrid: false,
  };
};

describe('desenho do corte com escada', () => {
  it('o degrau cortado leva a cor e a hachura do material do tipo, com contorno pesado', () => {
    const draw = buildSectionDrawList(input({ a: v(-1, 0), b: v(6, 0), depth: 2 }));
    const hatched = draw.fills.filter((f) => f.hatch);
    expect(hatched.length).toBeGreaterThan(0);
    expect(hatched.some((f) => f.hatch?.kind === 'cross')).toBe(true);
    expect(draw.strokes.some((s) => s.closed && s.widthPx === 2.2)).toBe(true);
  });

  it('a elevação mostra cada degrau como contorno além do plano, sem hachura', () => {
    const draw = buildSectionDrawList(input({ a: v(-1, -3), b: v(6, -3), depth: 6 }));
    expect(draw.fills.filter((f) => f.hatch)).toHaveLength(0);
    // 15 degraus além do plano: cada um com preenchimento e contorno fino
    const thin = draw.strokes.filter((s) => s.closed && s.widthPx === 1);
    expect(thin.length).toBeGreaterThanOrEqual(15);
  });
});

/** Caixa de 6 × 4 m com janela em cada face e uma parede interna; vista de fora (y = −2). */
function boxProject() {
  const store = new ProjectStore(createEmptyProject());
  const walls = [
    ['frente', v(0, 0), v(6, 0)],
    ['fundo', v(6, 4), v(0, 4)],
    ['leste', v(6, 0), v(6, 4)],
    ['oeste', v(0, 4), v(0, 0)],
    ['interna', v(0, 2), v(6, 2)],
  ] as const;
  for (const [id, a, b] of walls) store.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, height: 3 }) });
  for (const host of ['frente', 'fundo', 'interna']) {
    store.exec({ type: 'addOpening', opening: { id: `j_${host}`, kind: 'window', typeId: 'ot_j120', hostId: host, offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  }
  return store.project;
}

describe('desenho do corte com linha oculta', () => {
  const GLASS = '#bfe3f5';
  const box = (): SectionInput => {
    const project = boxProject();
    return { project, section: computeSection(project, { a: v(0, -2), b: v(6, -2), depth: 8 }), viewport: { cx: 3, cy: 1.5, zoom: 60, width: 800, height: 600 }, theme: LIGHT, dark: false, showGrid: false };
  };

  it('a janela de trás e a da parede interna não são pintadas: só o vidro da face voltada ao observador', () => {
    const draw = buildSectionDrawList(box());
    expect(draw.fills.filter((f) => f.color === GLASS)).toHaveLength(1);
  });

  it('o corte é pintado por último, sobre o que está além', () => {
    const input = stairCut();
    const draw = buildSectionDrawList(input);
    const last = draw.fills.slice(-input.section.cut.length).map((f) => f.polygons);
    expect(last).toEqual(input.section.cut.map((c) => c.polygons));
  });
});

/** Corte transversal de uma escada: tem material cortado e itens além, para testar a ordem de pintura. */
function stairCut(): SectionInput {
  return input({ a: v(-1, 0), b: v(6, 0), depth: 2 });
}
