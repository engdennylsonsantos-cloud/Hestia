import { describe, expect, it } from 'vitest';
import { buildTemplate, type Project, type UnitsSettings } from '@hestia/model';
import { exportDxf, type DxfLevelGeometry } from './dxf.ts';
import { exportIfc } from './ifc/ifcExport.ts';
import type { IfcGeometry } from './ifc/ifcTypes.ts';

const base = buildTemplate('house2');
const nivel = base.levels[0]!.id;
const geoDxf: DxfLevelGeometry = { clusters: [], openings: [] };
const geoIfc: IfcGeometry = { walls: [], openings: [], floors: [], slabs: [], roofs: [], stairs: [] };
const TS = '2026-01-01T00:00:00';

const comUnidades = (units: UnitsSettings): Project => ({ ...base, settings: { ...base.settings, units } });

const METROS: UnitsSettings = {
  length: { unit: 'm', decimals: 2 },
  smallLength: { unit: 'cm', decimals: 1 },
  area: { unit: 'm2', decimals: 2 },
};
const IMPERIAL: UnitsSettings = {
  length: { unit: 'ft-in', decimals: 2, denominator: 16 },
  smallLength: { unit: 'in', decimals: 2 },
  area: { unit: 'ft2', decimals: 2 },
  volume: { unit: 'ft3', decimals: 3 },
  angle: { unit: 'rad', decimals: 3 },
  slope: { unit: 'deg', decimals: 1 },
  decimalSymbol: '.',
  currency: 'USD',
};

describe('exportações independentes da unidade de exibição', () => {
  it('DXF é sempre em metros ($INSUNITS 6)', () => {
    const texto = exportDxf(comUnidades(IMPERIAL), nivel, geoDxf);
    expect(texto).toContain('$INSUNITS');
    const linhas = texto.split(/\r?\n/);
    const i = linhas.indexOf('$INSUNITS');
    expect(linhas[i + 1]).toBe('70');
    expect(linhas[i + 2]).toBe('6');
  });

  it('IFC é sempre em metros (METRE)', () => {
    const texto = exportIfc(comUnidades(IMPERIAL), geoIfc, { timestamp: TS });
    expect(texto).toContain('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');
  });

  it('o mesmo projeto exporta bytes idênticos em metros e em pés e polegadas', () => {
    const metros = comUnidades(METROS);
    const imperial = comUnidades(IMPERIAL);
    expect(exportDxf(imperial, nivel, geoDxf)).toBe(exportDxf(metros, nivel, geoDxf));
    // O IFC carrega o `SettingsJSON` do Hestia no pset do projeto, então o texto muda com as unidades de exibição;
    // a geometria e as unidades IFC continuam em metros (teste anterior).
    expect(exportIfc(imperial, geoIfc, { timestamp: TS })).toContain('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');
    expect(exportIfc(metros, geoIfc, { timestamp: TS })).toContain('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');
  });
});
