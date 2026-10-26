import { describe, expect, it } from 'vitest';
import { resolveLevel } from '@hestia/engine';
import { boundaryKindsOf } from '@hestia/engine/src/roofShapes.ts';
import { ProjectStore, createEmptyProject, makeRoof, type Project, type Roof } from '@hestia/model';
import { buildPlanDrawList, type PlanInput } from './build.ts';
import { roofFills, roofSelectionOps } from './roofs.ts';
import { defaultPaint } from './style.ts';
import { DARK, LIGHT, type StrokeOp } from './types.ts';
import type { Viewport } from '../viewport.ts';

const P = (x: number, y: number) => ({ x, y });
const VIEW: Viewport = { cx: 4, cy: 3, zoom: 100, width: 800, height: 600 };
const RECT = [P(-0.3, -0.3), P(8.3, -0.3), P(8.3, 6.3), P(-0.3, 6.3)];

/** Projeto com um telhado; `roof` é o que `makeRoof` monta (sem a ordem, que o comando põe). */
function projetoCom(roof: ReturnType<typeof makeRoof>): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof });
  return s.project;
}

function input(p: Project, over: Partial<PlanInput> = {}): PlanInput {
  return {
    project: p,
    levelId: 'lv_0',
    resolved: resolveLevel(p, 'lv_0', new Map()),
    below: null,
    viewport: VIEW,
    theme: LIGHT,
    dark: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: false,
    ...over,
  };
}

describe('símbolo "define inclinação" coerente com o motor', () => {
  it('telhado criado com makeRoof de forma gable e 4 arestas a 30 %: só as beiradas recebem triângulo cheio', () => {
    const p = projetoCom(makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: RECT, heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: P(1, 0) }));
    // Arestas 0 e 2 seguem x (beiradas); 1 e 3 são empenas, pela leitura do motor.
    const kinds = boundaryKindsOf(p.elements.r as Roof);
    expect(kinds).toEqual(['eave', 'gable', 'eave', 'gable']);

    const o = roofSelectionOps(p, 'lv_0', ['r'], null, LIGHT, VIEW);
    expect(o.fills.filter((f) => f.color === LIGHT.accent)).toHaveLength(2);
    expect(o.strokes.filter((s) => s.closed && s.pts.length === 3 && s.color === LIGHT.inkSoft)).toHaveLength(2);

    // Os percentuais saem no meio das arestas de beiral (0 e 2), e não nas empenas.
    const at = o.labels.filter((l) => l.text === '30 %').map((l) => l.at);
    expect(at).toHaveLength(2);
    expect(at[0]!.x).toBeCloseTo(4, 9);
    expect(at[0]!.y).toBeCloseTo(-0.3, 9);
    expect(at[1]!.x).toBeCloseTo(4, 9);
    expect(at[1]!.y).toBeCloseTo(6.3, 9);
  });

  it('o contorno selecionado tracejado nas empenas segue o motor (2 corridas tracejadas, uma em cada empena)', () => {
    const p = projetoCom(makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: RECT, heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: P(1, 0) }));
    const o = roofSelectionOps(p, 'lv_0', ['r'], null, LIGHT, VIEW);
    expect(o.strokes.filter((s) => s.dash && s.color === LIGHT.select)).toHaveLength(2);
  });
});

describe('pegada tracejada rosa com balanço', () => {
  const FOOT = [P(0, 0), P(4, 0), P(4, 2), P(0, 2)];
  const EAVE = [P(-0.5, -0.5), P(4.5, -0.5), P(4.5, 2.5), P(-0.5, 2.5)];
  const roofCom = (over: Partial<Parameters<typeof makeRoof>[0]>) =>
    projetoCom(makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: EAVE, footprint: FOOT, edgeOverhangs: [0.5, 0.5, 0.5, 0.5], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: P(1, 0), ...over }));
  const rosas = (strokes: StrokeOp[]) => strokes.filter((s) => s.color === LIGHT.roofFootprint);

  it('telhado visível com footprint 4×2 e balanço 0,5: uma linha tracejada rosa na espessura de projeção no contorno da pegada', () => {
    const fills = roofFills(roofCom({}), 'lv_0', LIGHT, false, 'medium', VIEW);
    const pink = rosas(fills.strokes);
    expect(pink).toHaveLength(1);
    expect(pink[0]!.pts).toEqual(FOOT);
    expect(pink[0]!.closed).toBe(true);
    expect(pink[0]!.widthPx).toBe(defaultPaint('roof', 100).projPx);
    expect(pink[0]!.dash).toEqual([6, 3]);
  });

  it('telhado oculto (fora do intervalo de vista) também mostra a pegada; a planta inteira a inclui', () => {
    const p = roofCom({});
    expect(rosas(roofFills(p, 'lv_0', LIGHT, false, 'medium', VIEW, { hidden: new Set(['r']) }).strokes)).toHaveLength(1);
    expect(rosas(buildPlanDrawList(input(p)).strokes).length).toBeGreaterThanOrEqual(1);
  });

  it('sem balanço, nenhuma linha rosa', () => {
    const p = roofCom({ edgeOverhangs: [0, 0, 0, 0], boundary: FOOT });
    expect(rosas(roofFills(p, 'lv_0', LIGHT, false, 'medium', VIEW).strokes)).toHaveLength(0);
    expect(rosas(buildPlanDrawList(input(p)).strokes)).toHaveLength(0);
  });

  it('projeção de telhado oculto sem balanço é tinta, não rosa; com balanço, a projeção sai rosa', () => {
    const semBalanco = roofCom({ edgeOverhangs: [0, 0, 0, 0], boundary: FOOT });
    const proj = roofFills(semBalanco, 'lv_0', LIGHT, false, 'medium', VIEW, { hidden: new Set(['r']), showProjection: true }).strokes;
    expect(proj.filter((s) => s.dash && s.closed)).toHaveLength(1);
    expect(proj.filter((s) => s.dash && s.closed)[0]!.color).toBe(LIGHT.ink);
    const comBalanco = roofFills(roofCom({}), 'lv_0', LIGHT, false, 'medium', VIEW, { hidden: new Set(['r']), showProjection: true }).strokes;
    expect(comBalanco.filter((s) => s.dash && s.closed && s.color === LIGHT.roofFootprint)).toHaveLength(2);
  });

  it('sem footprint gravado, nenhuma linha rosa mesmo com balanço', () => {
    const p = roofCom({ footprint: undefined });
    expect(rosas(roofFills(p, 'lv_0', LIGHT, false, 'medium', VIEW).strokes)).toHaveLength(0);
  });

  it('no tema escuro a pegada usa #ff6fb0; no claro, #c2185b', () => {
    expect(LIGHT.roofFootprint).toBe('#c2185b');
    expect(DARK.roofFootprint).toBe('#ff6fb0');
    const dark = roofFills(roofCom({}), 'lv_0', DARK, true, 'medium', VIEW);
    expect(rosas(dark.strokes)).toHaveLength(0); // a cor clara não aparece no escuro
    expect(dark.strokes.filter((s) => s.color === DARK.roofFootprint)).toHaveLength(1);
  });
});
