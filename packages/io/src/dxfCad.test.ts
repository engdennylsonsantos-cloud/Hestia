import { describe, expect, it } from 'vitest';
import { buildTemplate, createEmptyProject, type Project } from '@hestia/model';
import { dxfLayerOfMaterial, exportDxf, type DxfLevelGeometry, type DxfPoint } from './dxf.ts';
import { dxfProblemsR12 } from './dxfCheck.ts';
import { dxfEscapeText, dxfTextRecords } from './dxfNotes.ts';
import { exportSectionDxf, type DxfSectionGeometry } from './dxfSection.ts';

/**
 * Compatibilidade com o AutoCAD (decisão: o DXF é R12/AC1009). O AutoCAD 2025 descarta o desenho inteiro se achar um
 * código que o R12 não tem: "Unknown group 370 for table … Invalid or incomplete DXF input -- drawing discarded".
 * O verificador `dxfProblemsR12` confere essa estrutura sem depender do CAD.
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

describe('verificador do DXF R12', () => {
  it('acusa o 370 na tabela LAYER, o defeito que o AutoCAD recusa', () => {
    const ok = exportDxf(project, 'lv_0', planGeo);
    expect(dxfProblemsR12(ok)).toEqual([]);
    const ruim = ok.replace('CONTINUOUS\r\n0\r\nLAYER', 'CONTINUOUS\r\n370\r\n-3\r\n0\r\nLAYER');
    expect(ruim).not.toBe(ok);
    expect(dxfProblemsR12(ruim)).toContain('código 370 não existe no R12');
  });

  it('acusa seção BLOCKS ausente, EOF repetido, valor não ASCII e NaN', () => {
    const ok = exportDxf(project, 'lv_0', planGeo);
    expect(dxfProblemsR12(ok.replace('0\r\nSECTION\r\n2\r\nBLOCKS\r\n0\r\nENDSEC\r\n', ''))).toEqual(expect.arrayContaining([expect.stringContaining('seções')]));
    expect(dxfProblemsR12(`${ok}0\r\nEOF\r\n`)).toContain('EOF ausente ou repetido');
    expect(dxfProblemsR12(ok.replace('PAREDE_CONTORNO', 'PAREDE_CONTORNÃO'))).toEqual(expect.arrayContaining([expect.stringContaining('não ASCII')]));
    expect(dxfProblemsR12(ok.replace('4.000000', 'NaN'))).toEqual(expect.arrayContaining([expect.stringContaining('não numérico')]));
  });
});

describe('planta e corte são R12 estrito (sem grupos do R2000)', () => {
  it('a planta, com e sem lineWeights, passa no verificador e não leva 370', () => {
    const layer = dxfLayerOfMaterial(mat.name);
    for (const lineWeights of [undefined, { [layer]: 70, ABERTURAS: 35 }]) {
      const text = exportDxf(project, 'lv_0', { ...planGeo, ...(lineWeights ? { lineWeights } : {}) });
      expect(dxfProblemsR12(text)).toEqual([]);
      expect(text).not.toContain('\r\n370\r\n');
    }
  });

  it('o corte, com e sem lineWeights, passa no verificador e não leva 370', () => {
    for (const lineWeights of [undefined, { CORTE_PAREDE: 70 }]) {
      const text = exportSectionDxf(withSection(), 'corte_a', { ...sectionGeo, ...(lineWeights ? { lineWeights } : {}) });
      expect(dxfProblemsR12(text)).toEqual([]);
      expect(text).not.toContain('\r\n370\r\n');
    }
  });

  it('as seções saem na ordem HEADER, TABLES, BLOCKS, ENTITIES e há um único EOF', () => {
    for (const text of [exportDxf(project, 'lv_0', planGeo), exportSectionDxf(withSection(), 'corte_a', sectionGeo)]) {
      const sections = [...text.matchAll(/0\r\nSECTION\r\n2\r\n(\w+)\r\n/g)].map((m) => m[1]);
      expect(sections).toEqual(['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES']);
      expect(text.match(/\r\nEOF\r\n/g)).toHaveLength(1);
      expect(text).toContain('2\r\nSTYLE\r\n');
    }
  });

  it('as unidades continuam em metros ($INSUNITS 6; o AutoCAD 2025 as lê mesmo no R12)', () => {
    expect(exportDxf(project, 'lv_0', planGeo)).toContain('9\r\n$INSUNITS\r\n70\r\n6\r\n');
    expect(exportSectionDxf(withSection(), 'corte_a', sectionGeo)).toContain('9\r\n$INSUNITS\r\n70\r\n6\r\n');
  });
});

describe('texto acentuado no DXF R12', () => {
  it('dxfEscapeText troca o que não é ASCII por \\U+XXXX (o AutoCAD lê o R12 em ANSI, não em UTF-8)', () => {
    expect(dxfEscapeText('Cozinha açaí')).toBe('Cozinha a\\U+00E7a\\U+00ED');
    expect(dxfEscapeText('12,66 m²')).toBe('12,66 m\\U+00B2');
    expect(dxfEscapeText('Sala 101')).toBe('Sala 101');
  });

  it('quebra de linha no texto não parte o par código/valor do arquivo', () => {
    expect(dxfEscapeText('a\nb')).toBe('a\\U+000Ab');
  });

  it('dxfTextRecords grava o grupo 1 já escapado', () => {
    const rec = dxfTextRecords({ at: { x: 1, y: 2 }, text: 'Área útil', height: 0.2, rotation: 0, layer: 'TEXTOS' });
    expect(rec.find(([c]) => c === 1)?.[1]).toBe('\\U+00C1rea \\U+00FAtil');
  });
});
