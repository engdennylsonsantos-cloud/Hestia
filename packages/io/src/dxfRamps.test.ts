import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@hestia/model';
import {
  DXF_LAYER_RAMP,
  DXF_LAYER_RAMP_ABOVE,
  DXF_LAYER_RAMP_ARROW,
  DXF_LAYER_RAMP_CUT,
  DXF_LAYER_RAMP_TEXT,
  dxfLayersOf,
  dxfLineRoleOf,
  exportDxf,
  type DxfLevelGeometry,
  type DxfPoint,
} from './dxf.ts';
import type { DxfNoteText } from './dxfNotes.ts';

const p = createEmptyProject('Teste');
const base: DxfLevelGeometry = { clusters: [], openings: [] };
const square: DxfPoint[] = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1.5 },
  { x: 0, y: 1.5 },
];
const above: DxfPoint[] = [
  { x: 2, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1.5 },
  { x: 2, y: 1.5 },
];
const text: DxfNoteText = { at: { x: 1, y: 0.75 }, text: '8,33 % (1:12)', height: 0.2, rotation: 90, layer: DXF_LAYER_RAMP_TEXT };

const geo: DxfLevelGeometry = {
  ...base,
  ramps: [
    {
      outlines: [square],
      outlinesAbove: [above],
      arrow: [[{ x: 0, y: 0.75 }, { x: 2, y: 0.75 }]],
      cut: [[{ x: 1, y: 0 }, { x: 1, y: 1.5 }]],
      texts: [text],
    },
  ],
};

describe('DXF: camadas da rampa', () => {
  it('registra as cinco camadas e o papel de largura de linha', () => {
    const layers = dxfLayersOf(p, geo);
    for (const layer of [DXF_LAYER_RAMP, DXF_LAYER_RAMP_ABOVE, DXF_LAYER_RAMP_ARROW, DXF_LAYER_RAMP_CUT, DXF_LAYER_RAMP_TEXT]) {
      expect(layers).toContain(layer);
    }
    expect(dxfLineRoleOf(DXF_LAYER_RAMP)).toEqual({ category: 'stair', view: 'cut' });
    expect(dxfLineRoleOf(DXF_LAYER_RAMP_ABOVE)).toEqual({ category: 'stair', view: 'projection' });
    expect(dxfLineRoleOf(DXF_LAYER_RAMP_ARROW)).toBe('annotation');
    expect(dxfLineRoleOf(DXF_LAYER_RAMP_CUT)).toBe('annotation');
    expect(dxfLineRoleOf(DXF_LAYER_RAMP_TEXT)).toBe('annotation');
  });

  it('RAMPA_ACIMA sai tracejada na tabela LAYER', () => {
    const out = exportDxf(p, 'lv_0', geo);
    expect(out).toContain('\r\nRAMPA_ACIMA\r\n70\r\n0\r\n62\r\n7\r\n6\r\nDASHED\r\n');
  });

  it('os contornos, as linhas e o texto da inclinação saem no arquivo', () => {
    const out = exportDxf(p, 'lv_0', geo);
    expect(out).toContain('\r\nPOLYLINE\r\n8\r\nRAMPA\r\n');
    expect(out).toContain('\r\nPOLYLINE\r\n8\r\nRAMPA_ACIMA\r\n');
    expect(out).toContain('\r\nLINE\r\n8\r\nRAMPA_SETA\r\n');
    expect(out).toContain('\r\nLINE\r\n8\r\nRAMPA_CORTE\r\n');
    expect(out).toContain('8,33 % (1:12)');
    expect(out).toContain('\r\nRAMPA_TEXTO\r\n');
  });

  it('sem rampas, nenhuma camada de rampa aparece', () => {
    const out = exportDxf(p, 'lv_0', base);
    expect(out).not.toContain('RAMPA');
  });
});
