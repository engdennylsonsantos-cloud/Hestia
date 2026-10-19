import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import { DXF_LAYER_CONTOUR, DXF_LAYER_OPENINGS, dxfLayerOfMaterial, exportDxf, type DxfLevelGeometry, type DxfPoint } from './dxf.ts';

type Rec = { type: string; fields: Array<[number, string]> };

/** Leitor mínimo: pares código/valor agrupados por registro (cada código 0 abre um registro). */
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

interface Poly {
  layer: string;
  closed: boolean;
  pts: DxfPoint[];
}

function polylines(text: string): Poly[] {
  const out: Poly[] = [];
  let cur: Poly | null = null;
  for (const r of records(text)) {
    if (r.type === 'POLYLINE') {
      const layer = r.fields.find(([c]) => c === 8)?.[1] ?? '';
      const flags = Number(r.fields.find(([c]) => c === 70)?.[1] ?? 0);
      cur = { layer, closed: (flags & 1) === 1, pts: [] };
    } else if (r.type === 'VERTEX' && cur) {
      cur.pts.push({ x: Number(r.fields.find(([c]) => c === 10)?.[1]), y: Number(r.fields.find(([c]) => c === 20)?.[1]) });
    } else if (r.type === 'SEQEND' && cur) {
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

const layerNames = (text: string): string[] =>
  records(text)
    .filter((r) => r.type === 'LAYER')
    .map((r) => r.fields.find(([c]) => c === 2)?.[1] ?? '')
    .sort();

const headerVar = (text: string, name: string): string | undefined => {
  const h = records(text).find((r) => r.type === 'SECTION' && r.fields.some(([, v]) => v === 'HEADER'));
  const i = h?.fields.findIndex(([c, v]) => c === 9 && v === name) ?? -1;
  return i >= 0 ? h?.fields[i + 1]?.[1] : undefined;
};

/** Área com sinal (shoelace): só o módulo interessa aqui. */
const area = (pts: DxfPoint[]): number => {
  let s = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    s += p.x * q.y - q.x * p.y;
  });
  return Math.abs(s) / 2;
};

/** Um L de 9 m²: base 6 × 1 m mais a perna 1 × 3 m. */
const L: DxfPoint[] = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 4 },
  { x: 0, y: 4 },
];

const project = buildTemplate('house2');
const mat = Object.values(project.materials)[0]!;

describe('dxfLayerOfMaterial', () => {
  it('tira acentos, põe em maiúsculas e troca símbolos por _', () => {
    expect(dxfLayerOfMaterial('Externa 19 + cerâmica')).toBe('PAREDE_EXTERNA_19_CERAMICA');
    expect(dxfLayerOfMaterial('  Alvenaria  14 + reboco ')).toBe('PAREDE_ALVENARIA_14_REBOCO');
    expect(dxfLayerOfMaterial('!!!')).toBe('PAREDE_SEM_NOME');
  });
});

describe('exportDxf', () => {
  const geo: DxfLevelGeometry = {
    clusters: [{ regions: [{ materialId: mat.id, polygons: [[L]] }], silhouette: [[L]] }],
    openings: [{ center: { x: 3, y: 0.5 }, u: { x: 1, y: 0 }, width: 0.8, thickness: 0.14 }],
  };

  it('cabeçalho R12 em metros, com fim de arquivo', () => {
    const text = exportDxf(project, 'lv_0', geo);
    expect(headerVar(text, '$ACADVER')).toBe('AC1009');
    expect(headerVar(text, '$INSUNITS')).toBe('6');
    expect(text.startsWith('0\r\nSECTION\r\n2\r\nHEADER')).toBe(true);
    expect(text.endsWith('0\r\nEOF\r\n')).toBe(true);
  });

  it('um L gera as camadas do material, do contorno e dos vãos', () => {
    const text = exportDxf(project, 'lv_0', geo);
    expect(layerNames(text)).toEqual(['0', 'ABERTURAS', 'PAREDE_CONTORNO', dxfLayerOfMaterial(mat.name)].sort());
  });

  it('polilinhas fechadas com vértices coerentes com a geometria', () => {
    const polys = polylines(exportDxf(project, 'lv_0', geo));
    expect(polys.map((p) => p.layer)).toEqual([dxfLayerOfMaterial(mat.name), DXF_LAYER_CONTOUR, DXF_LAYER_OPENINGS]);
    expect(polys.every((p) => p.closed)).toBe(true);
    expect(polys.map((p) => p.pts.length)).toEqual([6, 6, 4]);
    // o parse devolve os mesmos valores (6 casas) e a área do L bate com a da origem
    expect(polys[0]!.pts[0]).toEqual({ x: 0, y: 0 });
    expect(area(polys[0]!.pts)).toBeCloseTo(9, 6);
    expect(area(polys[2]!.pts)).toBeCloseTo(0.8 * 0.14, 6);
  });

  it('furo vira uma polilinha fechada a mais, na mesma camada', () => {
    const square: DxfPoint[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ];
    const hole: DxfPoint[] = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 3 },
      { x: 1, y: 3 },
    ];
    const text = exportDxf(project, 'lv_0', { clusters: [{ regions: [{ materialId: mat.id, polygons: [[square, hole]] }], silhouette: [] }], openings: [] });
    const polys = polylines(text);
    expect(polys.map((p) => p.pts.length)).toEqual([4, 4]);
    expect(polys.every((p) => p.layer === dxfLayerOfMaterial(mat.name))).toBe(true);
    expect(area(polys[0]!.pts) - area(polys[1]!.pts)).toBeCloseTo(12, 6);
  });

  it('anel com menos de 3 vértices é descartado; nível inexistente lança erro', () => {
    const bad = exportDxf(project, 'lv_0', { clusters: [{ regions: [], silhouette: [[[{ x: 0, y: 0 }, { x: 1, y: 1 }]]] }], openings: [] });
    expect(polylines(bad)).toEqual([]);
    expect(() => exportDxf(project, 'lv_99', geo)).toThrow('Nível ausente: lv_99');
  });
});
