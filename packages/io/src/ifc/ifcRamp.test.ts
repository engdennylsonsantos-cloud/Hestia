import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project, type Ramp } from '@hestia/model';
import { exportIfc } from './ifcExport.ts';
import { stepString } from './ifcStep.ts';
import type { IfcGeometry, IfcPolygon, IfcPrism, IfcRampGeo } from './ifcTypes.ts';

const TS = '2026-01-01T00:00:00';

const count = (text: string, type: string): number => (text.match(new RegExp(`=${type}\\(`, 'g')) ?? []).length;

const rect: IfcPolygon = [[
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1.5 },
  { x: 0, y: 1.5 },
]];

const flatPrism = (z: number): IfcPrism => ({ polygon: rect, top: { a: 0, b: 0, c: z + 0.15 }, bottom: { a: 0, b: 0, c: z } });

const flightPrism = (): IfcPrism => ({
  polygon: rect,
  top: { a: 1 / 12, b: 0, c: 0 },
  bottom: { a: 1 / 12, b: 0, c: -0.150519 },
});

/** Projeto enxuto com uma rampa sintética (o teste exercita o io, sem o motor). */
function projectWith(shape: RampGeoShape, ramps: IfcRampGeo[]): { p: Project; geo: IfcGeometry } {
  const base = createEmptyProject('Teste');
  const ramp = { id: 'rp1', kind: 'ramp', typeId: 'rmt_nbr9050', levelId: 'lv_0', shape } as unknown as Ramp;
  const p: Project = { ...base, elements: { ...base.elements, rp1: ramp } };
  const geo: IfcGeometry = { walls: [], openings: [], floors: [], slabs: [], roofs: [], stairs: [], ramps };
  return { p, geo };
}

type RampGeoShape = IfcRampGeo['shape'];

const rampGeo = (shape: RampGeoShape, flights: number, landings: number): IfcRampGeo => ({
  rampId: 'rp1',
  levelId: 'lv_0',
  shape,
  slope: 1 / 12,
  flights: Array.from({ length: flights }, (_, i) => ({ componentIndex: i, prism: flightPrism(), length: 7.2 })),
  landings: Array.from({ length: landings }, (_, i) => flatPrism(0.6 + i * 0.6)),
});

describe('exportIfc: rampa reta de 1 lance', () => {
  const { p, geo } = projectWith('straight', [rampGeo('straight', 1, 0)]);
  const text = exportIfc(p, geo, { timestamp: TS });

  it('sai um IFCRAMP com um IFCRAMPFLIGHT agregado', () => {
    expect(count(text, 'IFCRAMP')).toBe(1);
    expect(count(text, 'IFCRAMPFLIGHT')).toBe(1);
    const base = exportIfc(p, { ...geo, ramps: [] }, { timestamp: TS });
    expect(count(text, 'IFCRELAGGREGATES')).toBe(count(base, 'IFCRELAGGREGATES') + 1);
  });

  it('usa STRAIGHT_RUN_RAMP e STRAIGHT no lance', () => {
    expect(text).toContain('.STRAIGHT_RUN_RAMP.');
    expect(text).toContain('.STRAIGHT.');
  });

  it('sai sem undefined nem NaN', () => {
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });
});

describe('exportIfc: rampa reta de 2 lances com patamar', () => {
  const { p, geo } = projectWith('straight', [rampGeo('straight', 2, 1)]);
  const text = exportIfc(p, geo, { timestamp: TS });

  it('usa TWO_STRAIGHT_RUN_RAMP, dois lances e um IFCSLAB LANDING', () => {
    expect(text).toContain('.TWO_STRAIGHT_RUN_RAMP.');
    expect(count(text, 'IFCRAMPFLIGHT')).toBe(2);
    expect(count(text, 'IFCSLAB')).toBe(1);
    expect(text).toContain('.LANDING.');
  });
});

describe('exportIfc: formas em L e em U', () => {
  it('rampa em L usa QUARTER_TURN_RAMP', () => {
    const { p, geo } = projectWith('lshape', [rampGeo('lshape', 2, 1)]);
    expect(exportIfc(p, geo, { timestamp: TS })).toContain('.QUARTER_TURN_RAMP.');
  });

  it('rampa em U usa HALF_TURN_RAMP', () => {
    const { p, geo } = projectWith('ushape', [rampGeo('ushape', 2, 1)]);
    expect(exportIfc(p, geo, { timestamp: TS })).toContain('.HALF_TURN_RAMP.');
  });
});

describe('exportIfc: nome do tipo e ausência de rampa', () => {
  it('o nome do tipo sai pelo stepString, com acento escapado', () => {
    const { p, geo } = projectWith('straight', [rampGeo('straight', 1, 0)]);
    const nome = 'Rampa de concreto (NBR 9050) — aço';
    const type = p.rampTypes.rmt_nbr9050!;
    const q: Project = { ...p, rampTypes: { ...p.rampTypes, rmt_nbr9050: { ...type, name: nome } } };
    const text = exportIfc(q, geo, { timestamp: TS });
    expect(text).toContain(stepString(nome));
    expect(text).toContain('\\X2\\');
  });

  it('sem rampas, nenhum IFCRAMP aparece', () => {
    const p = createEmptyProject('Vazio');
    const geo: IfcGeometry = { walls: [], openings: [], floors: [], slabs: [], roofs: [], stairs: [], ramps: [] };
    const text = exportIfc(p, geo, { timestamp: TS });
    expect(count(text, 'IFCRAMP')).toBe(0);
  });

  it('as cotas dos prismas não viram NaN (topo inclinado e fundo paralelo)', () => {
    const { p, geo } = projectWith('straight', [rampGeo('straight', 2, 1)]);
    const text = exportIfc(p, geo, { timestamp: TS });
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
    expect(count(text, 'IFCRAMPFLIGHT')).toBe(2);
  });
});
