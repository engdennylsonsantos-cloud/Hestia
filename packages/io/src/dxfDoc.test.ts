import { describe, expect, it } from 'vitest';
import { writeDxf2000, type DxfDoc, type DxfUnit } from './dxfDoc.ts';

/** Par código/valor de um DXF já quebrado em linhas. */
interface Pair {
  code: number;
  value: string;
}

/** Registro DXF: o tipo (código 0) e os pares seguintes até o próximo código 0. */
interface Record2000 {
  type: string;
  pairs: Pair[];
}

/** Quebra o texto do DXF em pares código/valor (cada registro ocupa duas linhas). */
function pairsOf(text: string): Pair[] {
  const lines = text.split('\r\n');
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push({ code: Number(lines[i]), value: lines[i + 1] ?? '' });
  return out;
}

/** Agrupa os pares em registros (cada código 0 abre um registro). */
function recordsOf(pairs: Pair[]): Record2000[] {
  const out: Record2000[] = [];
  for (const p of pairs) {
    if (p.code === 0) out.push({ type: p.value, pairs: [] });
    else out.at(-1)?.pairs.push(p);
  }
  return out;
}

/** Valor de uma variável do HEADER: o par logo depois do 9 com o nome. */
function headerVar(recs: Record2000[], name: string): Pair | undefined {
  const header = recs.find((r) => r.type === 'SECTION' && r.pairs[0]?.value === 'HEADER')!;
  const at = header.pairs.findIndex((p) => p.code === 9 && p.value === name);
  return header.pairs[at + 1];
}

/** Documento de exemplo da fase 1: três camadas com cores e espessuras diferentes, uma tracejada. */
const sample: DxfDoc = {
  layers: [
    { name: 'PAREDE_ALVENARIA', color: 1, linetype: 'CONTINUOUS', lineWeight: 50 },
    { name: 'PISO_MADEIRA', color: 5, linetype: 'CONTINUOUS', lineWeight: 13 },
    { name: 'ESCADA_ACIMA', color: 3, linetype: 'DASHED', lineWeight: 18 },
  ],
  entities: [
    { kind: 'polyline', layer: 'PAREDE_ALVENARIA', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }], closed: true },
    { kind: 'polyline', layer: 'PISO_MADEIRA', points: [{ x: 0, y: 5 }, { x: 2, y: 6 }, { x: 4, y: 5 }] },
    { kind: 'line', layer: 'PAREDE_ALVENARIA', a: { x: 0, y: 8 }, b: { x: 5, y: 8 } },
    { kind: 'line', layer: 'ESCADA_ACIMA', a: { x: 0, y: 9 }, b: { x: 5, y: 10 } },
    { kind: 'text', layer: 'PISO_MADEIRA', at: { x: 2, y: 2 }, height: 0.3, text: 'LAJE TÉCNICA', rotation: 0, centered: true },
  ],
};

const dxf = writeDxf2000(sample);
const pairs = pairsOf(dxf);
const records = recordsOf(pairs);

describe('writeDxf2000', () => {
  it('termina em CRLF e num único EOF', () => {
    expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true);
    expect(dxf.split('\r\n').filter((line) => line === 'EOF')).toHaveLength(1);
    expect(dxf.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('grava as seções na ordem do R2000', () => {
    const sections: string[] = [];
    for (const r of records) if (r.type === 'SECTION') sections.push(r.pairs[0]?.value ?? '');
    expect(sections).toEqual(['HEADER', 'CLASSES', 'TABLES', 'BLOCKS', 'ENTITIES', 'OBJECTS']);
  });

  it('declara AC1015, unidades em metros e espessura de linha visível', () => {
    const header = records.find((r) => r.type === 'SECTION' && r.pairs[0]?.value === 'HEADER')!;
    const varOf = (name: string): Pair | undefined => {
      const at = header.pairs.findIndex((p) => p.code === 9 && p.value === name);
      return header.pairs[at + 1];
    };
    expect(varOf('$ACADVER')).toEqual({ code: 1, value: 'AC1015' });
    expect(varOf('$INSUNITS')).toEqual({ code: 70, value: '6' });
    expect(varOf('$MEASUREMENT')).toEqual({ code: 70, value: '1' });
    expect(varOf('$LWDISPLAY')).toEqual({ code: 290, value: '1' });
  });

  it('grava a cor (62) e a espessura (370) de cada camada', () => {
    const layer = (name: string): Record2000 => records.find((r) => r.type === 'LAYER' && r.pairs.some((p) => p.code === 2 && p.value === name))!;
    const pair = (name: string, code: number): string | undefined => layer(name).pairs.find((p) => p.code === code)?.value;
    expect([pair('PAREDE_ALVENARIA', 62), pair('PAREDE_ALVENARIA', 370)]).toEqual(['1', '50']);
    expect([pair('PISO_MADEIRA', 62), pair('PISO_MADEIRA', 370)]).toEqual(['5', '13']);
    expect([pair('ESCADA_ACIMA', 62), pair('ESCADA_ACIMA', 370), pair('ESCADA_ACIMA', 6)]).toEqual(['3', '18', 'DASHED']);
  });

  it('põe -3 na camada sem espessura declarada e sempre grava a camada 0', () => {
    const zero = writeDxf2000({ layers: [{ name: 'SEM_PESO', color: 7, linetype: 'CONTINUOUS' }], entities: [] });
    const zeroRecords = recordsOf(pairsOf(zero));
    const semPeso = zeroRecords.find((r) => r.type === 'LAYER' && r.pairs.some((p) => p.code === 2 && p.value === 'SEM_PESO'))!;
    expect(semPeso.pairs.find((p) => p.code === 370)?.value).toBe('-3');
    expect(zeroRecords.some((r) => r.type === 'LAYER' && r.pairs.some((p) => p.code === 2 && p.value === '0'))).toBe(true);
  });

  it('usa handles únicos, em hexa, todos menores que $HANDSEED', () => {
    const seedAt = pairs.findIndex((p) => p.code === 9 && p.value === '$HANDSEED');
    const handles = pairs.filter((p, i) => (p.code === 5 || p.code === 105) && i !== seedAt + 1).map((p) => p.value);
    expect(handles.length).toBeGreaterThan(20);
    for (const h of handles) expect(h).toMatch(/^[0-9A-F]+$/);
    expect(new Set(handles).size).toBe(handles.length);
    const seed = pairs[seedAt + 1]!.value;
    const max = Math.max(...handles.map((h) => parseInt(h, 16)));
    expect(parseInt(seed, 16)).toBeGreaterThan(max);
  });

  it('aponta as entidades para o BLOCK_RECORD do *Model_Space', () => {
    const modelSpace = records.find((r) => r.type === 'BLOCK_RECORD' && r.pairs.some((p) => p.code === 2 && p.value === '*Model_Space'))!;
    const modelSpaceHandle = modelSpace.pairs.find((p) => p.code === 5)?.value;
    const entities = records.filter((r) => ['POLYLINE', 'LINE', 'TEXT', 'VERTEX'].includes(r.type));
    expect(entities).toHaveLength(11); // 2 polilinhas (6 vértices), 2 linhas e 1 texto
    for (const e of entities) expect(e.pairs.find((p) => p.code === 330)?.value).toBe(modelSpaceHandle);
    // O SEQEND é da POLYLINE (dono da lista), não do modelo.
    const polylineHandles = records.filter((r) => r.type === 'POLYLINE').map((r) => r.pairs.find((p) => p.code === 5)?.value);
    for (const seqend of records.filter((r) => r.type === 'SEQEND')) expect(polylineHandles).toContain(seqend.pairs.find((p) => p.code === 330)?.value);
  });

  it('escapa o texto fora do ASCII e mantém o acento como \\U+XXXX', () => {
    expect(dxf).toContain('LAJE T\\U+00C9CNICA');
    for (const line of dxf.split('\r\n')) expect([...line].every((ch) => ch.charCodeAt(0) < 128)).toBe(true);
  });

  it('grava a polilinha fechada com flag 70 = 1 e uma VERTEX por ponto', () => {
    const closed = records.find((r) => r.type === 'POLYLINE' && r.pairs.some((p) => p.code === 70 && p.value === '1'))!;
    const start = records.indexOf(closed);
    const untilSeqend = records.slice(start).findIndex((r) => r.type === 'SEQEND');
    const vertices = records.slice(start, start + untilSeqend).filter((r) => r.type === 'VERTEX');
    expect(vertices).toHaveLength(3);
    expect(closed.pairs.find((p) => p.code === 66)?.value).toBe('1');
    const open = records.filter((r) => r.type === 'POLYLINE').find((r) => r !== closed)!;
    expect(open.pairs.find((p) => p.code === 70)?.value).toBe('0');
  });

  it('não repete camada e completa as camadas citadas pelas entidades', () => {
    const doc: DxfDoc = {
      layers: [{ name: 'A', color: 2, linetype: 'CONTINUOUS' }, { name: 'A', color: 9, linetype: 'DASHED' }],
      entities: [{ kind: 'line', layer: 'B', a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }],
    };
    const names = recordsOf(pairsOf(writeDxf2000(doc))).filter((r) => r.type === 'LAYER').map((r) => r.pairs.find((p) => p.code === 2)?.value);
    expect(names).toEqual(['0', 'A', 'B']);
  });
});

/** Documento em metros usado nos testes de unidade: tracejado, texto girado, largura e extensão dada. */
const docEmMetros = (units?: DxfUnit): DxfDoc => ({
  ...(units === undefined ? {} : { units }),
  extMin: { x: 1, y: 2 },
  extMax: { x: 5, y: 8 },
  layers: [
    { name: 'CORTE', color: 3, linetype: 'DASHED', lineWeight: 25 },
    { name: 'TEXTO', color: 7, linetype: 'CONTINUOUS' },
  ],
  entities: [
    { kind: 'line', layer: 'CORTE', a: { x: 1, y: 2 }, b: { x: 3, y: 4 } },
    { kind: 'polyline', layer: 'CORTE', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }], width: 0.2 },
    { kind: 'text', layer: 'TEXTO', at: { x: 2, y: 2 }, height: 0.5, text: 'NOTA', rotation: 30 },
  ],
});

/** Unidades de saída e o fator metros→unidade de cada uma. */
const UNIDADES: ReadonlyArray<{ units: DxfUnit; code: number; scale: number }> = [
  { units: 'mm', code: 4, scale: 1000 },
  { units: 'cm', code: 5, scale: 100 },
  { units: 'ft', code: 2, scale: 1 / 0.3048 },
  { units: 'in', code: 1, scale: 1 / 0.0254 },
];

describe('writeDxf2000 por unidade', () => {
  for (const { units, code, scale } of UNIDADES) {
    it(`escala os comprimentos e grava $INSUNITS em ${units}`, () => {
      const recs = recordsOf(pairsOf(writeDxf2000(docEmMetros(units))));
      const valueOf = (r: Record2000, c: number): number => Number(r.pairs.find((p) => p.code === c)!.value);

      const line = recs.find((r) => r.type === 'LINE')!;
      expect(valueOf(line, 10)).toBeCloseTo(1 * scale, 4);
      expect(valueOf(line, 20)).toBeCloseTo(2 * scale, 4);
      expect(valueOf(line, 11)).toBeCloseTo(3 * scale, 4);

      const polyline = recs.find((r) => r.type === 'POLYLINE')!;
      expect(valueOf(polyline, 40)).toBeCloseTo(0.2 * scale, 4);
      expect(valueOf(polyline, 41)).toBeCloseTo(0.2 * scale, 4);

      const text = recs.find((r) => r.type === 'TEXT')!;
      expect(valueOf(text, 40)).toBeCloseTo(0.5 * scale, 4);
      expect(text.pairs.find((p) => p.code === 50)?.value).toBe('30.000000');

      expect(headerVar(recs, '$INSUNITS')).toEqual({ code: 70, value: String(code) });
      expect(Number(headerVar(recs, '$EXTMIN')!.value)).toBeCloseTo(1 * scale, 4);
      expect(Number(headerVar(recs, '$EXTMAX')!.value)).toBeCloseTo(5 * scale, 4);

      const layer = recs.find((r) => r.type === 'LAYER' && r.pairs.some((p) => p.code === 2 && p.value === 'CORTE'))!;
      expect(layer.pairs.find((p) => p.code === 370)?.value).toBe('25');

      const dashed = recs.find((r) => r.type === 'LTYPE' && r.pairs.some((p) => p.code === 2 && p.value === 'DASHED'))!;
      expect(valueOf(dashed, 40)).toBeCloseTo(0.375 * scale, 4);
      const elements = dashed.pairs.filter((p) => p.code === 49).map((p) => Number(p.value));
      expect(elements).toHaveLength(2);
      expect(elements[0]).toBeCloseTo(0.25 * scale, 4);
      expect(elements[1]).toBeCloseTo(-0.125 * scale, 4);
    });
  }

  it('sem unidade ou em metros grava exatamente o mesmo arquivo', () => {
    expect(writeDxf2000(docEmMetros('m'))).toBe(writeDxf2000(docEmMetros(undefined)));
    expect(writeDxf2000(sample)).toBe(writeDxf2000({ ...sample, units: 'm' }));
    const recs = recordsOf(pairsOf(writeDxf2000(docEmMetros(undefined))));
    expect(headerVar(recs, '$INSUNITS')).toEqual({ code: 70, value: '6' });
    expect(Number(headerVar(recs, '$EXTMIN')!.value)).toBe(1);
  });
});
