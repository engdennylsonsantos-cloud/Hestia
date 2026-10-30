import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { createEmptyProject, DEFAULT_AREA_GRAPHICS, DEFAULT_TAG_FIELDS, defaultStairTypeId, makeRoom, makeStair, makeWall, ProjectStore, type AreaPlan, type StairRun } from '@hestia/model';
import { generateStraightRun } from '@hestia/engine';
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

  it('inclui o modelo nas camadas da planta e a escada em ESCADA', () => {
    const s = project();
    const run = generateStraightRun({ start: { x: 6, y: 1 }, dir: { x: 1, y: 0 }, width: 1, risers: 16, tread: 0.28 });
    s.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: defaultStairTypeId, levelId: 'lv_0', components: [{ id: 'r1', kind: 'run', ...run } as StairRun] }) });
    const dxf = areaPlanDxf(s.project, 'ap1');
    expect(dxf).toContain('PAREDE');
    expect(dxf).toContain('ESCADA');
    expect(dxf).toContain('AMBIENTES');
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
