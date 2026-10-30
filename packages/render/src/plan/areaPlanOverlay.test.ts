import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { createEmptyProject, DEFAULT_AREA_GRAPHICS, DEFAULT_TAG_FIELDS, makeRoom, makeWall, ProjectStore, type AreaPlan } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import type { PreviewItem } from '@hestia/tools';
import { planFrameUpdateOf, resolucaoVazia, type PlanViewState } from './planFrame.ts';
import { LIGHT } from './types.ts';

const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));

function projeto(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts = ring([[0, 0], [0, 5], [4, 5], [4, 0]]);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
  return s;
}

const planta = (graphics: Partial<AreaPlan['graphics']> = {}): AreaPlan => ({
  id: 'ap1',
  name: 'Planta de área',
  levelId: 'lv_0',
  scale: 50,
  graphics: { ...DEFAULT_AREA_GRAPHICS, tagDefault: { ...DEFAULT_AREA_GRAPHICS.tagDefault, fields: [...DEFAULT_TAG_FIELDS] }, ...graphics },
  tags: [],
});

function estado(s: ProjectStore, over: Partial<PlanViewState>): PlanViewState {
  return {
    project: s.project, version: 1, levelId: 'lv_0', v: { cx: 2, cy: 2.5, zoom: 100, width: 600, height: 400 }, theme: LIGHT, dark: false, gpu: false,
    showGrid: false, showUnderlay: false, showRoofProjection: false, thinLines: false, selection: [], hover: null, preview: [], inference: null,
    resolve: (id) => (id === 'lv_0' ? resolveLevel(s.project, id) : resolucaoVazia(id)), ...over,
  };
}

describe('planta de área pelo mesmo caminho da planta de piso', () => {
  it('parede selecionada produz as alças (quadrados brancos nas pontas)', () => {
    const s = projeto();
    const u = planFrameUpdateOf(estado(s, { areaPlan: planta(), selection: ['w0'] }));
    const ov = u.overlay();
    const alcas = ov.fills.filter((f) => f.color === '#ffffff');
    expect(alcas.length).toBeGreaterThanOrEqual(2);
    expect(ov.fills.length).toBeGreaterThan(alcas.length);
  });

  it('parede oculta pelo perfil não gera destaque nem alças', () => {
    const s = projeto();
    const u = planFrameUpdateOf(estado(s, { areaPlan: planta({ showWalls: 'hidden' }), selection: ['w0'] }));
    expect(u.overlay().fills.filter((f) => f.color === '#ffffff')).toHaveLength(0);
  });

  it('prévia de ferramenta aparece na camada viva da planta de área', () => {
    const s = projeto();
    const preview: PreviewItem[] = [{ kind: 'line', a: { x: 0, y: 0 }, b: { x: 3, y: 0 } }];
    const u = planFrameUpdateOf(estado(s, { areaPlan: planta(), preview }));
    const live = u.live!();
    expect(live.strokes.length + live.fills.length + live.labels.length).toBeGreaterThan(0);
  });

  it('o destaque do ambiente continua além do caminho comum', () => {
    const s = projeto();
    const u = planFrameUpdateOf(estado(s, { areaPlan: planta(), selection: ['r1'] }));
    expect(u.overlay().fills.length).toBeGreaterThan(0);
  });

  it('mudar a visibilidade do perfil muda as chaves de cache', () => {
    const s = projeto();
    const a = planFrameUpdateOf(estado(s, { areaPlan: planta({ showWalls: 'light' }) }));
    const b = planFrameUpdateOf(estado(s, { areaPlan: planta({ showWalls: 'hidden' }) }));
    expect(a.geometryKey).not.toBe(b.geometryKey);
    expect(a.overlayKey).not.toBe(b.overlayKey);
    expect(a.liveKey).not.toBe(b.liveKey);
  });
});
