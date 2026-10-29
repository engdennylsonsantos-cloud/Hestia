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

describe('retorno do acabamento: opt-in com batente, livre sem batente, exclusivo com alizar (decisão 0036)', () => {
  it('vão livre (leaves 0) e estilo block dobram o acabamento como a parede manda', () => {
    const vaio = cena('ot_vao90');
    const modo = insertMode(vaio.f.type, vaio.t);
    expect(modo).toBe(vaio.f.type.wrapInserts);
    if (modo !== 'none') expect(insertReturns(vaio.f, vaio.o.offset, vaio.t.width, modo).length).toBeGreaterThan(0);
    const bloco = cena('ot_p90', { frameStyle: 'block' });
    expect(insertMode(bloco.f.type, bloco.t)).toBe(bloco.f.type.wrapInserts);
  });

  it('a pegada do retorno vem da mesma seção da peça jamb do modelo', () => {
    const c = cena('ot_p90');
    const m = buildOpeningModel(c.p, c.o, openingGeometry(c.p, c.o, c.f), c.f);
    const aneis: MultiPolygon = m.parts
      .filter((x) => x.role === 'jamb')
      .map((x) => [x.profile!.pts.map(([t, s]) => pointAt(c.f, c.o.offset + t, c.f.sMid + s))]);
    const pegada = insertFrameFootprint(c.f, c.o.offset, c.t, 1)!;
    expect(multiArea(pegada)).toBeCloseTo(multiArea(aneis), 9);
    expect(multiArea(intersection(pegada, aneis))).toBeCloseTo(multiArea(aneis), 9);
  });

  it('closure explícito com batente gera retorno e ele não tem área comum com o batente', () => {
    for (const closure of ['both', 'exterior', 'interior'] as const) {
      // Batente no núcleo: com o batente faceado (padrão) ele ocupa a parede inteira e não sobra retorno.
      const c = cena('ot_p90', { closure, frameDepthMode: 'core' });
      const modo = insertMode(c.f.type, c.t);
      expect(modo).toBe(closure);
      const rets = insertReturns(c.f, c.o.offset, c.t.width, modo, { ot: c.t, side: 1 });
      expect(rets.length, closure).toBeGreaterThan(0);
      const pegada = insertFrameFootprint(c.f, c.o.offset, c.t, 1)!;
      expect(multiArea(intersection(rets.flatMap((r) => r.poly), pegada)), closure).toBeCloseTo(0, 9);
    }
  });

  it('alizar desliga o retorno, mesmo com closure explícito (R3)', () => {
    const casing = { width: 0.07, thickness: 0.015 };
    for (const closure of ['inherit', 'both', 'exterior', 'interior'] as const) {
      const c = cena('ot_p90', { closure, casing });
      expect(insertMode(c.f.type, c.t), closure).toBe('none');
    }
    const vaio = cena('ot_vao90', { casing });
    expect(insertMode(vaio.f.type, vaio.t)).toBe('none');
  });
});

