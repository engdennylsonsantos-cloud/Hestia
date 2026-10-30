import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands.ts';
import { dxfLineWeightLabel, type DxfLayerStyle } from './dxfLayerStyle.ts';
import { createEmptyProject } from './defaults.ts';

const style = (patch: Partial<DxfLayerStyle> = {}): DxfLayerStyle => ({ color: 1, lineWeight: 50, linetype: 'CONTINUOUS', ...patch });

describe('rótulo da espessura do DXF', () => {
  it('mostra mm com vírgula e "Padrão" para -3', () => {
    expect(dxfLineWeightLabel(50)).toBe('0,50 mm');
    expect(dxfLineWeightLabel(5)).toBe('0,05 mm');
    expect(dxfLineWeightLabel(211)).toBe('2,11 mm');
    expect(dxfLineWeightLabel(-3)).toBe('Padrão');
  });
});

describe('comandos da tabela de camadas do DXF', () => {
  it('grava o estilo por camada e troca o da mesma camada', () => {
    const p = createEmptyProject();
    applyCommand(p, { type: 'setDxfLayerStyle', layer: 'PAREDE_ALVENARIA', style: style() });
    expect(p.dxfLayers).toEqual({ PAREDE_ALVENARIA: style() });
    applyCommand(p, { type: 'setDxfLayerStyle', layer: 'PAREDE_ALVENARIA', style: style({ color: 5, lineWeight: 100 }) });
    expect(p.dxfLayers?.['PAREDE_ALVENARIA']).toEqual(style({ color: 5, lineWeight: 100 }));
  });

  it('ignora camada vazia e restaura o padrão', () => {
    const p = createEmptyProject();
    applyCommand(p, { type: 'setDxfLayerStyle', layer: '   ', style: style() });
    expect(p.dxfLayers).toBeUndefined();
    applyCommand(p, { type: 'setDxfLayerStyle', layer: 'COTAS', style: style({ lineWeight: 0 }) });
    applyCommand(p, { type: 'resetDxfLayers' });
    expect(p.dxfLayers).toBeUndefined();
  });
});
