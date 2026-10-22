import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import { DXF_LAYER_CEILING, exportDxf, type DxfLevelGeometry, type DxfPoint } from './dxf.ts';

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

/** Camadas das polilinhas do arquivo (uma por POLYLINE). */
function polylineLayers(text: string): string[] {
  return records(text)
    .filter((r) => r.type === 'POLYLINE')
    .map((r) => r.fields.find(([k]) => k === 8)?.[1] ?? '');
}

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

describe('forro no DXF (decisão 0021)', () => {
  it('a camada é FORRO', () => {
    expect(DXF_LAYER_CEILING).toBe('FORRO');
  });

  it('forro com furo vira duas polilinhas fechadas na camada FORRO', () => {
    const geo: DxfLevelGeometry = { clusters: [], openings: [], ceilings: [{ outline: square, holes: [hole] }] };
    const text = exportDxf(project, 'lv_0', geo);
    expect(polylineLayers(text).filter((l) => l === 'FORRO')).toHaveLength(2);
    // A camada entra na tabela de camadas do arquivo.
    expect(text).toMatch(/TABLE[\s\S]*FORRO/);
  });

  it('sem forros, a camada não aparece', () => {
    const text = exportDxf(project, 'lv_0', { clusters: [], openings: [] });
    expect(text).not.toContain('FORRO');
  });
});
