import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { DEFAULT_AREA_GRAPHICS, DEFAULT_TAG_FIELDS, ProjectStore, createEmptyProject, makeRoom, makeWall, type AreaPlan, type Project } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import { buildPlanHoverOverlay, buildPlanLiveOverlay, buildPlanSelectionOverlay, type PlanInput } from './build.ts';
import { planFrameUpdateOf, type PlanViewState } from './planFrame.ts';
import { LIGHT } from './types.ts';

const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));

function project(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts = ring([[0, 0], [0, 5], [4, 5], [4, 0]]);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
  return s;
}

const plan = (over: Partial<AreaPlan> = {}): AreaPlan => ({
  id: 'ap1',
  name: 'Planta de área',
  levelId: 'lv_0',
  scale: 50,
  graphics: { ...DEFAULT_AREA_GRAPHICS, tagDefault: { ...DEFAULT_AREA_GRAPHICS.tagDefault, fields: [...DEFAULT_TAG_FIELDS] } },
  tags: [],
  ...over,
});

const entrada = (p: Project, areaPlan?: AreaPlan, selection: string[] = [], hover: string | null = null): PlanInput => ({
  project: p,
  levelId: 'lv_0',
  resolved: resolveLevel(p, 'lv_0'),
  below: null,
  areaPlan,
  viewport: { cx: 2, cy: 2.5, zoom: 100, width: 600, height: 400 },
  theme: LIGHT,
  dark: false,
  selection,
  hover,
  preview: [],
  inference: null,
  showGrid: false,
});

describe('planta de área · sobreposição compartilhada (A1)', () => {
  it('parede selecionada: mesmas contagens de destaque/alças da planta de piso', () => {
    const s = project();
    const piso = buildPlanSelectionOverlay(entrada(s.project, undefined, ['w0']));
    const area = buildPlanSelectionOverlay(entrada(s.project, plan(), ['w0']));
    expect({ fills: area.fills.length, strokes: area.strokes.length }).toEqual({ fills: piso.fills.length, strokes: piso.strokes.length });
    expect(area.fills.some((f) => f.color === LIGHT.select && f.alpha === 0.26)).toBe(true);
    expect(area.strokes.some((s) => s.widthPx === 2 && s.color === LIGHT.select)).toBe(true);
  });

  it('hover da parede: preenchimento na planta de área', () => {
    const s = project();
    const area = buildPlanHoverOverlay(entrada(s.project, plan(), [], 'w0'));
    expect(area.fills.length).toBeGreaterThan(0);
    expect(area.fills.some((f) => f.color === LIGHT.select && f.alpha === 0.16)).toBe(true);
  });

  it('caixa de seleção em arraste: fill e contorno tracejado [7, 5] também na área', () => {
    const s = project();
    const input = {
      ...entrada(s.project, plan()),
      preview: [{ kind: 'polygon', dashed: true, ring: ring([[0, 0], [4, 0], [4, 5], [0, 5]]) }],
    } as PlanInput;
    const live = buildPlanLiveOverlay(input);
    expect(live.fills.length).toBeGreaterThan(0);
    expect(live.strokes.some((st) => st.dash?.[0] === 7 && st.dash?.[1] === 5)).toBe(true);
  });

  it('ambiente selecionado: 1 fill + 1 stroke, sem duplicar com a sobreposição compartilhada', () => {
    const s = project();
    const area = buildPlanSelectionOverlay(entrada(s.project, plan(), ['r1']));
    expect(area.fills).toHaveLength(1);
    expect(area.strokes).toHaveLength(1);
    expect(area.fills[0]!.color).toBe(LIGHT.select);
    expect(area.fills[0]!.alpha).toBe(0.22);
  });

  it('rótulo em arraste: o fantasma do rótulo continua na camada viva', () => {
    const s = project();
    const live = buildPlanLiveOverlay({ ...entrada(s.project, plan()), tagGhost: { roomId: 'r1', at: { x: 8, y: 8 } } });
    expect(live.labels.some((l) => l.text === 'Sala')).toBe(true);
    expect(live.strokes.length).toBeGreaterThan(0);
  });

  it('caminho do app (planFrame): a sobreposição da área é a mesma da planta de piso', () => {
    const s = project();
    const estado = (over: Partial<PlanViewState> = {}): PlanViewState => ({
      project: s.project,
      version: 1,
      levelId: 'lv_0',
      v: { cx: 2, cy: 2.5, zoom: 100, width: 600, height: 400 },
      theme: LIGHT,
      dark: false,
      gpu: false,
      showGrid: false,
      showUnderlay: false,
      showRoofProjection: true,
      thinLines: false,
      selection: ['w0'],
      hover: 'w1',
      preview: [{ kind: 'polygon', dashed: true, ring: ring([[0, 0], [4, 0], [4, 5], [0, 5]]) }],
      inference: null,
      resolve: () => resolveLevel(s.project, 'lv_0'),
      ...over,
    });
    const piso = planFrameUpdateOf(estado());
    const area = planFrameUpdateOf(estado({ areaPlan: plan() }));
    expect({ fills: area.overlay().fills.length, strokes: area.overlay().strokes.length }).toEqual({ fills: piso.overlay().fills.length, strokes: piso.overlay().strokes.length });
    expect(area.hover!().fills.length).toBe(piso.hover!().fills.length);
    expect(area.live!().strokes.some((st) => st.dash?.[0] === 7)).toBe(true);
  });

  it('alças: a área mantém as mesmas alças da planta de piso porque o select move o elemento (ver teste em packages/tools)', () => {
    const s = project();
    const piso = buildPlanSelectionOverlay(entrada(s.project, undefined, ['w0']));
    const area = buildPlanSelectionOverlay(entrada(s.project, plan(), ['w0']));
    const alças = (ops: ReturnType<typeof buildPlanSelectionOverlay>): number => ops.fills.filter((f) => f.color === '#ffffff' && f.alpha === 1).length;
    expect(alças(area)).toBeGreaterThan(0);
    expect(alças(area)).toBe(alças(piso));
  });
});
