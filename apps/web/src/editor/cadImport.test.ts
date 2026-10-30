import { describe, expect, it } from 'vitest';
import { writeDxf2000 } from '@hestia/io';
import { importCadFile } from './cadImport.ts';

/** DXF em metros com uma LINE de (0,0) a (2,0) e um TEXT em (1,1). */
const dxf = writeDxf2000({
  layers: [{ name: 'LINHAS', color: 3, linetype: 'CONTINUOUS' }],
  entities: [
    { kind: 'line', layer: 'LINHAS', a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
    { kind: 'text', layer: 'LINHAS', at: { x: 1, y: 1 }, height: 0.5, text: 'Sala', rotation: 0 },
  ],
});

const arquivo = (): File => new File([dxf], 'planta.dxf');

describe('importCadFile', () => {
  it('devolve o rascunho do desenho com id, nome e unidade detectada', async () => {
    const desenho = await importCadFile(arquivo(), { levelId: 'lv_0' });
    expect(desenho.kind).toBe('cad');
    expect(desenho.source).toBe('dxf');
    expect(desenho.levelId).toBe('lv_0');
    expect(desenho.name).toBe('planta');
    expect(desenho.unit).toBe('m');
    expect(desenho.visible).toBe(true);
    expect(desenho.id.startsWith('cad_')).toBe(true);
    expect(desenho.layers.map((l) => l.name)).toContain('LINHAS');
    expect(desenho.paths).toHaveLength(1);
    expect(desenho.texts).toHaveLength(1);
  });

  it('aplica escala, rotação de 90° e o ponto de inserção nos traços e nos textos', async () => {
    const desenho = await importCadFile(arquivo(), { levelId: 'lv_0', at: { x: 10, y: 5 }, rotation: 90, scale: 2 });
    // (2,0) × 2 = (4,0); girar 90° = (0,4); somar (10,5) = (10,9).
    expect(desenho.paths[0]!.pts[1]!.x).toBeCloseTo(10);
    expect(desenho.paths[0]!.pts[1]!.y).toBeCloseTo(9);
    expect(desenho.paths[0]!.pts[0]!.x).toBeCloseTo(10);
    expect(desenho.paths[0]!.pts[0]!.y).toBeCloseTo(5);
    // Texto em (1,1) × 2 = (2,2); girar 90° = (-2,2); somar (10,5) = (8,7).
    expect(desenho.texts[0]!.at.x).toBeCloseTo(8);
    expect(desenho.texts[0]!.at.y).toBeCloseTo(7);
    expect(desenho.texts[0]!.height).toBeCloseTo(1);
    expect(desenho.texts[0]!.rotation).toBeCloseTo(90);
  });

  it('unit: cm reescala a geometria pelo fator entre as unidades', async () => {
    const desenho = await importCadFile(arquivo(), { levelId: 'lv_0', unit: 'cm' });
    expect(desenho.unit).toBe('cm');
    // O arquivo está em metros; declarado em cm, 2 m valem 2 cm de desenho (2 × 0,01 m).
    expect(desenho.paths[0]!.pts[1]!.x).toBeCloseTo(0.02);
    expect(desenho.paths[0]!.pts[1]!.y).toBeCloseTo(0);
    expect(desenho.texts[0]!.height).toBeCloseTo(0.005);
  });

  it('o nome pode ser trocado pelas opções', async () => {
    const desenho = await importCadFile(arquivo(), { levelId: 'lv_0', name: 'Planta baixa' });
    expect(desenho.name).toBe('Planta baixa');
  });
});
