import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import {
  DXF_LAYER_CONTOUR,
  DXF_LAYER_CORTES,
  DXF_LAYER_ELEVACOES,
  DXF_LAYER_OPENINGS,
  DXF_LAYER_OPENING_ABOVE,
  DXF_LAYER_ROOF_PROJECTION,
  DXF_LAYER_STAIR,
  DXF_LAYER_STAIR_ABOVE,
  DXF_LAYER_STAIR_ARROW,
  DXF_LAYER_STAIR_CUT,
  DXF_LAYER_WALL_ABOVE,
  dxfLayerOfMaterial,
  dxfLayersOf,
  dxfLineRoleOf,
  dxfLineWeight,
  exportDxf,
  type DxfLevelGeometry,
  type DxfPoint,
} from './dxf.ts';

const project = buildTemplate('house2');
const mat = Object.values(project.materials)[0]!;
const SQ: DxfPoint[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

/** Tabela LAYER lida do texto: nome da camada e o código 370 (`undefined` = a entrada não tem 370). */
function layerTable(text: string): Map<string, number | undefined> {
  const recs: Array<{ type: string; fields: Array<[string, string]> }> = [];
  const lines = text.split('\r\n');
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i]!.trim();
    const value = lines[i + 1]!.trim();
    if (code === '0') recs.push({ type: value, fields: [] });
    else recs.at(-1)?.fields.push([code, value]);
  }
  const out = new Map<string, number | undefined>();
  for (const r of recs) {
    if (r.type !== 'LAYER') continue;
    const field = (code: string): string | undefined => r.fields.find(([c]) => c === code)?.[1];
    const name = field('2');
    if (name === undefined) continue;
    const w = field('370');
    out.set(name, w === undefined ? undefined : Number(w));
  }
  return out;
}

describe('dxfLineWeight (larguras válidas do DXF, centésimos de mm)', () => {
  it('valor válido fica como está', () => {
    expect([0, 50, 70, 211].map(dxfLineWeight)).toEqual([0, 50, 70, 211]);
  });

  it('arredonda ao valor válido mais próximo', () => {
    expect(dxfLineWeight(36)).toBe(35);
    expect(dxfLineWeight(10)).toBe(9);
    expect(dxfLineWeight(53.4)).toBe(53);
  });

  it('empate vai ao maior valor (45 entre 40 e 50)', () => {
    expect(dxfLineWeight(45)).toBe(50);
  });

  it('fora da faixa válida vale o limite (250 → 211, negativo → 0)', () => {
    expect(dxfLineWeight(250)).toBe(211);
    expect(dxfLineWeight(-5)).toBe(0);
  });
});

describe('dxfLineRoleOf (categoria de cada camada da planta)', () => {
  it('paredes: contorno e material são corte; as de projeção e "além" são projeção', () => {
    expect(dxfLineRoleOf(DXF_LAYER_CONTOUR)).toEqual({ category: 'wall', view: 'cut' });
    expect(dxfLineRoleOf(dxfLayerOfMaterial('Alvenaria 14'))).toEqual({ category: 'wall', view: 'cut' });
    expect(dxfLineRoleOf(DXF_LAYER_WALL_ABOVE)).toEqual({ category: 'wall', view: 'projection' });
    expect(dxfLineRoleOf('PAREDE_ALEM')).toEqual({ category: 'wall', view: 'projection' });
  });

  it('vãos: ABERTURAS (portas e janelas juntas) é corte da janela; ABERTURA_* é projeção da janela', () => {
    expect(dxfLineRoleOf(DXF_LAYER_OPENINGS)).toEqual({ category: 'window', view: 'cut' });
    expect(dxfLineRoleOf(DXF_LAYER_OPENING_ABOVE)).toEqual({ category: 'window', view: 'projection' });
  });

  it('piso, laje, telhado e escada pelo prefixo; projeções de telhado e escada acima', () => {
    expect(dxfLineRoleOf('PISO_PS_01')).toEqual({ category: 'floor', view: 'cut' });
    expect(dxfLineRoleOf('LAJE_LJ_12')).toEqual({ category: 'slab', view: 'cut' });
    expect(dxfLineRoleOf('TELHADO_TL_01')).toEqual({ category: 'roof', view: 'cut' });
    expect(dxfLineRoleOf(DXF_LAYER_ROOF_PROJECTION)).toEqual({ category: 'roof', view: 'projection' });
    expect(dxfLineRoleOf(DXF_LAYER_STAIR)).toEqual({ category: 'stair', view: 'cut' });
    expect(dxfLineRoleOf(DXF_LAYER_STAIR_ABOVE)).toEqual({ category: 'stair', view: 'projection' });
  });

  it('marcas de escada (seta e símbolo de corte) são anotação; camada sem categoria é undefined', () => {
    expect(dxfLineRoleOf(DXF_LAYER_STAIR_ARROW)).toBe('annotation');
    expect(dxfLineRoleOf(DXF_LAYER_STAIR_CUT)).toBe('annotation');
    expect(dxfLineRoleOf('0')).toBeUndefined();
  });

  it('marcas de corte/elevação são desenho de anotação, com o peso de corte da categoria', () => {
    expect(dxfLineRoleOf(DXF_LAYER_CORTES)).toEqual({ category: 'annotation', view: 'cut' });
    expect(dxfLineRoleOf(DXF_LAYER_ELEVACOES)).toEqual({ category: 'annotation', view: 'cut' });
  });
});

describe('lineWeights no DXF R2000 (o 370 da tabela LAYER)', () => {
  const geo: DxfLevelGeometry = {
    clusters: [{ regions: [{ materialId: mat.id, polygons: [[SQ]] }], silhouette: [] }],
    openings: [{ center: { x: 2, y: 0 }, u: { x: 1, y: 0 }, width: 0.8, thickness: 0.14 }],
  };

  it('sem lineWeights cada camada sai com -3, o padrão do DXF', () => {
    const table = layerTable(exportDxf(project, 'lv_0', geo));
    expect(table.size).toBeGreaterThan(0);
    for (const [, w] of table) expect(w).toBe(-3);
  });

  it('com lineWeights a camada leva o valor em centésimos de mm (70 = 0,70 mm)', () => {
    const material = dxfLayerOfMaterial(mat.name);
    const table = layerTable(exportDxf(project, 'lv_0', { ...geo, lineWeights: { [material]: 70, [DXF_LAYER_OPENINGS]: 35 } }));
    expect(table.get(material)).toBe(70);
    expect(table.get(DXF_LAYER_OPENINGS)).toBe(35);
  });

  it('entrada de camada que não está na geometria não entra na tabela', () => {
    const text = exportDxf(project, 'lv_0', { ...geo, lineWeights: { PAREDE_INEXISTENTE: 50 } });
    expect(layerTable(text).has('PAREDE_INEXISTENTE')).toBe(false);
  });

  it('dxfLayersOf lista as camadas que a tabela LAYER leva, na ordem da tabela', () => {
    expect(dxfLayersOf(project, geo)).toEqual(['0', DXF_LAYER_OPENINGS, dxfLayerOfMaterial(mat.name)].sort());
    expect([...layerTable(exportDxf(project, 'lv_0', geo)).keys()]).toEqual(dxfLayersOf(project, geo));
  });
});
