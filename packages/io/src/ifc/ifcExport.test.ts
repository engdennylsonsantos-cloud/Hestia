import { describe, expect, it } from 'vitest';
import {
  buildTemplate,
  isOpening,
  isWall,
  levelElevation,
  openingSill,
  openingType,
  wallBaseElevation,
  wallHeight,
  wallType,
  type Floor,
  type Opening,
  type Project,
  type Roof,
  type Stair,
  type Wall,
} from '@hestia/model';
import { exportIfc } from './ifcExport.ts';
import { ifcGuid } from './ifcGuid.ts';
import type { IfcGeometry, IfcOpeningGeo, IfcPolygon, IfcWallGeo } from './ifcTypes.ts';

const TS = '2026-01-01T00:00:00';

/** Geometria "de modelo" para o teste: paredes como retângulos do eixo com a espessura do tipo; vãos no eixo. */
function geometryFromModel(p: Project): IfcGeometry {
  const walls: IfcWallGeo[] = [];
  const openings: IfcOpeningGeo[] = [];
  for (const e of Object.values(p.elements)) {
    if (!isWall(e)) continue;
    const th = wallType(p, e).layers.reduce((s, l) => s + l.thickness, 0) || 0.1;
    const footprint: IfcPolygon = [wallRect(e, th)];
    walls.push({ wallId: e.id, footprint, baseZ: wallBaseElevation(p, e), height: wallHeight(p, e) });
  }
  for (const e of Object.values(p.elements)) {
    if (!isOpening(e)) continue;
    const host = p.elements[e.hostId] as Wall;
    const t = openingType(p, e);
    const du = { x: host.b.x - host.a.x, y: host.b.y - host.a.y };
    const len = Math.hypot(du.x, du.y);
    const u = { x: du.x / len, y: du.y / len };
    const th = wallType(p, host).layers.reduce((s, l) => s + l.thickness, 0) || 0.1;
    const sillZ = wallBaseElevation(p, host) + openingSill(t, e as Opening);
    openings.push({
      openingId: e.id,
      center: { x: host.a.x + u.x * e.offset, y: host.a.y + u.y * e.offset },
      u,
      width: t.width,
      height: t.height,
      roughWidth: t.width,
      roughHeight: t.height,
      roughBottomZ: sillZ,
      sillZ,
      thickness: th,
    });
  }
  return { walls, openings, floors: [], slabs: [], roofs: [], stairs: [] };
}

/** Retângulo em planta da parede (eixo a→b, espessura `th` para o lado esquerdo e o direito). */
function wallRect(w: Wall, th: number): Array<{ x: number; y: number }> {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * (th / 2);
  const ny = (dx / len) * (th / 2);
  return [
    { x: w.a.x + nx, y: w.a.y + ny },
    { x: w.b.x + nx, y: w.b.y + ny },
    { x: w.b.x - nx, y: w.b.y - ny },
    { x: w.a.x - nx, y: w.a.y - ny },
  ];
}

const count = (text: string, type: string): number => (text.match(new RegExp(`=${type}\\(`, 'g')) ?? []).length;

/** Todo `#n` referenciado tem de existir como entidade definida. */
function danglingRefs(text: string): number[] {
  const defined = new Set([...text.matchAll(/^#(\d+)=/gm)].map((m) => Number(m[1])));
  return [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])).filter((id) => !defined.has(id));
}

describe('exportIfc', () => {
  const p = buildTemplate('house2');
  const geo = geometryFromModel(p);
  const text = exportIfc(p, geo, { timestamp: TS });
  const walls = Object.values(p.elements).filter(isWall).length;
  const openings = Object.values(p.elements).filter(isOpening).length;

  it('começa com ISO-10303-21 e termina com END-ISO-10303-21', () => {
    expect(text.startsWith('ISO-10303-21;')).toBe(true);
    expect(text.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true);
  });

  it('todo #n referenciado existe no arquivo', () => {
    expect(danglingRefs(text)).toEqual([]);
  });

  it('conta paredes, vãos (vão bruto + porta/janela) e pavimentos como o projeto', () => {
    expect(count(text, 'IFCWALL')).toBe(walls);
    expect(count(text, 'IFCDOOR') + count(text, 'IFCWINDOW')).toBe(openings);
    expect(count(text, 'IFCOPENINGELEMENT')).toBe(openings);
    expect(count(text, 'IFCRELVOIDSELEMENT')).toBe(openings);
    expect(count(text, 'IFCRELFILLSELEMENT')).toBe(openings);
    expect(count(text, 'IFCBUILDINGSTOREY')).toBe(p.levels.length);
    expect(count(text, 'IFCSITE')).toBe(1);
    expect(count(text, 'IFCBUILDING')).toBe(1);
    expect(count(text, 'IFCPROJECT')).toBe(1);
  });

  it('cada parede com camadas positivas tem um IFCMATERIALLAYERSETUSAGE', () => {
    const withLayers = Object.values(p.elements).filter((e) => isWall(e) && wallType(p, e).layers.some((l) => l.thickness > 0)).length;
    expect(count(text, 'IFCMATERIALLAYERSETUSAGE')).toBe(withLayers);
  });

  it('GlobalIds das entidades com raiz são de 22 caracteres e únicos', () => {
    const ids = [...text.matchAll(/=(IFCPROJECT|IFCSITE|IFCBUILDING|IFCBUILDINGSTOREY|IFCWALL|IFCSLAB|IFCDOOR|IFCWINDOW|IFCOPENINGELEMENT|IFCREL\w+)\('([^']*)'/g)].map((m) => m[2]!);
    expect(ids.length).toBeGreaterThan(walls);
    expect(ids.every((g) => /^[0-9A-Za-z_$]{22}$/.test(g))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(ifcGuid('project'));
  });

  it('é determinístico: a mesma entrada dá o mesmo texto', () => {
    expect(exportIfc(p, geo, { timestamp: TS })).toBe(text);
  });

  it('nomes com acento saem em \\X2\\ e a unidade é metro', () => {
    expect(text).toContain('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');
    const accented = exportIfc({ ...p, name: 'Casa Térrea' }, geo, { timestamp: TS });
    expect(accented).toContain("'Casa T\\X2\\00E9\\X0\\rrea'");
  });

  it('a casa de teste tem paredes e vãos (o teste de contagem não é vazio)', () => {
    expect(walls).toBeGreaterThan(0);
    expect(openings).toBeGreaterThan(0);
  });

  it('pisos, lajes, telhado e escada (sintéticos) saem com a classificação do IFC', () => {
    const lv = p.levels[0]!;
    const elev = levelElevation(p, lv.id);
    const rect = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    const floor = { id: 'fl1', kind: 'floor', typeId: '', levelId: lv.id, boundary: [], holes: [], heightOffset: 0, mark: '', comments: '', order: 999 } as Floor;
    const roof = { id: 'rf1', kind: 'roof', typeId: '', levelId: lv.id, shape: 'shed' } as unknown as Roof;
    const stair = { id: 'st1', kind: 'stair', typeId: '', levelId: lv.id } as unknown as Stair;
    const q: Project = { ...p, elements: { ...p.elements, fl1: floor, rf1: roof, st1: stair } };
    const tread = (x: number) => ({ polygon: [[{ x, y: 0 }, { x: x + 0.3, y: 0 }, { x: x + 0.3, y: 1 }, { x, y: 1 }]], top: { a: 0, b: 0, c: elev + 0.2 }, bottom: { a: 0, b: 0, c: elev - 0.1 } });
    const g: IfcGeometry = {
      ...geo,
      floors: [{ floorId: 'fl1', prism: { polygon: [rect], top: { a: 0, b: 0, c: elev }, bottom: { a: 0, b: 0, c: elev - 0.2 } } }],
      roofs: [{ roofId: 'rf1', planes: [{ polygon: [rect], top: { a: 0, b: 0.2, c: elev + 3 }, bottom: { a: 0, b: 0.2, c: elev + 2.8 } }] }],
      stairs: [{ stairId: 'st1', levelId: lv.id, spiral: false, riserHeight: 0.18, flights: [{ componentIndex: 1, pieces: [tread(0), tread(0.3)], treads: 2, risers: 3 }], landings: [{ polygon: [rect], top: { a: 0, b: 0, c: elev + 0.2 }, bottom: { a: 0, b: 0, c: elev - 0.1 } }] }],
    };
    const out = exportIfc(q, g, { timestamp: TS });
    expect(danglingRefs(out)).toEqual([]);
    expect(out).toContain(',.ROOF.)');
    expect(out).toContain(',.LANDING.)');
    expect(count(out, 'IFCSLAB')).toBe(count(text, 'IFCSLAB') + 3);
    expect(count(out, 'IFCROOF')).toBe(1);
    expect(count(out, 'IFCSTAIR')).toBe(1);
    expect(count(out, 'IFCSTAIRFLIGHT')).toBe(1);
    expect(out).toContain("'Brep'");
    expect(out).toContain('.SHED_ROOF.');
  });
});
