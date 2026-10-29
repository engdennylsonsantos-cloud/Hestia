import { describe, expect, it } from 'vitest';
import { isGeneric } from '@hestia/model';
import { importIfc } from './index.ts';

/**
 * Arquivo IFC4 mínimo, sem `IfcBuildingStorey`, com duas paredes em L (contorno de 6 pontos, não retangular) e uma
 * porta sem `IfcRelFillsElement` — os três casos que antes eram descartados e agora viram objeto genérico.
 */
function ifc(): string {
  const wall = (id: number, guid: string, z: number): string[] => [
    `#${id}= IFCWALL('${guid}',$,'Parede L',$,$,#${id + 1},#${id + 2},$,.SOLIDWALL.);`,
    `#${id + 1}= IFCLOCALPLACEMENT($,#${id + 3});`,
    `#${id + 3}= IFCAXIS2PLACEMENT3D(#${id + 4},$,$);`,
    `#${id + 4}= IFCCARTESIANPOINT((0.,0.,${z}.));`,
    `#${id + 2}= IFCPRODUCTDEFINITIONSHAPE($,$,(#${id + 5}));`,
    `#${id + 5}= IFCSHAPEREPRESENTATION(#90,'Body','SweptSolid',(#${id + 6}));`,
    `#${id + 6}= IFCEXTRUDEDAREASOLID(#${id + 7},#95,#96,3000.);`,
    `#${id + 7}= IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#${id + 8});`,
    `#${id + 8}= IFCPOLYLINE((#100,#101,#102,#103,#104,#105,#100));`,
  ];
  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
    "#1= IFCPROJECT('proj',$,'Teste',$,$,$,$,$,#2);",
    '#2= IFCUNITASSIGNMENT((#3));',
    '#3= IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);',
    ...wall(10, 'wall0', 0),
    ...wall(20, 'wall3', 3000),
    "#40= IFCDOOR('door1',$,'Porta sem vão',$,$,#41,#42,$,2100.,900.,$,$,$);",
    '#41= IFCLOCALPLACEMENT($,#43);',
    '#43= IFCAXIS2PLACEMENT3D(#44,$,$);',
    '#44= IFCCARTESIANPOINT((0.,0.,0.));',
    '#42= IFCPRODUCTDEFINITIONSHAPE($,$,(#45));',
    "#45= IFCSHAPEREPRESENTATION(#90,'Body','SweptSolid',(#46));",
    '#46= IFCEXTRUDEDAREASOLID(#47,#95,#96,50.);',
    '#47= IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#48);',
    '#48= IFCPOLYLINE((#110,#111,#112,#113,#110));',
    '#90= IFCGEOMETRICREPRESENTATIONCONTEXT($,$,3,1.E-5,$,$);',
    '#95= IFCAXIS2PLACEMENT3D(#97,$,$);',
    '#97= IFCCARTESIANPOINT((0.,0.,0.));',
    '#96= IFCDIRECTION((0.,0.,1.));',
    '#100= IFCCARTESIANPOINT((0.,0.));',
    '#101= IFCCARTESIANPOINT((3000.,0.));',
    '#102= IFCCARTESIANPOINT((3000.,200.));',
    '#103= IFCCARTESIANPOINT((200.,200.));',
    '#104= IFCCARTESIANPOINT((200.,3000.));',
    '#105= IFCCARTESIANPOINT((0.,3000.));',
    '#110= IFCCARTESIANPOINT((0.,0.));',
    '#111= IFCCARTESIANPOINT((900.,0.));',
    '#112= IFCCARTESIANPOINT((900.,50.));',
    '#113= IFCCARTESIANPOINT((0.,50.));',
    'ENDSEC;',
    'END-ISO-10303-21;',
  ].join('\n');
}

describe('fallback para objeto genérico', () => {
  const { project, report } = importIfc(ifc());

  it('parede em L vira genérico com a classe IFCWALL, em vez de ser descartada', () => {
    const walls = Object.values(project.elements).filter(isGeneric).filter((g) => g.sourceClass === 'IFCWALL');
    expect(walls).toHaveLength(2);
    for (const w of walls) {
      expect(w.mesh.positions.length).toBeGreaterThan(0);
      expect(w.outline?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
    expect(report.skipped.IFCWALL ?? 0).toBe(0);
    expect(report.generic.IFCWALL).toBe(2);
  });

  it('porta sem IfcRelFillsElement vira genérico, não fica de fora', () => {
    const doors = Object.values(project.elements).filter(isGeneric).filter((g) => g.sourceClass === 'IFCDOOR');
    expect(doors).toHaveLength(1);
    expect(report.skipped.IFCDOOR ?? 0).toBe(0);
    expect(report.generic.IFCDOOR).toBe(1);
  });

  it('sem IfcBuildingStorey, infere os níveis pela cota das paredes', () => {
    expect(report.levels).toBe(2);
    expect(project.levels.map((l) => Math.round(l.elevation * 100) / 100)).toEqual([0, 3]);
    expect(project.levels[1]!.name).toContain('2');
  });
});
