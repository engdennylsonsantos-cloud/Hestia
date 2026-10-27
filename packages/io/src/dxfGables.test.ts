import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import { DXF_LAYER_ROOF_BREAK, DXF_LAYER_ROOF_GABLE, DXF_LAYER_ROOF_RIDGE, exportDxf, type DxfLevelGeometry, type DxfPoint } from './dxf.ts';

/** Segmentos LINE do DXF: camada e extremos (pares de código/valor, um registro por código 0). */
function lines(text: string): Array<{ layer: string; a: DxfPoint; b: DxfPoint }> {
  const src = text.split(/\r?\n/);
  const recs: Array<Array<[number, string]>> = [];
  const types: string[] = [];
  for (let i = 0; i + 1 < src.length; i += 2) {
    const code = Number(src[i]!.trim());
    const value = src[i + 1]!.trim();
    if (code === 0) {
      types.push(value);
      recs.push([]);
    } else recs.at(-1)?.push([code, value]);
  }
  const out: Array<{ layer: string; a: DxfPoint; b: DxfPoint }> = [];
  types.forEach((t, k) => {
    if (t !== 'LINE') return;
    const f = recs[k]!;
    const get = (c: number): string => f.find(([code]) => code === c)?.[1] ?? '';
    out.push({ layer: get(8), a: { x: Number(get(10)), y: Number(get(20)) }, b: { x: Number(get(11)), y: Number(get(21)) } });
  });
  return out;
}

const project = buildTemplate('house2');
const ridge: [DxfPoint, DxfPoint] = [{ x: 3, y: 3 }, { x: 5, y: 3 }];
const gables: Array<[DxfPoint, DxfPoint]> = [
  [{ x: 0, y: 0 }, { x: 0, y: 6 }],
  [{ x: 8, y: 0 }, { x: 8, y: 6 }],
];

describe('E4 · empenas no DXF', () => {
  it('a empena vai para a camada TELHADO_EMPENA, separada da cumeeira', () => {
    const geo: DxfLevelGeometry = { clusters: [], openings: [], roofs: [{ outline: [], ridges: [ridge], gables, typeCode: 'TL-01' }] };
    const ls = lines(exportDxf(project, 'lv_0', geo));
    expect(DXF_LAYER_ROOF_GABLE).toBe('TELHADO_EMPENA');
    expect(ls.filter((l) => l.layer === DXF_LAYER_ROOF_GABLE)).toHaveLength(2);
    expect(ls.filter((l) => l.layer === DXF_LAYER_ROOF_RIDGE)).toHaveLength(1);
    expect(ls.filter((l) => l.layer === DXF_LAYER_ROOF_GABLE).map((l) => l.a.x).sort((p, q) => p - q)).toEqual([0, 8]);
  });

  it('sem empenas, nenhuma linha na camada de empena', () => {
    const geo: DxfLevelGeometry = { clusters: [], openings: [], roofs: [{ outline: [], ridges: [ridge], typeCode: 'TL-01' }] };
    expect(lines(exportDxf(project, 'lv_0', geo)).some((l) => l.layer === DXF_LAYER_ROOF_GABLE)).toBe(false);
  });

  it('a linha de desnível da mansarda vai para a camada TELHADO_DESNIVEL, não para a cumeeira', () => {
    const desnivel: [DxfPoint, DxfPoint] = [{ x: 1, y: 1 }, { x: 7, y: 1 }];
    const geo: DxfLevelGeometry = { clusters: [], openings: [], roofs: [{ outline: [], ridges: [ridge], breaks: [desnivel], typeCode: 'TL-01' }] };
    const ls = lines(exportDxf(project, 'lv_0', geo));
    expect(DXF_LAYER_ROOF_BREAK).toBe('TELHADO_DESNIVEL');
    expect(ls.filter((l) => l.layer === DXF_LAYER_ROOF_BREAK)).toHaveLength(1);
    expect(ls.filter((l) => l.layer === DXF_LAYER_ROOF_RIDGE)).toHaveLength(1);
  });
});
