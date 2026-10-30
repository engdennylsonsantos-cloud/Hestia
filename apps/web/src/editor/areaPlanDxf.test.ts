import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { createEmptyProject, DEFAULT_AREA_GRAPHICS, DEFAULT_TAG_FIELDS, makeRoom, makeWall, ProjectStore, type AreaPlan } from '@hestia/model';
import { areaPlanDxf } from './dxfExport.ts';

const ring = (pts: Array<[number, number]>): Vec2[] => pts.map(([x, y]) => ({ x, y }));

function project(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const pts = ring([[0, 0], [0, 5], [4, 5], [4, 0]]);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine: 'finishInterior' }) });
  });
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
  const plan: AreaPlan = {
    id: 'ap1',
    name: 'Planta de área',
    levelId: 'lv_0',
    scale: 50,
    graphics: { ...DEFAULT_AREA_GRAPHICS, tagDefault: { ...DEFAULT_AREA_GRAPHICS.tagDefault, fields: [...DEFAULT_TAG_FIELDS] } },
    tags: [],
  };
  s.exec({ type: 'addAreaPlan', plan });
  return s;
}

describe('DXF da planta de área', () => {
  it('sai com as camadas de ambiente, referência, chamada e texto', () => {
    const dxf = areaPlanDxf(project().project, 'ap1');
    expect(dxf).toContain('AMBIENTES_REFERENCIA');
    expect(dxf).toContain('AMBIENTES_TEXTO');
    expect(dxf).toContain('AMBIENTES');
    expect(dxf).toContain('Sala');
    // Fora do ASCII o R12 leva \U+XXXX (ver dxfEscapeText): "·" é \U+00B7 e "²" é \U+00B2.
    expect(dxf).toContain('101 \\U+00B7 20,00 m\\U+00B2');
    expect(dxf.startsWith('0\r\nSECTION')).toBe(true);
    expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true);
  });

  it('planta inexistente recusa', () => {
    expect(() => areaPlanDxf(project().project, 'nope')).toThrow('inexistente');
  });

  it('inclui o texto das cotas e dos textos de plan.annotations', () => {
    const s = project();
    s.exec({
      type: 'updateAreaPlan',
      id: 'ap1',
      patch: {
        annotations: {
          dimensions: [{ id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1, precision: 2 }],
          texts: [{ id: 't1', at: { x: 1, y: 1 }, text: 'Observação', height: 2.5, rotation: 0 }],
          detailLines: [{ id: 'dl1', a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }],
          detailRegions: [],
          tags: [],
        },
      },
    });
    const dxf = areaPlanDxf(s.project, 'ap1');
    expect(dxf).toContain('4,00 m');
    expect(dxf).toContain('Observa\\U+00E7\\U+00E3o');
  });
});
