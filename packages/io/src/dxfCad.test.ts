import { describe, expect, it } from 'vitest';
import { buildTemplate, createEmptyProject, type Project } from '@hestia/model';
import { dxfLayerOfMaterial, exportDxf, type DxfLevelGeometry, type DxfPoint } from './dxf.ts';
import { dxfProblems2000 } from './dxfCheck.ts';
import { dxfEscapeText } from './dxfNotes.ts';
import { exportSectionDxf, type DxfSectionGeometry } from './dxfSection.ts';

/**
 * Compatibilidade com o AutoCAD. O Hestia exporta R2000 (AC1015): o R12 (AC1009) não guarda a espessura de linha por camada
 * (código 370), e o AutoCAD 2025 descarta o desenho inteiro se a estrutura do R2000 estiver incompleta ("Invalid or
 * incomplete DXF input -- drawing discarded"). O verificador `dxfProblems2000` confere essa estrutura sem depender do CAD.
 */

const project = buildTemplate('house2');
const mat = Object.values(project.materials)[0]!;
const SQ: DxfPoint[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

const planGeo: DxfLevelGeometry = {
  clusters: [{ regions: [{ materialId: mat.id, polygons: [[SQ]] }], silhouette: [[SQ]] }],
  openings: [{ center: { x: 2, y: 0 }, u: { x: 1, y: 0 }, width: 0.8, thickness: 0.14 }],
};

const RECT = [[[{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 0 }]]];
const sectionGeo: DxfSectionGeometry = {
  cut: [{ category: 'wall', polygons: RECT }],
  beyond: [{ category: 'window', polygons: RECT }],
  silhouette: RECT,
};

const withSection = (): Project => {
  const p = createEmptyProject();
  p.views.push({ id: 'corte_a', name: 'Corte A', kind: 'section', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, depth: 8 });
  return p;
};

/** Registros do arquivo: tipo (código 0) e pares seguintes. */
function records(text: string): Array<{ type: string; pairs: Array<[number, string]> }> {
  const out: Array<{ type: string; pairs: Array<[number, string]> }> = [];
  const lines = text.split('\r\n');
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]);
    if (code === 0) out.push({ type: lines[i + 1]!, pairs: [] });
    else out.at(-1)?.pairs.push([code, lines[i + 1]!]);
  }
  return out;
}

describe('verificador do DXF R2000', () => {
  it('aceita a planta, o corte e o documento vazio', () => {
    expect(dxfProblems2000(exportDxf(project, 'lv_0', planGeo))).toEqual([]);
    expect(dxfProblems2000(exportSectionDxf(withSection(), 'corte_a', sectionGeo))).toEqual([]);
    expect(dxfProblems2000(exportDxf(project, 'lv_0', { clusters: [], openings: [] }))).toEqual([]);
  });

  it('acusa a versão errada, a camada sem 370 e o 390 sem objeto', () => {
    const ok = exportDxf(project, 'lv_0', planGeo);
    expect(dxfProblems2000(ok.replace('AC1015', 'AC1009'))).toContain('$ACADVER ausente ou diferente de AC1015');
    expect(dxfProblems2000(ok.replace('\r\n370\r\n-3\r\n', '\r\n'))).toEqual(expect.arrayContaining([expect.stringContaining('sem espessura (370)')]));
    expect(dxfProblems2000(ok.replace('\r\n390\r\n', '\r\n391\r\n'))).toEqual(expect.arrayContaining([expect.stringContaining('sem PlotStyleName (390)')]));
  });

  it('acusa seção ausente, EOF repetido, valor não ASCII, NaN e handle fora do $HANDSEED', () => {
    const ok = exportDxf(project, 'lv_0', planGeo);
    expect(dxfProblems2000(ok.replace(/0\r\nSECTION\r\n2\r\nCLASSES\r\n[\s\S]*?0\r\nENDSEC\r\n/, ''))).toEqual(expect.arrayContaining([expect.stringContaining('seções')]));
    expect(dxfProblems2000(`${ok}0\r\nEOF\r\n`)).toContain('EOF ausente ou repetido');
    expect(dxfProblems2000(ok.replace('PAREDE_CONTORNO', 'PAREDE_CONTORNÃO'))).toEqual(expect.arrayContaining([expect.stringContaining('não ASCII')]));
    expect(dxfProblems2000(ok.replace('4.000000', 'NaN'))).toEqual(expect.arrayContaining([expect.stringContaining('não numérico')]));
    expect(dxfProblems2000(ok.replace(/\$HANDSEED\r\n5\r\n[0-9A-F]+/, '$HANDSEED\r\n5\r\n1'))).toEqual(expect.arrayContaining([expect.stringContaining('não é menor que $HANDSEED')]));
  });

  it('acusa handle repetido e camada usando tipo de linha que não está na tabela', () => {
    const ok = exportDxf(project, 'lv_0', planGeo);
    expect(dxfProblems2000(ok.replace('5\r\n10\r\n', '5\r\n11\r\n'))).toEqual(expect.arrayContaining([expect.stringContaining('handle repetido')]));
    expect(dxfProblems2000(ok.replace('\r\n6\r\nCONTINUOUS\r\n', '\r\n6\r\nPONTILHADO\r\n'))).toEqual(expect.arrayContaining([expect.stringContaining('que não está na tabela LTYPE')]));
  });
});

describe('planta e corte em R2000 (AC1015)', () => {
  it('as camadas levam cor (62), tipo de linha (6), espessura (370) e plot style (390)', () => {
    const text = exportDxf(project, 'lv_0', { ...planGeo, lineWeights: { [dxfLayerOfMaterial(mat.name)]: 70, ABERTURAS: 35 } });
    const layers = records(text).filter((r) => r.type === 'LAYER');
    const field = (name: string, code: number): string | undefined =>
      layers.find((r) => r.pairs.some(([c, v]) => c === 2 && v === name))?.pairs.find(([c]) => c === code)?.[1];
    expect([field('0', 370), field('0', 62), field('0', 6)]).toEqual(['-3', '7', 'CONTINUOUS']);
    expect([field('ABERTURAS', 370), field(dxfLayerOfMaterial(mat.name), 370)]).toEqual(['35', '70']);
    for (const r of layers) {
      expect(r.pairs.find(([c]) => c === 390)?.[1]).toMatch(/^[0-9A-F]+$/);
      expect(r.pairs.find(([c]) => c === 62)?.[1]).toBeDefined();
    }
  });

  it('as seções saem na ordem do R2000 e há um único EOF', () => {
    for (const text of [exportDxf(project, 'lv_0', planGeo), exportSectionDxf(withSection(), 'corte_a', sectionGeo)]) {
      const sections = [...text.matchAll(/0\r\nSECTION\r\n2\r\n(\w+)\r\n/g)].map((m) => m[1]);
      expect(sections).toEqual(['HEADER', 'CLASSES', 'TABLES', 'BLOCKS', 'ENTITIES', 'OBJECTS']);
      expect(text.match(/\r\nEOF\r\n/g)).toHaveLength(1);
      expect(text).toContain('2\r\nSTYLE\r\n');
      expect(text).toContain('2\r\nBLOCK_RECORD\r\n');
    }
  });

  it('as unidades continuam em metros ($INSUNITS 6) e a espessura de linha fica visível ($LWDISPLAY)', () => {
    for (const text of [exportDxf(project, 'lv_0', planGeo), exportSectionDxf(withSection(), 'corte_a', sectionGeo)]) {
      expect(text).toContain('9\r\n$INSUNITS\r\n70\r\n6\r\n');
      expect(text).toContain('9\r\n$LWDISPLAY\r\n290\r\n1\r\n');
    }
  });
});

describe('texto acentuado no DXF R2000', () => {
  it('dxfEscapeText troca o que não é ASCII por \\U+XXXX (o AC1015 também lê em ANSI, não em UTF-8)', () => {
    expect(dxfEscapeText('Cozinha açaí')).toBe('Cozinha a\\U+00E7a\\U+00ED');
    expect(dxfEscapeText('12,66 m²')).toBe('12,66 m\\U+00B2');
    expect(dxfEscapeText('Sala 101')).toBe('Sala 101');
  });

  it('quebra de linha no texto não parte o par código/valor do arquivo', () => {
    expect(dxfEscapeText('a\nb')).toBe('a\\U+000Ab');
  });
});
