import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project } from '@hestia/model';
import { DXF_LINE_WEIGHT_DEFAULT } from './dxf.ts';
import {
  DXF_SECTION_LAYER_LEVELS,
  DXF_SECTION_LAYER_SILHOUETTE,
  dxfSectionLayerOf,
  dxfSectionLayersOf,
  dxfSectionLineRoleOf,
  exportSectionDxf,
  type DxfSectionGeometry,
} from './dxfSection.ts';

/** Projeto com uma vista de corte (o io só confere que a vista existe). */
function withSection(): Project {
  const p = createEmptyProject();
  p.views.push({ id: 'corte_a', name: 'Corte A', kind: 'section', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, depth: 8 });
  return p;
}

const RECT = [[[{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 0 }]]];
const geo: DxfSectionGeometry = {
  cut: [{ category: 'wall', polygons: RECT }],
  beyond: [{ category: 'window', polygons: RECT }],
  silhouette: RECT,
};

/** Código 370 (largura) da camada, lido da tabela LAYER; `undefined` se a camada não leva 370. */
function layerWeight(text: string, name: string): string | undefined {
  const lines = text.split('\r\n');
  const i = lines.findIndex((l, k) => l.trim() === '2' && lines[k + 1]?.trim() === name && lines[k - 1]?.trim() === 'LAYER' && lines[k - 2]?.trim() === '0');
  if (i < 0) throw new Error(`camada ausente: ${name}`);
  for (let j = i + 2; j + 1 < lines.length && lines[j]!.trim() !== '0'; j += 2) {
    if (lines[j]!.trim() === '370') return lines[j + 1]!.trim();
  }
  return undefined;
}

describe('camadas do corte e da elevação', () => {
  it('a categoria vira a camada do corte e a de projeção (_PROJECAO); o contorno e os níveis têm nome próprio', () => {
    expect(dxfSectionLayerOf('wall')).toBe('CORTE_PAREDE');
    expect(dxfSectionLayerOf('window', 'projection')).toBe('CORTE_JANELA_PROJECAO');
    expect(dxfSectionLineRoleOf('CORTE_PAREDE')).toEqual({ category: 'wall', view: 'cut' });
    expect(dxfSectionLineRoleOf('CORTE_PORTA_PROJECAO')).toEqual({ category: 'door', view: 'projection' });
    expect(dxfSectionLineRoleOf(DXF_SECTION_LAYER_LEVELS)).toBe('annotation');
    expect(dxfSectionLineRoleOf(DXF_SECTION_LAYER_SILHOUETTE)).toEqual({ category: 'wall', view: 'cut' });
    expect(dxfSectionLineRoleOf('0')).toBeUndefined();
  });

  it('dxfSectionLayersOf lista a camada 0 e as camadas usadas, em ordem', () => {
    expect(dxfSectionLayersOf(geo)).toEqual(['0', 'CORTE_CONTORNO', 'CORTE_JANELA_PROJECAO', 'CORTE_PAREDE']);
  });
});

describe('exportSectionDxf', () => {
  it('escreve cada camada com o código 370 da largura dada (centésimos de mm, valor DXF válido)', () => {
    const text = exportSectionDxf(withSection(), 'corte_a', { ...geo, lineWeights: { CORTE_PAREDE: 50, CORTE_JANELA_PROJECAO: 18, CORTE_CONTORNO: 0 } });
    expect(layerWeight(text, 'CORTE_PAREDE')).toBe('50');
    expect(layerWeight(text, 'CORTE_JANELA_PROJECAO')).toBe('18');
    expect(layerWeight(text, 'CORTE_CONTORNO')).toBe('0');
  });

  it('sem lineWeights a tabela de camadas não leva 370 (como antes)', () => {
    const text = exportSectionDxf(withSection(), 'corte_a', geo);
    expect(layerWeight(text, 'CORTE_PAREDE')).toBeUndefined();
    expect(text).not.toContain('370\r\n');
  });

  it('camada sem largura informada leva o padrão do DXF', () => {
    const text = exportSectionDxf(withSection(), 'corte_a', { ...geo, lineWeights: {} });
    expect(layerWeight(text, 'CORTE_PAREDE')).toBe(String(DXF_LINE_WEIGHT_DEFAULT));
  });

  it('o contorno externo sai em CORTE_CONTORNO e a unidade é o metro com z para cima', () => {
    const text = exportSectionDxf(withSection(), 'corte_a', geo);
    expect(text).toContain('CORTE_CONTORNO');
    expect(text).toContain('$INSUNITS');
    expect(text.split('\r\n').filter((l) => l === 'POLYLINE')).toHaveLength(3); // janela além, parede cortada e contorno
  });

  it('recusa uma vista que não existe no projeto', () => {
    expect(() => exportSectionDxf(withSection(), 'nao_existe', geo)).toThrow('Vista ausente: nao_existe');
  });
});
