import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import { dxfLayerOfSlab, exportDxf, type DxfLevelGeometry, type DxfPoint } from './dxf.ts';

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

/** Polilinhas do arquivo: camada, flag de fechamento (70 bit 1) e vértices (códigos 10 e 20 de cada VERTEX). */
function polylines(text: string): Array<{ layer: string; closed: boolean; pts: DxfPoint[] }> {
  const out: Array<{ layer: string; closed: boolean; pts: DxfPoint[] }> = [];
  let cur: { layer: string; closed: boolean; pts: DxfPoint[] } | null = null;
  for (const r of records(text)) {
    const get = (c: number): string => r.fields.find(([k]) => k === c)?.[1] ?? '';
    if (r.type === 'POLYLINE') {
      cur = { layer: get(8), closed: (Number(get(70)) & 1) === 1, pts: [] };
    } else if (r.type === 'VERTEX' && cur) {
      cur.pts.push({ x: Number(get(10)), y: Number(get(20)) });
    } else if (r.type === 'SEQEND' && cur) {
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

const area = (pts: DxfPoint[]): number => {
  let s = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    s += p.x * q.y - q.x * p.y;
  });
  return Math.abs(s) / 2;
};

const project = buildTemplate('house2');
const square: DxfPoint[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];
const hole: DxfPoint[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 2, y: 2 },
  { x: 1, y: 2 },
];

describe('E4 · laje no DXF', () => {
  it('código do tipo vira camada LAJE_ sem acentos nem símbolos', () => {
    expect(dxfLayerOfSlab('LJ-12')).toBe('LAJE_LJ_12');
    expect(dxfLayerOfSlab('LJ-10C')).toBe('LAJE_LJ_10C');
    expect(dxfLayerOfSlab('Laje ção 15')).toBe('LAJE_LAJE_CAO_15');
    expect(dxfLayerOfSlab('  ')).toBe('LAJE_SEM_CODIGO');
  });

  it('laje com furo vira duas polilinhas fechadas na camada do tipo', () => {
    const geo: DxfLevelGeometry = { clusters: [], openings: [], slabs: [{ outline: square, holes: [hole], typeCode: 'LJ-12' }] };
    const text = exportDxf(project, 'lv_0', geo);
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual(['LAJE_LJ_12', 'LAJE_LJ_12']);
    expect(polys.every((p) => p.closed)).toBe(true);
    expect(polys.map((p) => p.pts.length)).toEqual([4, 4]);
    expect(area(polys[0]!.pts) - area(polys[1]!.pts)).toBeCloseTo(11, 6);
  });

  it('a camada entra na lista de camadas da tabela', () => {
    const geo: DxfLevelGeometry = { clusters: [], openings: [], slabs: [{ outline: square, holes: [], typeCode: 'LJ-15' }] };
    const text = exportDxf(project, 'lv_0', geo);
    const names = [...text.matchAll(/\r\n2\r\n(LAJE_[^\r]*)\r\n/g)].map((m) => m[1]);
    expect(names).toContain('LAJE_LJ_15');
  });

  it('lajes de tipos diferentes vão para camadas diferentes, e a ordem é a das lajes na lista', () => {
    const geo: DxfLevelGeometry = {
      clusters: [],
      openings: [],
      slabs: [
        { outline: square, holes: [], typeCode: 'LJ-12' },
        { outline: square, holes: [], typeCode: 'LJ-10C' },
      ],
    };
    expect(polylines(exportDxf(project, 'lv_0', geo)).map((p) => p.layer)).toEqual(['LAJE_LJ_12', 'LAJE_LJ_10C']);
  });

  it('sem lajes o arquivo não muda, e lajes não entram em outras camadas', () => {
    const base = exportDxf(project, 'lv_0', { clusters: [], openings: [] });
    expect(exportDxf(project, 'lv_0', { clusters: [], openings: [], slabs: [] })).toBe(base);
    expect(base).not.toContain('LAJE_');
  });
});
