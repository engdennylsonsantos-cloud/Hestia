import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_TYPE_ID, ProjectStore, createEmptyProject, type Grid, type Project } from '@hestia/model';
import { ARC_SEGMENTS, addGrids, axisFamily, axisPoints } from './ifcGrids.ts';
import { gid, type IfcCtx } from './ifcCtx.ts';
import { axis3 } from './ifcSolids.ts';
import { en, num, OMIT, ref, StepWriter } from './ifcStep.ts';

const TS = '1970-01-01T00:00:00';

function ctxOf(p: Project): IfcCtx {
  const w = new StepWriter();
  w.add('IFCSIUNIT', ['*', en('LENGTHUNIT'), OMIT, en('METRE')]);
  const world = axis3(w, [0, 0, 0]);
  const ctx = w.add('IFCGEOMETRICREPRESENTATIONCONTEXT', [OMIT, "'Model'", '3', num(1e-5), ref(world), OMIT]);
  return { p, w, ctx, storeys: new Map(), materials: new Map(), walls: new Map(), layerSets: new Map(), openingTypes: new Map(), openingTypeMembers: new Map(), external: new Set() };
}

const count = (text: string, type: string): number => (text.match(new RegExp(`=${type}\\(`, 'g')) ?? []).length;

function danglingRefs(text: string): number[] {
  const defined = new Set([...text.matchAll(/^#(\d+)=/gm)].map((m) => Number(m[1])));
  return [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])).filter((id) => !defined.has(id));
}

const grid = (id: string, name: string, over: Partial<Grid> = {}): Omit<Grid, 'order'> => ({
  id,
  name,
  typeId: DEFAULT_GRID_TYPE_ID,
  points: [
    { x: 0, y: 0 },
    { x: 0, y: 10 },
  ],
  sag: 0,
  bubbleStart: false,
  bubbleEnd: true,
  ...over,
});

function projectWithGrids(grids: Array<Omit<Grid, 'order'>>): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const g of grids) s.exec({ type: 'addGrid', grid: g });
  return s.project;
}

describe('axisPoints: amostragem do arco', () => {
  it('reta e multissegmento saem com os pontos gravados', () => {
    expect(axisPoints({ points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], sag: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
    const poly = axisPoints({ points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }], sag: 0 });
    expect(poly).toHaveLength(3);
  });

  it('flecha positiva amostra o arco à esquerda, com as pontas exatas e o meio na flecha', () => {
    const pts = axisPoints({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], sag: 1 });
    expect(pts).toHaveLength(ARC_SEGMENTS + 1);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[ARC_SEGMENTS]).toEqual({ x: 10, y: 0 });
    expect(pts[ARC_SEGMENTS / 2]!.y).toBeCloseTo(1, 6);
    expect(pts[ARC_SEGMENTS / 2]!.x).toBeCloseTo(5, 6);
  });

  it('flecha negativa amostra o arco à direita', () => {
    const pts = axisPoints({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], sag: -1 });
    expect(pts[ARC_SEGMENTS / 2]!.y).toBeCloseTo(-1, 6);
  });
});

describe('axisFamily', () => {
  it('letra vira U, número vira V e o resto vai em W', () => {
    expect(axisFamily('A')).toBe('U');
    expect(axisFamily('A1')).toBe('U');
    expect(axisFamily('1')).toBe('V');
    expect(axisFamily('12')).toBe('V');
    expect(axisFamily('')).toBe('W');
    expect(axisFamily('-1')).toBe('W');
  });
});

describe('addGrids', () => {
  const p = projectWithGrids([
    grid('ga', 'A'),
    grid('gb', 'B', { points: [{ x: 4, y: 0 }, { x: 4, y: 10 }] }),
    grid('g1', '1', { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }),
    grid('g2', '2', { points: [{ x: 0, y: 5 }, { x: 10, y: 5 }] }),
  ]);
  const c = ctxOf(p);
  addGrids(c);
  const text = c.w.text({ fileName: 'grades.ifc', timestamp: TS });

  it('um IFCGRID para o sistema, com um IFCGRIDAXIS por grade', () => {
    expect(count(text, 'IFCGRID')).toBe(1);
    expect(count(text, 'IFCGRIDAXIS')).toBe(4);
    expect(count(text, 'IFCPOLYLINE')).toBe(4);
    expect(text).toContain(gid('grid:ga'));
    expect(danglingRefs(text)).toEqual([]);
  });

  it('AxisTag é o nome da grade; U recebe letras e V recebe números', () => {
    for (const tag of ['A', 'B', '1', '2']) expect(text).toContain(`IFCGRIDAXIS('${tag}',`);
    const line = /IFCGRID\([^;]+\);/.exec(text)![0];
    // Os quatro eixos estão na lista do IFCGRID (dois em UAxes e dois em VAxes).
    expect((line.match(/#\d+/g) ?? []).length).toBe(1 + 4);
  });

  it('todos os eixos com SameSense verdadeiro e na origem do projeto', () => {
    expect((text.match(/\.T\.\);/g) ?? []).length).toBe(4);
    expect(count(text, 'IFCLOCALPLACEMENT')).toBe(1);
  });

  it('é determinístico', () => {
    const again = ctxOf(p);
    addGrids(again);
    expect(again.w.text({ fileName: 'grades.ifc', timestamp: TS })).toBe(text);
  });

  it('grade em arco sai amostrada em polilinha (a flecha não vira arco IFC)', () => {
    const arc = projectWithGrids([grid('arc', 'A', { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], sag: 1 })]);
    const ca = ctxOf(arc);
    addGrids(ca);
    const out = ca.w.text({ fileName: 'grade-arco.ifc', timestamp: TS });
    // 1 ponto da origem do mundo (contexto) + 1 da origem do IFCGRID + os pontos amostrados do arco.
    expect(count(out, 'IFCCARTESIANPOINT')).toBe(2 + ARC_SEGMENTS + 1);
    expect(count(out, 'IFCPOLYLINE')).toBe(1);
    expect(danglingRefs(out)).toEqual([]);
  });

  it('projeto sem grades não escreve nada', () => {
    const c0 = ctxOf(createEmptyProject());
    addGrids(c0);
    const out = c0.w.text({ fileName: 'vazio.ifc', timestamp: TS });
    expect(count(out, 'IFCGRID')).toBe(0);
    expect(count(out, 'IFCGRIDAXIS')).toBe(0);
  });
});
