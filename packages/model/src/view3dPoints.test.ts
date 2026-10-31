import { describe, expect, it } from 'vitest';
import {
  ProjectStore,
  cameraDaVista3D,
  createEmptyProject,
  defaultView3DPointName,
  emptyTitleBlock,
  makeView3DPoint,
  projectSheets,
  view3DPointOf,
  view3DPointsUsage,
  viewSourceIssue,
  type Sheet,
  type SheetView3DCamera,
} from './index.ts';

const CAM = (over: Partial<SheetView3DCamera> = {}): SheetView3DCamera => ({
  azimuth: -0.7,
  elevation: 0.45,
  distance: 18,
  target: { x: 2, y: 3, z: 1.5 },
  ortho: false,
  ...over,
});

const sheet = (id: string, viewports: Sheet['viewports'] = []): Sheet => ({
  id,
  number: 'A-101',
  name: '3D',
  size: 'A3',
  orientation: 'landscape',
  margin: 10,
  titleBlock: emptyTitleBlock(),
  viewports,
});

describe('pontos de vista 3D salvos', () => {
  it('cria com nome padrão e lê de volta', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(projectSheets(s.project)).toHaveLength(0);
    const nome = defaultView3DPointName(s.project);
    expect(nome).toBe('Vista 3D');
    const p = makeView3DPoint(CAM(), nome);
    s.exec({ type: 'addView3DPoint', point: p }, 'Salvar ponto de vista 3D');
    expect(view3DPointOf(s.project, p.id)?.camera).toEqual(CAM());
    expect(defaultView3DPointName(s.project)).toBe('Vista 3D 2');
  });

  it('recusa nome vazio e câmera com distância zero', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(() => s.exec({ type: 'addView3DPoint', point: makeView3DPoint(CAM(), '  ') })).toThrow(/nome/);
    expect(() => s.exec({ type: 'addView3DPoint', point: makeView3DPoint(CAM({ distance: 0 }), 'Corte') })).toThrow(/distância/);
  });

  it('atualiza nome e câmera, e a prancha que referencia o ponto acompanha', () => {
    const s = new ProjectStore(createEmptyProject());
    const p = makeView3DPoint(CAM(), 'Fachada');
    s.exec({ type: 'addView3DPoint', point: p });
    s.exec({ type: 'addSheet', sheet: sheet('sh1', [{ id: 'v1', view: { kind: '3d', pointId: p.id }, at: { x: 20, y: 20 }, size: { w: 180, h: 130 }, scale: 100 }]) });
    s.exec({ type: 'updateView3DPoint', id: p.id, patch: { name: 'Fachada norte', camera: CAM({ azimuth: 1.2, ortho: true }) } });
    expect(view3DPointOf(s.project, p.id)?.name).toBe('Fachada norte');
    const vp = projectSheets(s.project)[0]!.viewports[0]!;
    expect(cameraDaVista3D(s.project, vp.view as { kind: '3d'; pointId: string })).toEqual(CAM({ azimuth: 1.2, ortho: true }));
  });

  it('excluir o ponto copia a câmera para as vistas: a prancha não fica em branco, e o desfazer volta', () => {
    const s = new ProjectStore(createEmptyProject());
    const p = makeView3DPoint(CAM(), 'Perspectiva');
    s.exec({ type: 'addView3DPoint', point: p });
    s.exec({ type: 'addSheet', sheet: sheet('sh1', [{ id: 'v1', view: { kind: '3d', pointId: p.id }, at: { x: 20, y: 20 }, size: { w: 180, h: 130 }, scale: 100 }]) });
    expect(view3DPointsUsage(s.project, p.id)).toEqual([{ sheetId: 'sh1', viewportId: 'v1' }]);
    s.exec({ type: 'removeView3DPoint', id: p.id }, 'Excluir ponto de vista 3D');
    expect(view3DPointOf(s.project, p.id)).toBeUndefined();
    const vp = projectSheets(s.project)[0]!.viewports[0]!;
    expect(vp.view).toEqual({ kind: '3d', camera: CAM() });
    expect(viewSourceIssue(s.project, vp.view)).toBeNull();
    s.undo();
    expect(view3DPointOf(s.project, p.id)?.camera).toEqual(CAM());
    expect(projectSheets(s.project)[0]!.viewports[0]!.view).toEqual({ kind: '3d', pointId: p.id });
  });

  it('reordena só com a lista completa e sem repetição', () => {
    const s = new ProjectStore(createEmptyProject());
    const a = makeView3DPoint(CAM(), 'A');
    const b = makeView3DPoint(CAM(), 'B');
    s.exec({ type: 'addView3DPoint', point: a });
    s.exec({ type: 'addView3DPoint', point: b });
    expect(() => s.exec({ type: 'setView3DPointOrder', ids: [a.id] })).toThrow(/incompleta/);
    expect(() => s.exec({ type: 'setView3DPointOrder', ids: [a.id, a.id] })).toThrow(/incompleta/);
    s.exec({ type: 'setView3DPointOrder', ids: [b.id, a.id] });
    expect(s.project.view3dPoints?.map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it('vista sem ponto e sem câmera embutida resolve para null (enquadramento padrão)', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(cameraDaVista3D(s.project, { kind: '3d' })).toBeNull();
  });
});
