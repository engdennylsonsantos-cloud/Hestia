import { describe, expect, it } from 'vitest';
import { dxfLayersOf, dxfProblems2000 } from '@hestia/io';
import { ProjectStore, buildTemplate, type CadDrawing } from '@hestia/model';
import { cadDxfLayerName, dxfGeometryOf, planDxf } from './dxfExport.ts';

/** Registros do DXF: cada código 0 abre um registro com os pares seguintes. */
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

/** Campo de um registro (o primeiro com o código pedido). */
const fieldOf = (pairs: Array<[number, string]>, code: number): string | undefined => pairs.find(([c]) => c === code)?.[1];

/** Projeto do teste: um CAD no térreo, com um quadrado fechado, um traço solto, um traço com cor própria e um texto. */
function cadProject(): ProjectStore {
  const store = new ProjectStore(buildTemplate('blank'));
  const cad: Omit<CadDrawing, 'order'> = {
    id: 'cad_1',
    kind: 'cad',
    levelId: 'lv_0',
    name: 'Planta do arquiteto',
    source: 'dxf',
    unit: 'm',
    layers: [
      { name: 'PAREDES', color: 1 },
      { name: 'MOBILIARIO', color: 5 },
      { name: 'COTAS', color: 3 },
    ],
    paths: [
      { layer: 'PAREDES', closed: true, pts: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] },
      { layer: 'MOBILIARIO', closed: false, pts: [{ x: 1, y: 1 }, { x: 2, y: 1 }] },
      // Cor própria da entidade: vence a cor da camada no estilo da camada do CAD.
      { layer: 'COTAS', closed: false, color: 6, pts: [{ x: 0, y: 5 }, { x: 3, y: 5 }] },
    ],
    texts: [{ layer: 'MOBILIARIO', at: { x: 1, y: 2 }, text: 'SALA', height: 0.2, rotation: 90 }],
  };
  store.exec({ type: 'addCadDrawing', cad });
  return store;
}

const PAREDES = cadDxfLayerName('Planta do arquiteto', 'PAREDES');
const MOBILIARIO = cadDxfLayerName('Planta do arquiteto', 'MOBILIARIO');
const COTAS = cadDxfLayerName('Planta do arquiteto', 'COTAS');

describe('CAD importado no DXF', () => {
  it('as camadas do CAD entram na tabela com o nome sanitizado', () => {
    expect(PAREDES).toBe('CAD_PLANTA_DO_ARQUITETO_PAREDES');
    const layers = dxfLayersOf(cadProject().project, dxfGeometryOf(cadProject().project, 'lv_0'));
    expect(layers).toEqual(expect.arrayContaining([PAREDES, MOBILIARIO, COTAS]));
  });

  it('cada traço vira LINE por trecho (o fechado volta ao início) e cada texto vira TEXT', () => {
    const text = planDxf(cadProject().project, 'lv_0');
    const recs = records(text);
    const lines = recs.filter((r) => r.type === 'LINE');
    // Quadrado fechado: quatro trechos; mais o traço solto e o da camada de cotas.
    expect(lines.filter((r) => fieldOf(r.pairs, 8) === PAREDES)).toHaveLength(4);
    expect(lines.filter((r) => fieldOf(r.pairs, 8) === MOBILIARIO)).toHaveLength(1);
    expect(lines.filter((r) => fieldOf(r.pairs, 8) === COTAS)).toHaveLength(1);
    const texts = recs.filter((r) => r.type === 'TEXT' && fieldOf(r.pairs, 8) === MOBILIARIO);
    expect(texts).toHaveLength(1);
    expect(fieldOf(texts[0]!.pairs, 1)).toBe('SALA');
    expect(fieldOf(texts[0]!.pairs, 40)).toBe('0.200000');
    expect(fieldOf(texts[0]!.pairs, 50)).toBe('90.000000');
  });

  it('a cor da tabela LAYER é a ACI do CAD, e não o padrão do dxfLayerStyleOf', () => {
    const text = planDxf(cadProject().project, 'lv_0');
    const layerOf = (name: string): Array<[number, string]> | undefined =>
      records(text).find((r) => r.type === 'LAYER' && fieldOf(r.pairs, 2) === name)?.pairs;
    expect(fieldOf(layerOf(PAREDES) ?? [], 62)).toBe('1');
    expect(fieldOf(layerOf(MOBILIARIO) ?? [], 62)).toBe('5');
    // A entidade com cor própria manda no estilo da camada do CAD.
    expect(fieldOf(layerOf(COTAS) ?? [], 62)).toBe('6');
    for (const name of [PAREDES, MOBILIARIO, COTAS]) {
      expect(fieldOf(layerOf(name) ?? [], 6)).toBe('CONTINUOUS');
      expect(fieldOf(layerOf(name) ?? [], 370)).toBe('0');
    }
  });

  it('a tabela editável do projeto (dxfLayers) continua vencendo o CAD', () => {
    const p = structuredClone(cadProject().project);
    p.dxfLayers = { [PAREDES]: { color: 4, lineWeight: 25, linetype: 'DASHED' } };
    const text = planDxf(p, 'lv_0');
    const layer = records(text).find((r) => r.type === 'LAYER' && fieldOf(r.pairs, 2) === PAREDES);
    expect([fieldOf(layer?.pairs ?? [], 62), fieldOf(layer?.pairs ?? [], 6), fieldOf(layer?.pairs ?? [], 370)]).toEqual(['4', 'DASHED', '25']);
  });

  it('o documento do CAD passa no verificador do R2000', () => {
    expect(dxfProblems2000(planDxf(cadProject().project, 'lv_0'))).toEqual([]);
  });

  it('CAD invisível não sai no arquivo', () => {
    const store = cadProject();
    store.exec({ type: 'updateCadDrawing', id: 'cad_1', patch: { visible: false } });
    expect(planDxf(store.project, 'lv_0')).not.toContain(PAREDES);
  });
});
