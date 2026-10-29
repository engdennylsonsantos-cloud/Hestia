import { describe, expect, it } from 'vitest';
import { buildTemplate, type Generic } from '@hestia/model';
import { DXF_LAYER_GENERIC, dxfGenericRecords } from './dxfGeneric.ts';

type Rec = { type: string; fields: Array<[number, string]> };

/** Ponto em planta (m). */
type Pt = { x: number; y: number };

/** Registros a partir dos pares código/valor em sequência (cada código 0 abre um registro). */
function records(values: string[]): Rec[] {
  const recs: Rec[] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    const code = Number(values[i]!.trim());
    const value = values[i + 1]!.trim();
    if (code === 0) recs.push({ type: value, fields: [] });
    else recs.at(-1)?.fields.push([code, value]);
  }
  return recs;
}

interface Poly {
  layer: string;
  closed: boolean;
  color: number | undefined;
  widths: number[];
  pts: Pt[];
}

/** Polilinhas dos registros: camada, fechamento (70 bit 1), cor (62) e vértices (10/20 de cada VERTEX). */
function polylines(values: string[]): Poly[] {
  const out: Poly[] = [];
  let cur: Poly | null = null;
  for (const r of records(values)) {
    const get = (c: number): string => r.fields.find(([k]) => k === c)?.[1] ?? '';
    if (r.type === 'POLYLINE') {
      const color = r.fields.find(([k]) => k === 62)?.[1];
      cur = {
        layer: get(8),
        closed: (Number(get(70)) & 1) === 1,
        color: color === undefined ? undefined : Number(color),
        widths: r.fields.filter(([k]) => k === 40 || k === 41).map(([, v]) => Number(v)),
        pts: [],
      };
    } else if (r.type === 'VERTEX' && cur) {
      cur.pts.push({ x: Number(get(10)), y: Number(get(20)) });
    } else if (r.type === 'SEQEND' && cur) {
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

/** Objeto importado mínimo: a malha vazia, só o contorno em planta importa aqui. */
function generic(id: string, levelId: string, outline?: Pt[]): Generic {
  return {
    id,
    kind: 'generic',
    levelId,
    name: id,
    sourceClass: 'IFCBEAM',
    mesh: { positions: [], indices: [] },
    ...(outline ? { outline } : {}),
    order: 1,
  };
}

/** Planta do template (cópia mutável) com os genéricos dados, na chave `elements`. */
function projectWith(...generics: Generic[]) {
  const p = structuredClone(buildTemplate('house2'));
  for (const g of generics) p.elements[g.id] = g;
  return p;
}

const square: Pt[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 3 },
  { x: 0, y: 3 },
];

describe('E5 · objetos importados no DXF', () => {
  it('a camada dos importados é IMPORTADO', () => {
    expect(DXF_LAYER_GENERIC).toBe('IMPORTADO');
  });

  it('um genérico vira uma polilinha fechada, cinza e sem largura, na camada IMPORTADO', () => {
    const p = projectWith(generic('gn_a', 'lv_0', square));
    const values = dxfGenericRecords(p, 'lv_0');
    expect(values).toContain('POLYLINE');
    expect(values).toContain(DXF_LAYER_GENERIC);
    expect(values.length % 2).toBe(0);
    const polys = polylines(values);
    expect(polys).toHaveLength(1);
    expect(polys[0]!.layer).toBe(DXF_LAYER_GENERIC);
    expect(polys[0]!.closed).toBe(true);
    expect(polys[0]!.color).toBe(8);
    expect(polys[0]!.widths).toEqual([]);
    expect(polys[0]!.pts).toHaveLength(4);
    expect(polys[0]!.pts[1]).toEqual({ x: 4, y: 0 });
  });

  it('sem genérico no nível a lista é vazia', () => {
    expect(dxfGenericRecords(buildTemplate('house2'), 'lv_0')).toEqual([]);
  });

  it('genérico de outro nível não sai', () => {
    const p = projectWith(generic('gn_a', 'lv_0', square));
    expect(dxfGenericRecords(p, 'lv_1')).toEqual([]);
  });

  it('sem contorno em planta, ou com menos de 3 pontos, não desenha', () => {
    const p = projectWith(
      generic('gn_a', 'lv_0'),
      generic('gn_b', 'lv_0', [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    );
    expect(dxfGenericRecords(p, 'lv_0')).toEqual([]);
  });

  it('ordem determinística por id, e um registro por genérico', () => {
    const left: Pt[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    const right: Pt[] = [
      { x: 5, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 1 },
    ];
    const p = projectWith(generic('gn_z', 'lv_0', right), generic('gn_a', 'lv_0', left));
    const polys = polylines(dxfGenericRecords(p, 'lv_0'));
    expect(polys.map((q) => q.pts.length)).toEqual([3, 3]);
    expect(polys.map((q) => q.pts[0]!.x)).toEqual([0, 5]);
  });

  it('a camada pode ser trocada pelo parâmetro', () => {
    const p = projectWith(generic('gn_a', 'lv_0', square));
    expect(polylines(dxfGenericRecords(p, 'lv_0', 'OUTRA')).map((q) => q.layer)).toEqual(['OUTRA']);
  });
});
