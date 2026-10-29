import { describe, expect, it } from 'vitest';
import { isGeneric, isWall, type Element, type IfcProperty } from '@hestia/model';
import fzkHaus from '../../../../tests/ifc/fixtures/fzk-haus.ifc?raw';
import { IfcFile } from './ifc.ts';
import { importIfc } from './index.ts';
import { propertiesOf } from './psets.ts';

const propsOf = (e: Element): IfcProperty[] => ('ifcProperties' in e ? (e.ifcProperties ?? []) : []);

describe('propriedades e cores do IFC (psets/quantities)', () => {
  const { project } = importIfc(fzkHaus);
  const elements = Object.values(project.elements);
  const withProps = elements.filter((e) => propsOf(e).length > 0);
  const generics = elements.filter(isGeneric);
  const walls = elements.filter(isWall);

  it('pelo menos 10 elementos importados trazem ifcProperties', () => {
    expect(withProps.length).toBeGreaterThanOrEqual(10);
  });

  it('parede do Pset_WallCommon traz IsExternal/LoadBearing como booleano', () => {
    const wallsWithCommon = walls.filter((w) =>
      propsOf(w).some((p) => p.name === 'IsExternal' || p.name === 'LoadBearing'),
    );
    expect(wallsWithCommon.length).toBeGreaterThan(0);
    expect(
      wallsWithCommon.some((w) => propsOf(w).some((p) => p.name === 'IsExternal' && p.value === true)),
    ).toBe(true);
    for (const wall of wallsWithCommon) {
      for (const p of propsOf(wall)) {
        if (p.name === 'IsExternal' || p.name === 'LoadBearing') expect(typeof p.value).toBe('boolean');
      }
    }
  });

  it('nomes Ãºnicos e ordenados, sem valor undefined/NaN/vazio', () => {
    for (const element of withProps) {
      const props = propsOf(element);
      const names = props.map((p) => p.name);
      expect(names).toEqual([...names].sort());
      expect(new Set(names).size).toBe(names.length);
      for (const { name, value } of props) {
        expect(name.trim()).not.toBe('');
        expect(value).not.toBeUndefined();
        if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        if (typeof value === 'string') expect(value.trim()).not.toBe('');
      }
    }
  });

  it('ids e propriedades sÃ£o determinÃ­sticos entre duas importaÃ§Ãµes', () => {
    const again = importIfc(fzkHaus).project;
    const snapshot = (p: typeof project): string =>
      JSON.stringify(
        Object.values(p.elements)
          .map((e) => ({ id: e.id, kind: e.kind, props: propsOf(e) }))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      );
    expect(snapshot(again)).toBe(snapshot(project));
  });

  it('genÃ©rico recebe cor #rrggbb quando o IFC tem estilo', () => {
    const colored = generics.filter((g) => typeof g.color === 'string');
    // O fzk-haus tem estilos de superfÃ­cie; mobiliÃ¡rio e guarda-corpo devem trazer cor.
    expect(colored.length).toBeGreaterThan(0);
    for (const g of colored) expect(g.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('lÃª valor enumerado/lista, descarta vazio e converte quantidade', () => {
    const text = [
      'DATA;',
      "#1= IFCRELDEFINESBYPROPERTIES('g',$,$,$,(#10),#20);",
      "#2= IFCRELDEFINESBYPROPERTIES('g',$,$,$,(#10),#25);",
      "#3= IFCRELDEFINESBYPROPERTIES('g',$,$,$,(#30),#31);",
      "#4= IFCRELDEFINESBYTYPE('g',$,$,$,(#10),#30);",
      "#10= IFCWALL('g',$,'W',$,$,$,$,$,$);",
      "#20= IFCPROPERTYSET('g',$,'Pset_Test',$,(#21,#22,#23,#24));",
      "#21= IFCPROPERTYSINGLEVALUE('External',$,IFCBOOLEAN(.T.),$);",
      "#22= IFCPROPERTYENUMERATEDVALUE('Status',$,(IFCLABEL('A'),IFCLABEL('B')),$);",
      "#23= IFCPROPERTYLISTVALUE('Tags',$,(IFCLABEL('x'),IFCLABEL('y')),$);",
      "#24= IFCPROPERTYSINGLEVALUE('Empty',$,IFCLABEL(''),$);",
      "#25= IFCELEMENTQUANTITY('g',$,'BaseQuantities',$,$,(#26,#27));",
      "#26= IFCQUANTITYLENGTH('Length',$,$,2.5);",
      "#27= IFCQUANTITYAREA('Area',$,$,7.25);",
      "#30= IFCWALLTYPE('g',$,'T',$,$,$,$,$,$,$,$);",
      "#31= IFCPROPERTYSET('g',$,'Pset_Type',$,(#32));",
      "#32= IFCPROPERTYSINGLEVALUE('TypeOnly',$,IFCLABEL('ok'),$);",
      'ENDSEC;',
    ].join('\n');
    const file = new IfcFile(text);
    const props = propertiesOf(file, file.entity(10)!, file.entity(30));
    expect(props).toEqual([
      { name: 'Area', value: 7.25, pset: 'BaseQuantities' },
      { name: 'External', value: true, pset: 'Pset_Test' },
      { name: 'Length', value: 2.5, pset: 'BaseQuantities' },
      { name: 'Status', value: 'A, B', pset: 'Pset_Test' },
      { name: 'Tags', value: 'x, y', pset: 'Pset_Test' },
      { name: 'TypeOnly', value: 'ok', pset: 'Pset_Type' },
    ]);
  });
});

