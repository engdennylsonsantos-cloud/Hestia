import { describe, expect, it } from 'vitest';
import { intersection, multiArea, type MultiPolygon } from '@hestia/geom';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { buildOpeningModel } from './openingModel.ts';
import { pointAt, type WallFrame } from './frame.ts';
import { frameOfWall, openingGeometry, resolveLevel } from './resolve.ts';
import { insertFrameFootprint, insertMode, insertReturns } from './wrap.ts';

interface Cena {
  p: Project;
  o: Opening;
  f: WallFrame;
  t: OpeningType;
}

function cena(base: string, extra: Partial<OpeningType> = {}): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'v',
      kind: t.kind,
      typeId: 'ot_x',
      hostId: 'w',
      offset: 2,
      flipHand: false,
      flipFacing: false,
      sillOverride: null,
      mark: '',
    },
  });
  const p = s.project;
  return { p, o: p.elements.v as Opening, f: frameOfWall(p, 'w')!, t: p.openingTypes.ot_x! };
}

describe('acabamento x batente (decisão 0035 §2)', () => {
  it('inherit com batente vira none; explícito continua valendo; bloco mantém o da parede', () => {
    const c = cena('ot_p90');
    expect(insertMode(c.f.type, c.t)).toBe('none');
    expect(insertMode(c.f.type, { ...c.t, closure: 'both' })).toBe('both');
    expect(insertMode(c.f.type, { ...c.t, frameStyle: 'block' })).toBe(c.f.type.wrapInserts);
    const vaio = cena('ot_vao90');
    expect(insertMode(vaio.f.type, vaio.t)).toBe(vaio.f.type.wrapInserts);
  });

  it('closure both: retornos recortados não invadem o batente e continuam existindo fora dele', () => {
    const c = cena('ot_p90');
    const footprint = insertFrameFootprint(c.f, c.o.offset, c.t, 1)!;
    const returns = insertReturns(c.f, c.o.offset, c.t.width, 'both', { ot: c.t, side: 1 });
    const todos: MultiPolygon = returns.flatMap((r) => r.poly);
    expect(multiArea(intersection(todos, footprint))).toBeCloseTo(0, 9);
  });

  it('inherit: sem retorno; o anel do batente não cruza as camadas da parede no corte', () => {
    const c = cena('ot_p90');
    expect(insertReturns(c.f, c.o.offset, c.t.width, insertMode(c.f.type, c.t), { ot: c.t, side: 1 })).toEqual([]);

    const m = buildOpeningModel(c.p, c.o, openingGeometry(c.p, c.o, c.f), c.f);
    const jamb = m.parts.find((p) => p.role === 'jamb')!;
    const ring = [[jamb.profile!.pts.map(([t, s]) => pointAt(c.f, c.o.offset + t, c.f.sMid + s))]];
    const nivel = resolveLevel(c.p, 'lv_0', undefined, { cutZ: 1.5 });
    for (const layer of nivel.walls.w!.layers) {
      for (const poly of layer.cut) {
        expect(multiArea(intersection(poly ? [poly] : [], ring)), `camada ${layer.layerIndex}`).toBeCloseTo(0, 6);
      }
    }
  });

  it('explícito both: o anel em L também não cruza as camadas da parede', () => {
    const c = cena('ot_p90', { closure: 'both' });
    const m = buildOpeningModel(c.p, c.o, openingGeometry(c.p, c.o, c.f), c.f);
    const aneis: MultiPolygon = [];
    for (const p of m.parts.filter((x) => x.role === 'jamb')) {
      aneis.push([p.profile!.pts.map(([t, s]) => pointAt(c.f, c.o.offset + t, c.f.sMid + s))]);
    }
    const nivel = resolveLevel(c.p, 'lv_0', undefined, { cutZ: 1.5 });
    for (const layer of nivel.walls.w!.layers) {
      for (const poly of layer.cut) expect(multiArea(intersection([poly], aneis)), `camada ${layer.layerIndex}`).toBeCloseTo(0, 6);
    }
  });

  it('clipe de retorno respeita o perfil: no modo core/folha oposta ainda sobra retorno', () => {
    const c = cena('ot_p90', { frameDepthMode: 'core', leafSide: 'opposite' });
    const footprint = insertFrameFootprint(c.f, c.o.offset, c.t, 1)!;
    const todos: MultiPolygon = insertReturns(c.f, c.o.offset, c.t.width, 'both', { ot: c.t, side: 1 }).flatMap((r) => r.poly);
    expect(multiArea(todos)).toBeGreaterThan(0);
    expect(multiArea(intersection(todos, footprint))).toBeCloseTo(0, 9);
  });
});
