import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, isFloor, isWall, levelElevation, makeFloor, makeWall, type Project } from '@hestia/model';
import { addQuantities } from './ifcQuantities.ts';
import { gid, type IfcCtx, type IfcStorey } from './ifcCtx.ts';
import { axis3, localPlacement } from './ifcSolids.ts';
import { en, num, OMIT, ref, StepWriter, stepString } from './ifcStep.ts';
import type { IfcGeometry, IfcWallGeo } from './ifcTypes.ts';

const TS = '1970-01-01T00:00:00';

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

function danglingRefs(text: string): number[] {
  const defined = new Set([...text.matchAll(/^#(\d+)=/gm)].map((m) => Number(m[1])));
  return [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])).filter((id) => !defined.has(id));
}

/** Valor da primeira quantidade com o nome dado, ou null. */
function quantityValue(text: string, type: string, name: string): number | null {
  const m = new RegExp(`=${type}\\('${name}',\\$,\\$,([-0-9.]+),\\$\\)`).exec(text);
  return m ? Number(m[1]) : null;
}

function scene(): { ctx: IfcCtx; geo: IfcGeometry } {
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
    type: 'addFloor',
    floor: makeFloor({
      id: 'fl1',
      typeId: 'ft_ceram',
      levelId: 'lv_0',
      boundary: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 5 },
        { x: 0, y: 5 },
      ],
    }),
  });
  // Piso sem entidade IFC escrita: não pode receber quantitativos.
  s.exec({
    type: 'addFloor',
    floor: makeFloor({
      id: 'fl2',
      typeId: 'ft_ceram',
      levelId: 'lv_0',
      boundary: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 2 },
        { x: 10, y: 2 },
      ],
    }),
  });
  const p = s.project;
  const ctx = ctxOf(p);

  // Entidades como o exportador as escreve: GlobalId determinístico é o que liga o conjunto ao elemento.
  for (const e of Object.values(p.elements)) {
    if (!isWall(e)) continue;
    const id = ctx.w.add('IFCWALL', [gid(`wall:${e.id}`), OMIT, stepString(e.id), OMIT, OMIT, OMIT, OMIT, OMIT, en('STANDARD')]);
    ctx.walls.set(e.id, id);
  }
  for (const e of Object.values(p.elements)) {
    if (!isFloor(e) || e.id !== 'fl1') continue;
    ctx.w.add('IFCSLAB', [gid(`floor:${e.id}`), OMIT, stepString('Piso'), OMIT, OMIT, OMIT, OMIT, OMIT, en('FLOOR')]);
  }

  const walls: IfcWallGeo[] = Object.values(p.elements)
    .filter(isWall)
    .map((w) => ({ wallId: w.id, footprints: [], baseZ: 0, height: 2.8 }));
  const geo: IfcGeometry = { walls, openings: [], floors: [{ floorId: 'fl1', prisms: [] }], slabs: [], roofs: [], stairs: [] };
  return { ctx, geo };
}

describe('addQuantities', () => {
  const { ctx, geo } = scene();
  addQuantities(ctx, geo);
  const text = ctx.w.text({ fileName: 'quantitativos.ifc', timestamp: TS });

  it('um conjunto por elemento escrito (4 paredes + 1 piso) ligado por IFCRELDEFINESBYPROPERTIES', () => {
    expect(count(text, 'IFCELEMENTQUANTITY')).toBe(5);
    expect(count(text, 'IFCRELDEFINESBYPROPERTIES')).toBe(5);
    expect(text.split("'Qto_WallBaseQuantities'").length - 1).toBe(4);
    expect(text.split("'Qto_SlabBaseQuantities'").length - 1).toBe(1);
    expect(text).toContain(gid('qto:wall:w0'));
    expect(danglingRefs(text)).toEqual([]);
  });

  it('a parede leva comprimento, altura, largura, áreas e volumes do motor', () => {
    // Parede de 5 m de comprimento; largura do tipo wt_alv14 = 0,184 m.
    expect(quantityValue(text, 'IFCQUANTITYLENGTH', 'Length')).toBeCloseTo(5, 6);
    expect(quantityValue(text, 'IFCQUANTITYLENGTH', 'Height')).toBeCloseTo(2.8, 6);
    expect(quantityValue(text, 'IFCQUANTITYLENGTH', 'Width')).toBeCloseTo(0.184, 6);
    for (const name of ['GrossSideArea', 'NetSideArea']) {
      const v = quantityValue(text, 'IFCQUANTITYAREA', name);
      expect(v, name).not.toBeNull();
      expect(v!, name).toBeGreaterThan(0);
    }
    const gross = quantityValue(text, 'IFCQUANTITYVOLUME', 'GrossVolume');
    expect(gross).not.toBeNull();
    expect(gross!).toBeGreaterThan(0);
  });

  it('o piso leva áreas, volume e espessura, e o piso sem entidade fica de fora', () => {
    expect(quantityValue(text, 'IFCQUANTITYAREA', 'GrossArea')).toBeCloseTo(20, 6);
    const netArea = quantityValue(text, 'IFCQUANTITYAREA', 'NetArea');
    expect(netArea).not.toBeNull();
    expect(netArea!).toBeGreaterThan(0);
    expect(netArea!).toBeLessThanOrEqual(20 + 1e-6);
    expect(quantityValue(text, 'IFCQUANTITYLENGTH', 'Thickness')).toBeCloseTo(0.19, 6);
    expect(quantityValue(text, 'IFCQUANTITYVOLUME', 'NetVolume')).not.toBeNull();
    expect(text).not.toContain(gid('qto:floor:fl2'));
  });

  it('conta o tipo certo de IFCQUANTITY para cada medida', () => {
    expect(count(text, 'IFCQUANTITYLENGTH')).toBe(4 * 3 + 1);
    expect(count(text, 'IFCQUANTITYAREA')).toBe(4 * 2 + 2);
    expect(count(text, 'IFCQUANTITYVOLUME')).toBe(4 * 2 + 2);
    expect(count(text, 'IFCQUANTITYCOUNT')).toBe(0);
  });

  it('é determinístico: a mesma entrada dá o mesmo texto', () => {
    const again = scene();
    addQuantities(again.ctx, again.geo);
    expect(again.ctx.w.text({ fileName: 'quantitativos.ifc', timestamp: TS })).toBe(text);
  });

  it('projeto sem elementos não escreve conjunto', () => {
    const c0 = ctxOf(createEmptyProject());
    addQuantities(c0, { walls: [], openings: [], floors: [], slabs: [], roofs: [], stairs: [] });
    expect(count(c0.w.text({ fileName: 'vazio.ifc', timestamp: TS }), 'IFCELEMENTQUANTITY')).toBe(0);
  });
});
