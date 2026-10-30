import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@hestia/model';
import {
  type DxfSymbolPath,
  DXF_LAYER_CONTOUR,
  DXF_LAYER_OPENINGS,
  DXF_LAYER_OPENING_SYMBOL,
  DXF_LAYER_OPENING_ABOVE,
  DXF_LAYER_OPENING_BELOW,
  DXF_LAYER_OPENING_BEYOND,
  DXF_LAYER_ROOF_PROJECTION,
  DXF_LAYER_STAIR,
  DXF_LAYER_STAIR_ABOVE,
  DXF_LAYER_STAIR_CUT,
  DXF_LAYER_STAIR_POST,
  DXF_LAYER_WALL_ABOVE,
  DXF_LAYER_WALL_BELOW,
  DXF_LAYER_WALL_BEYOND,
  dxfLayerOfFloor,
  dxfLayerOfMaterial,
  exportDxf,
  type DxfLevelGeometry,
  type DxfPoint,
} from './dxf.ts';

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

  it('cabeçalho R2000 em metros, com fim de arquivo', () => {
    const text = exportDxf(project, 'lv_0', geo);
    expect(headerVar(text, '$ACADVER')).toBe('AC1015');
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

describe('pisos no DXF', () => {
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

  it('código do tipo vira camada PISO_ sem acentos nem símbolos', () => {
    expect(dxfLayerOfFloor('PS-01')).toBe('PISO_PS_01');
    expect(dxfLayerOfFloor('Laje ção 12')).toBe('PISO_LAJE_CAO_12');
    expect(dxfLayerOfFloor('  ')).toBe('PISO_SEM_CODIGO');
  });

  it('piso com furo vira polilinhas fechadas na camada do tipo, e entra na lista de camadas', () => {
    const geo: DxfLevelGeometry = { clusters: [], openings: [], floors: [{ outline: square, holes: [hole], typeCode: 'PS-01' }] };
    const text = exportDxf(project, 'lv_0', geo);
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual(['PISO_PS_01', 'PISO_PS_01']);
    expect(polys.every((p) => p.closed)).toBe(true);
    expect(polys.map((p) => p.pts.length)).toEqual([4, 4]);
    expect(area(polys[0]!.pts) - area(polys[1]!.pts)).toBeCloseTo(11, 6);
    expect(layerNames(text)).toContain('PISO_PS_01');
  });

  it('pisos de tipos diferentes vão para camadas diferentes; sem pisos o arquivo não muda', () => {
    const geo: DxfLevelGeometry = {
      clusters: [],
      openings: [],
      floors: [
        { outline: square, holes: [], typeCode: 'PS-01' },
        { outline: square, holes: [], typeCode: 'PS-02' },
      ],
    };
    expect(polylines(exportDxf(project, 'lv_0', geo)).map((p) => p.layer)).toEqual(['PISO_PS_01', 'PISO_PS_02']);
    expect(exportDxf(project, 'lv_0', { clusters: [], openings: [] })).toBe(exportDxf(project, 'lv_0', { clusters: [], openings: [], floors: [] }));
  });
});

/** Tipo de linha de uma camada na tabela LAYER (código 6), ou undefined se a camada não existe. */
const linetypeOf = (text: string, name: string): string | undefined => {
  const r = records(text).find((x) => x.type === 'LAYER' && x.fields.some(([c, v]) => c === 2 && v === name));
  return r?.fields.find(([c]) => c === 6)?.[1];
};

/** Nomes dos tipos de linha da tabela LTYPE. */
const ltypeNames = (text: string): string[] => records(text).filter((r) => r.type === 'LTYPE').map((r) => r.fields.find(([c]) => c === 2)?.[1] ?? '');

describe('vista da planta no DXF (camadas de projeção, decisão 0013 §4)', () => {
  const square: DxfPoint[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 0.14 },
    { x: 0, y: 0.14 },
  ];
  const base: DxfLevelGeometry = { clusters: [], openings: [] };

  it('sem projeções, a tabela de tipos de linha só tem CONTINUOUS (o arquivo é o de antes)', () => {
    const text = exportDxf(project, 'lv_0', base);
    expect(ltypeNames(text)).toEqual(['ByBlock', 'ByLayer', 'CONTINUOUS']);
    expect(linetypeOf(text, DXF_LAYER_OPENINGS)).toBeUndefined();
  });

  it('parede acima do corte vai para PAREDE_PROJECAO_ACIMA, tracejada; abaixo e "além" em linha contínua clara', () => {
    const geo: DxfLevelGeometry = {
      ...base,
      wallOutlines: [
        { state: 'projection-above', polygons: [[square]] },
        { state: 'projection-below', polygons: [[square]] },
        { state: 'beyond', polygons: [[square]] },
      ],
    };
    const text = exportDxf(project, 'lv_0', geo);
    expect(ltypeNames(text)).toEqual(['ByBlock', 'ByLayer', 'CONTINUOUS', 'DASHED']);
    expect(linetypeOf(text, DXF_LAYER_WALL_ABOVE)).toBe('DASHED');
    expect(linetypeOf(text, DXF_LAYER_WALL_BELOW)).toBe('CONTINUOUS');
    expect(linetypeOf(text, DXF_LAYER_WALL_BEYOND)).toBe('CONTINUOUS');
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual([DXF_LAYER_WALL_ABOVE, DXF_LAYER_WALL_BELOW, DXF_LAYER_WALL_BEYOND]);
    expect(polys.every((p) => p.closed && p.pts.length === 4)).toBe(true);
  });

  it('parede de projeção não entra na camada de corte do material nem no contorno', () => {
    const geo: DxfLevelGeometry = { ...base, wallOutlines: [{ state: 'projection-above', polygons: [[square]] }] };
    const layers = polylines(exportDxf(project, 'lv_0', geo)).map((p) => p.layer);
    expect(layers).toEqual([DXF_LAYER_WALL_ABOVE]);
  });

  it('vãos por estado: corte em ABERTURAS, acima em ABERTURA_ACIMA (tracejada), abaixo e além em camadas leves', () => {
    const o = (state: 'cut' | 'projection-above' | 'projection-below' | 'beyond', x: number) => ({
      center: { x, y: 0 },
      u: { x: 1, y: 0 },
      width: 0.8,
      thickness: 0.14,
      state,
    });
    const geo: DxfLevelGeometry = { ...base, openings: [o('cut', 1), o('projection-above', 3), o('projection-below', 5), o('beyond', 7)] };
    const text = exportDxf(project, 'lv_0', geo);
    expect(polylines(text).map((p) => p.layer)).toEqual([DXF_LAYER_OPENINGS, DXF_LAYER_OPENING_ABOVE, DXF_LAYER_OPENING_BELOW, DXF_LAYER_OPENING_BEYOND]);
    expect(linetypeOf(text, DXF_LAYER_OPENING_ABOVE)).toBe('DASHED');
    expect(linetypeOf(text, DXF_LAYER_OPENINGS)).toBe('CONTINUOUS');
  });

  it('vão sem estado vale o corte (ABERTURAS), como antes', () => {
    const geo: DxfLevelGeometry = { ...base, openings: [{ center: { x: 1, y: 0 }, u: { x: 1, y: 0 }, width: 0.8, thickness: 0.14 }] };
    expect(polylines(exportDxf(project, 'lv_0', geo)).map((p) => p.layer)).toEqual([DXF_LAYER_OPENINGS]);
  });

  it('projeção de telhado fora do intervalo vai para TELHADO_PROJECAO, tracejada', () => {
    const text = exportDxf(project, 'lv_0', { ...base, roofProjections: [[square]] });
    expect(polylines(text).map((p) => p.layer)).toEqual([DXF_LAYER_ROOF_PROJECTION]);
    expect(linetypeOf(text, DXF_LAYER_ROOF_PROJECTION)).toBe('DASHED');
  });

  it('degraus acima da cota de corte vão para ESCADA_ACIMA (tracejada) e o símbolo de corte é polilinha aberta', () => {
    const tread: DxfPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const zig: DxfPoint[] = [
      { x: 0, y: 2 },
      { x: 0.5, y: 2.05 },
      { x: 1, y: 2 },
    ];
    const geo: DxfLevelGeometry = { ...base, stairs: [{ outlines: [tread], outlinesAbove: [tread], risers: [], arrow: [], cut: zig }] };
    const text = exportDxf(project, 'lv_0', geo);
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual([DXF_LAYER_STAIR, DXF_LAYER_STAIR_ABOVE, DXF_LAYER_STAIR_CUT]);
    expect(polys[0]!.closed && polys[1]!.closed).toBe(true);
    expect(polys[2]!.closed).toBe(false);
    expect(polys[2]!.pts).toHaveLength(3);
    expect(linetypeOf(text, DXF_LAYER_STAIR_ABOVE)).toBe('DASHED');
    expect(linetypeOf(text, DXF_LAYER_STAIR_CUT)).toBe('CONTINUOUS');
  });

  it('o tipo DASHED só aparece na tabela quando alguma camada o usa', () => {
    const above = exportDxf(project, 'lv_0', { ...base, wallOutlines: [{ state: 'projection-below', polygons: [[square]] }] });
    expect(ltypeNames(above)).toEqual(['ByBlock', 'ByLayer', 'CONTINUOUS']);
  });
});

describe('símbolo dos vãos de projeção no DXF (o mesmo da planta)', () => {
  const base: DxfLevelGeometry = { clusters: [], openings: [] };
  // Porta de uma folha: a folha (2 pontos) e o arco de giro (19 pontos), como o símbolo da tela.
  const leaf: DxfSymbolPath = { pts: [{ x: 1, y: 0 }, { x: 1.8, y: 0 }], closed: false };
  const arc: DxfSymbolPath = { pts: Array.from({ length: 19 }, (_, i) => ({ x: 1 + 0.8 * Math.cos((i * Math.PI) / 36), y: 0.8 * Math.sin((i * Math.PI) / 36) })), closed: false };
  const at = (state: 'cut' | 'projection-above' | 'projection-below' | 'beyond', symbol?: DxfSymbolPath[]) => ({
    center: { x: 1, y: 0 },
    u: { x: 1, y: 0 },
    width: 0.8,
    thickness: 0.14,
    state,
    ...(symbol ? { symbol } : {}),
  });

  it('porta acima do corte: folha e arco na camada ABERTURA_ACIMA, sem retângulo e sem vão em ABERTURAS', () => {
    const text = exportDxf(project, 'lv_0', { ...base, openings: [at('projection-above', [leaf, arc])] });
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual([DXF_LAYER_OPENING_ABOVE, DXF_LAYER_OPENING_ABOVE]);
    expect(polys.map((p) => p.pts.length)).toEqual([2, 19]);
    expect(polys.every((p) => !p.closed)).toBe(true);
    expect(linetypeOf(text, DXF_LAYER_OPENING_ABOVE)).toBe('DASHED');
    expect(text).not.toContain('\r\nABERTURAS\r\n');
  });

  it('sem símbolo, a projeção sai como retângulo fechado, como antes', () => {
    const text = exportDxf(project, 'lv_0', { ...base, openings: [at('projection-below')] });
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual([DXF_LAYER_OPENING_BELOW]);
    expect(polys[0]!.closed && polys[0]!.pts.length === 4).toBe(true);
  });

  // Decisão X1 (docs/aberturas/A-pesquisa.md §5): o vão de corte usa o símbolo de planta, o mesmo da tela, agora na
  // camada própria ABERTURA_SIMBOLO (decisão 0024 §4). O retângulo do corte não sai quando há símbolo.
  it('o vão de corte usa o símbolo da planta: folha e arco em ABERTURA_SIMBOLO, sem retângulo em ABERTURAS', () => {
    const text = exportDxf(project, 'lv_0', { ...base, openings: [at('cut', [leaf, arc])] });
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual([DXF_LAYER_OPENING_SYMBOL, DXF_LAYER_OPENING_SYMBOL]);
    expect(polys.map((p) => p.pts.length)).toEqual([2, 19]);
    expect(polys.every((p) => !p.closed)).toBe(true);
    expect(text).not.toContain('\r\nABERTURAS\r\n');
  });

  it('um traço reto sem tracejado no vão de corte vai à ABERTURA_SIMBOLO em linha contínua', () => {
    const reto: DxfSymbolPath = { pts: [{ x: 0.6, y: 0 }, { x: 1.4, y: 0 }], closed: false };
    const text = exportDxf(project, 'lv_0', { ...base, openings: [at('cut', [reto])] });
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual([DXF_LAYER_OPENING_SYMBOL]);
    expect(linetypeOf(text, DXF_LAYER_OPENING_SYMBOL)).toBe('CONTINUOUS');
    expect(ltypeNames(text)).toEqual(['ByBlock', 'ByLayer', 'CONTINUOUS']);
  });

  it('vão de corte sem símbolo continua retângulo fechado em ABERTURAS (compatibilidade)', () => {
    const text = exportDxf(project, 'lv_0', { ...base, openings: [at('cut')] });
    const polys = polylines(text);
    expect(polys.map((p) => p.layer)).toEqual([DXF_LAYER_OPENINGS]);
    expect(polys[0]!.closed && polys[0]!.pts.length === 4).toBe(true);
  });

  it('traço tracejado dentro de camada contínua (arco do maxim-ar, soleira) leva o tipo DASHED na entidade', () => {
    const dashedArc: DxfSymbolPath = { ...arc, dashed: true };
    const text = exportDxf(project, 'lv_0', { ...base, openings: [at('projection-below', [leaf, dashedArc])] });
    expect(linetypeOf(text, DXF_LAYER_OPENING_BELOW)).toBe('CONTINUOUS');
    expect(ltypeNames(text)).toEqual(['ByBlock', 'ByLayer', 'CONTINUOUS', 'DASHED']);
    const entities = records(text).filter((r) => r.type === 'POLYLINE');
    const types = entities.map((r) => r.fields.some(([c, v]) => c === 6 && v === 'DASHED'));
    expect(types).toEqual([false, true]);
    // sem traço tracejado, o arquivo não ganha tipo DASHED
    expect(ltypeNames(exportDxf(project, 'lv_0', { ...base, openings: [at('projection-below', [leaf, arc])] }))).toEqual(['ByBlock', 'ByLayer', 'CONTINUOUS']);
  });
});

describe('poste de caracol no DXF (decisão 0014 §1 item 10)', () => {
  const base: DxfLevelGeometry = { clusters: [], openings: [] };
  const ring = (n: number, r: number): DxfPoint[] => Array.from({ length: n }, (_, i) => ({ x: r * Math.cos((2 * Math.PI * i) / n), y: r * Math.sin((2 * Math.PI * i) / n) }));
  const tread: DxfPoint[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  it('poste na cota de corte ou abaixo vai para ESCADA_POSTE, como polilinha fechada de 48 lados', () => {
    const geo: DxfLevelGeometry = { ...base, stairs: [{ outlines: [tread], risers: [], arrow: [], posts: [{ pts: ring(48, 0.1), above: false }] }] };
    const polys = polylines(exportDxf(project, 'lv_0', geo));
    const post = polys.filter((p) => p.layer === DXF_LAYER_STAIR_POST);
    expect(post).toHaveLength(1);
    expect(post[0]!.closed).toBe(true);
    expect(post[0]!.pts).toHaveLength(48);
    expect(DXF_LAYER_STAIR_POST).toBe('ESCADA_POSTE');
  });

  it('poste acima do corte vai para ESCADA_ACIMA (tracejado), não para ESCADA_POSTE', () => {
    const geo: DxfLevelGeometry = { ...base, stairs: [{ outlines: [], risers: [], arrow: [], posts: [{ pts: ring(24, 0.1), above: true }] }] };
    const text = exportDxf(project, 'lv_0', geo);
    expect(polylines(text).map((p) => p.layer)).toEqual([DXF_LAYER_STAIR_ABOVE]);
    expect(text).not.toContain(DXF_LAYER_STAIR_POST);
    expect(linetypeOf(text, DXF_LAYER_STAIR_ABOVE)).toBe('DASHED');
  });

  it('sem poste (escada reta), a camada ESCADA_POSTE não aparece', () => {
    const geo: DxfLevelGeometry = { ...base, stairs: [{ outlines: [tread], risers: [], arrow: [] }] };
    expect(exportDxf(project, 'lv_0', geo)).not.toContain(DXF_LAYER_STAIR_POST);
  });
});
