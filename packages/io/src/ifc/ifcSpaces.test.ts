import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, levelElevation, makeRoom, makeWall, type Project } from '@hestia/model';
import { addSpaces } from './ifcSpaces.ts';
import { gid, type IfcCtx, type IfcStorey } from './ifcCtx.ts';
import { axis3, localPlacement } from './ifcSolids.ts';
import { en, num, OMIT, ref, StepWriter, stepString } from './ifcStep.ts';

const TS = '1970-01-01T00:00:00';

/** Contexto mínimo: unidade, contexto de geometria e um IFCSITE/IFCBUILDINGSTOREY por nível, como o exportador. */
function ctxOf(p: Project): IfcCtx {
  const w = new StepWriter();
  w.add('IFCSIUNIT', ['*', en('LENGTHUNIT'), OMIT, en('METRE')]);
  const world = axis3(w, [0, 0, 0]);
  const ctx = w.add('IFCGEOMETRICREPRESENTATIONCONTEXT', [OMIT, "'Model'", '3', num(1e-5), ref(world), OMIT]);
  const storeys = new Map<string, IfcStorey>();
  for (const level of p.levels) {
    const elev = levelElevation(p, level.id);
    const place = localPlacement(w, null, [0, 0, elev]);
    const id = w.add('IFCBUILDINGSTOREY', [gid(`storey:${level.id}`), OMIT, stepString(level.name), OMIT, OMIT, ref(place), OMIT, OMIT, en('ELEMENT'), num(elev)]);
    storeys.set(level.id, { id, place, elev, contained: [] });
  }
  return { p, w, ctx, storeys, materials: new Map(), walls: new Map(), layerSets: new Map(), openingTypes: new Map(), openingTypeMembers: new Map(), external: new Set() };
}

const count = (text: string, type: string): number => (text.match(new RegExp(`=${type}\\(`, 'g')) ?? []).length;

/** Todo `#n` referenciado tem de existir como entidade definida. */
function danglingRefs(text: string): number[] {
  const defined = new Set([...text.matchAll(/^#(\d+)=/gm)].map((m) => Number(m[1])));
  return [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])).filter((id) => !defined.has(id));
}

/** Retângulo 4 × 5 com as faces internas no anel (locationLine finishInterior) e dois ambientes. */
function projectWithRooms(opts: { heightOffset?: number; ceilingHeight?: number } = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  const ring: Array<[number, number]> = [
    [0, 0],
    [0, 5],
    [4, 5],
    [4, 0],
  ];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    s.exec({
      type: 'addWall',
      wall: makeWall({
        id: `w${i}`,
        typeId: 'wt_alv14',
        levelId: 'lv_0',
        a: { x: a[0], y: a[1] },
        b: { x: b[0], y: b[1] },
        locationLine: 'finishInterior',
      }),
    });
  });
  s.exec({
    type: 'addRoom',
    room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 }, ...opts }),
  });
  // Sem paredes no nível de cima: o ponto não fecha circuito e o ambiente não pode virar IFCSPACE.
  s.exec({ type: 'addRoom', room: makeRoom({ id: 'r2', levelId: 'lv_1', name: 'Fora', number: '202', point: { x: 50, y: 50 } }) });
  return s.project;
}

describe('addSpaces', () => {
  const p = projectWithRooms();
  const c = ctxOf(p);
  addSpaces(c);
  const text = c.w.text({ fileName: 'espacos.ifc', timestamp: TS });

  it('cria um IFCSPACE por ambiente com contorno resolvido, no pavimento do nível', () => {
    expect(count(text, 'IFCSPACE')).toBe(1);
    expect(c.storeys.get('lv_0')!.contained).toHaveLength(1);
    expect(c.storeys.get('lv_1')!.contained).toHaveLength(0);
    expect(text).toContain(ifcGuidOf('space:r1'));
  });

  it('leva número no Name, nome no LongName, composição, tipo SPACE e categoria no ObjectType', () => {
    expect(text).toContain("IFCSPACE(");
    expect(text).toContain("'Sala'");
    expect(text).toContain("'101'");
    expect(text).toContain("'Pset_SpaceCommon'");
    expect(text).toContain(',.ELEMENT.,.SPACE.,');
    expect(count(text, 'IFCEXTRUDEDAREASOLID')).toBe(1);
    expect(count(text, 'IFCPRODUCTDEFINITIONSHAPE')).toBe(1);
  });

  it('emite Qto_SpaceBaseQuantities com área líquida, área bruta, altura, perímetros e volume', () => {
    expect(count(text, 'IFCELEMENTQUANTITY')).toBe(1);
    expect(text).toContain("'Qto_SpaceBaseQuantities'");
    expect(text).toContain("IFCQUANTITYAREA('NetFloorArea',$,$,20.000000,$)");
    expect(text).toContain("IFCQUANTITYAREA('GrossFloorArea',$,$,20.000000,$)");
    expect(text).toContain("IFCQUANTITYLENGTH('Height',$,$,2.800000,$)");
    expect(text).toContain("IFCQUANTITYLENGTH('NetPerimeter',$,$,18.000000,$)");
    expect(text).toContain("IFCQUANTITYLENGTH('GrossPerimeter',$,$,18.000000,$)");
    expect(text).toContain("IFCQUANTITYVOLUME('NetVolume',$,$,56.000000,$)");
    expect(count(text, 'IFCRELDEFINESBYPROPERTIES')).toBe(2);
  });

  it('referências íntegras e determinismo', () => {
    expect(danglingRefs(text)).toEqual([]);
    const again = ctxOf(p);
    addSpaces(again);
    expect(again.w.text({ fileName: 'espacos.ifc', timestamp: TS })).toBe(text);
  });

  it('ambiente com contorno e pé-direito maior usa heightOffset e altura do modelo', () => {
    const q = projectWithRooms({ heightOffset: 0.1, ceilingHeight: 3 });
    const cq = ctxOf(q);
    addSpaces(cq);
    const out = cq.w.text({ fileName: 'espacos.ifc', timestamp: TS });
    // Extrusão começa em 0,10 (local) e sobe 3,00; a cota do piso acabado é a do nível + 0,10.
    expect(out).toContain(',.ELEMENT.,.SPACE.,0.100000)');
    expect(out).toContain("IFCQUANTITYLENGTH('Height',$,$,3.000000,$)");
    expect(danglingRefs(out)).toEqual([]);
  });
});

/** GlobalId cru (sem as aspas do STEP) da chave. */
function ifcGuidOf(key: string): string {
  return gid(key).slice(1, -1);
}
