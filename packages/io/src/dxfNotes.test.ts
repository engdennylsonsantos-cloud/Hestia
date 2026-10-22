import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject } from '@hestia/model';
import { DXF_LAYER_COTAS, DXF_LAYER_TEXTOS, dxfTextRecords, notesDxfOf } from './dxfNotes.ts';
import { exportDxf, type DxfLevelGeometry } from './dxf.ts';

const LV0 = 'lv_0';
const GEO: DxfLevelGeometry = { clusters: [], openings: [] };

/** Registros (código, valor) de cada entidade do bloco ENTITIES, pela ordem do arquivo. */
function entities(text: string): Array<{ type: string; rec: Map<number, string> }> {
  const src = text.split(/\r?\n/);
  const out: Array<{ type: string; rec: Map<number, string> }> = [];
  for (let i = 0; i + 1 < src.length; i += 2) {
    const code = Number(src[i]!.trim());
    const value = src[i + 1]!.trim();
    if (code === 0) out.push({ type: value, rec: new Map() });
    else out.at(-1)?.rec.set(code, value);
  }
  return out;
}

function comAnotacoes(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addDimension', levelId: LV0, dimension: { id: 'd1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, offset: 1 } });
  s.exec({ type: 'addText', levelId: LV0, text: { id: 't1', at: { x: 2, y: 2 }, text: 'Sala', height: 2.5, rotation: 90 } });
  return s;
}

describe('anotações no DXF da planta', () => {
  it('cota: 5 LINE na camada COTAS (linha, 2 chamadas, 2 marcas) e o valor em TEXT na mesma camada', () => {
    const notes = notesDxfOf(comAnotacoes().project, LV0, 100);
    expect(notes.lines).toHaveLength(5);
    const texts = notes.texts.filter((t) => t.layer === DXF_LAYER_COTAS);
    expect(texts.map((t) => t.text)).toEqual(['4,00 m']);
    // Altura em metros de desenho: 2,5 mm de papel na escala 1:100 = 0,25 m.
    expect(texts[0]!.height).toBeCloseTo(0.25, 9);
  });

  it('texto livre vai para TEXTOS, com a altura e a rotação do próprio texto', () => {
    const notes = notesDxfOf(comAnotacoes().project, LV0, 100);
    expect(notes.texts.find((t) => t.layer === DXF_LAYER_TEXTOS)).toMatchObject({ text: 'Sala', rotation: 90, at: { x: 2, y: 2 } });
  });

  it('exportDxf escreve LINE em COTAS, TEXT em COTAS e TEXTOS e declara as duas camadas', () => {
    const dxf = exportDxf(comAnotacoes().project, LV0, { ...GEO, notes: notesDxfOf(comAnotacoes().project, LV0, 100) });
    const ents = entities(dxf);
    const lines = ents.filter((e) => e.type === 'LINE' && e.rec.get(8) === DXF_LAYER_COTAS);
    expect(lines).toHaveLength(5);
    const texts = ents.filter((e) => e.type === 'TEXT');
    expect(texts.map((e) => [e.rec.get(8), e.rec.get(1)])).toEqual([
      [DXF_LAYER_COTAS, '4,00 m'],
      [DXF_LAYER_TEXTOS, 'Sala'],
    ]);
    expect(dxf).toMatch(/\r\n2\r\nCOTAS\r\n/);
    expect(dxf).toMatch(/\r\n2\r\nTEXTOS\r\n/);
  });

  it('sem anotações o arquivo não ganha as camadas', () => {
    const dxf = exportDxf(createEmptyProject(), LV0, GEO);
    expect(dxf).not.toMatch(/COTAS|TEXTOS/);
  });

  it('registros do TEXT: centrado, com altura e rotação', () => {
    const rec = Object.fromEntries(dxfTextRecords({ at: { x: 1, y: 2 }, text: 'A', height: 0.25, rotation: 90, layer: DXF_LAYER_TEXTOS }).map(([c, v]) => [c, v]));
    expect(rec[40]).toBe('0.250000');
    expect(rec[50]).toBe('90.000000');
    expect(rec[72]).toBe(1);
    expect(rec[73]).toBe(2);
  });
});
