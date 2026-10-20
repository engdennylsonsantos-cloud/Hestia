import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import { dxfLayerOfRoof, exportDxf, type DxfLevelGeometry, type DxfPoint } from './dxf.ts';

type Rec = { type: string; fields: Array<[number, string]> };

/** Registros do DXF: cada código 0 abre um registro com seus pares código/valor. */
function records(text: string): Rec[] {
  const lines = text.split(/\r?\n/);
  const recs: Rec[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]!.trim());
    const value = lines[i + 1]!.trim();
    if (code === 0) recs.push({ type: value, fields: [] });
    else recs.at(-1)?.fields.push([code, value]);
  }
  return recs;
}

/** Polilinhas: camada, flag de fechamento e vértices. */
function polylines(text: string): Array<{ layer: string; closed: boolean; pts: DxfPoint[] }> {
  const out: Array<{ layer: string; closed: boolean; pts: DxfPoint[] }> = [];
  let cur: { layer: string; closed: boolean; pts: DxfPoint[] } | null = null;
  for (const r of records(text)) {
    const get = (c: number): string => r.fields.find(([k]) => k === c)?.[1] ?? '';
    if (r.type === 'POLYLINE') cur = { layer: get(8), closed: (Number(get(70)) & 1) === 1, pts: [] };
    else if (r.type === 'VERTEX' && cur) cur.pts.push({ x: Number(get(10)), y: Number(get(20)) });
    else if (r.type === 'SEQEND' && cur) {
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

/** Segmentos LINE: camada e extremos. */
function lines(text: string): Array<{ layer: string; a: DxfPoint; b: DxfPoint }> {
  return records(text)
    .filter((r) => r.type === 'LINE')
    .map((r) => {
      const get = (c: number): number => Number(r.fields.find(([k]) => k === c)?.[1] ?? NaN);
      return {
        layer: r.fields.find(([k]) => k === 8)?.[1] ?? '',
        a: { x: get(10), y: get(20) },
        b: { x: get(11), y: get(21) },
      };
    });
}

const project = buildTemplate('house2');
/** Contorno de beiral 8 x 6 e cumeeira de 2 m, com os quatro espigões de um telhado de quatro águas. */
const outline: DxfPoint[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 6 },
  { x: 0, y: 6 },
];
const ridges: Array<[DxfPoint, DxfPoint]> = [
  [{ x: 3, y: 3 }, { x: 5, y: 3 }],
  [{ x: 0, y: 0 }, { x: 3, y: 3 }],
  [{ x: 8, y: 0 }, { x: 5, y: 3 }],
  [{ x: 0, y: 6 }, { x: 3, y: 3 }],
  [{ x: 8, y: 6 }, { x: 5, y: 3 }],
];

describe('E4 · telhado no DXF', () => {
  it('código do tipo vira camada TELHADO_ sem acentos nem símbolos', () => {
    expect(dxfLayerOfRoof('TL-01')).toBe('TELHADO_TL_01');
    expect(dxfLayerOfRoof('TL-02')).toBe('TELHADO_TL_02');
    expect(dxfLayerOfRoof('  ')).toBe('TELHADO_SEM_CODIGO');
  });

  it('contorno do beiral vira POLYLINE fechada na camada do tipo', () => {
    const geo: DxfLevelGeometry = { clusters: [], openings: [], roofs: [{ outline, ridges: [], typeCode: 'TL-01' }] };
    const polys = polylines(exportDxf(project, 'lv_0', geo));
    expect(polys).toHaveLength(1);
    expect(polys[0]!.layer).toBe('TELHADO_TL_01');
    expect(polys[0]!.closed).toBe(true);
    expect(polys[0]!.pts).toEqual(outline.map((q) => expect.objectContaining({ x: q.x, y: q.y })));
  });

  it('cumeeira, espigões e rincões viram LINEs na camada TELHADO_CUMEEIRA, com as coordenadas dos extremos', () => {
    const geo: DxfLevelGeometry = { clusters: [], openings: [], roofs: [{ outline, ridges, typeCode: 'TL-01' }] };
    const text = exportDxf(project, 'lv_0', geo);
    const ls = lines(text);
    expect(ls).toHaveLength(5);
    expect(ls.every((l) => l.layer === 'TELHADO_CUMEEIRA')).toBe(true);
    expect(ls[0]!.a).toEqual({ x: 3, y: 3 });
    expect(ls[0]!.b).toEqual({ x: 5, y: 3 });
    const len = ls.reduce((s, l) => s + Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y), 0);
    expect(len).toBeCloseTo(2 + 4 * Math.sqrt(18), 6);
    const names = [...text.matchAll(/\r\n2\r\n(TELHADO_[^\r]*)\r\n/g)].map((m) => m[1]);
    expect(names).toEqual(expect.arrayContaining(['TELHADO_CUMEEIRA', 'TELHADO_TL_01']));
  });

  it('sem telhados o arquivo não muda, e a camada da cumeeira não aparece', () => {
    const base = exportDxf(project, 'lv_0', { clusters: [], openings: [] });
    expect(exportDxf(project, 'lv_0', { clusters: [], openings: [], roofs: [] })).toBe(base);
    expect(base).not.toContain('TELHADO_');
    const onlyOutline = exportDxf(project, 'lv_0', { clusters: [], openings: [], roofs: [{ outline, ridges: [], typeCode: 'TL-01' }] });
    expect(onlyOutline).not.toContain('TELHADO_CUMEEIRA');
  });
});
