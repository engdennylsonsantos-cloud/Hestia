import { describe, expect, it } from 'vitest';
import { intersection, multiArea, unionClipper, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type Project } from '@hestia/model';
import { computeSection, type SectionResult } from './index.ts';

/**
 * Linha oculta (decisão do dono, como Revit/Archicad): no corte e na elevação só sai o que é visível do observador.
 * Paredes, pisos, lajes, telhados, escadas e as aberturas (caixilho, folha e vidro) são opacos e escondem o que está
 * atrás; a região cortada é sempre visível. Os testes montam projetos pequenos e conferem o que sobra visível.
 */

const P = (x: number, y: number): Vec2 => ({ x, y });
const WT = 'wt_alv14';

interface WallSpec {
  id: string;
  a: Vec2;
  b: Vec2;
}
interface OpeningSpec {
  id: string;
  kind: 'window' | 'door';
  host: string;
  offset: number;
}

function build(walls: WallSpec[], openings: OpeningSpec[] = []): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: makeWall({ id: w.id, typeId: WT, levelId: 'lv_0', a: w.a, b: w.b, height: 3 }) });
  for (const o of openings) {
    s.exec({
      type: 'addOpening',
      opening: {
        id: o.id,
        kind: o.kind,
        typeId: o.kind === 'window' ? 'ot_j120' : 'ot_p80',
        hostId: o.host,
        offset: o.offset,
        flipHand: false,
        flipFacing: false,
        sillOverride: null,
        mark: '',
      },
    });
  }
  return s.project;
}

const areaOf = (items: Array<{ polygons: MultiPolygon }>): number => items.reduce((s, i) => s + multiArea(i.polygons), 0);
const wallArea = (r: SectionResult, wallId: string): number => areaOf(r.beyond.filter((b) => b.wallId === wallId));
const openingOf = (r: SectionResult, id: string) => r.openings.find((o) => o.openingId === id);
const openingArea = (r: SectionResult, id: string): number => {
  const o = openingOf(r, id);
  return o ? multiArea(o.polygons) : 0;
};
const rectRing = (t0: number, t1: number, z0: number, z1: number): Ring => [P(t0, z0), P(t1, z0), P(t1, z1), P(t0, z1)];
const cutMulti = (r: SectionResult): MultiPolygon => r.cut.flatMap((c) => c.polygons);

describe('linha oculta no corte', () => {
  it('janela numa parede atrás de uma parede cheia não aparece', () => {
    // Corte em x = 3 (olha para -x). A parede da frente (x = 1) é cheia; a do fundo (x = 0) tem janela em y = 2.
    const cut = { a: P(3, -1), b: P(3, 5), depth: 4 };
    const hidden = computeSection(build([{ id: 'frente', a: P(1, -1), b: P(1, 5) }, { id: 'fundo', a: P(0, -1), b: P(0, 5) }], [{ id: 'jf', kind: 'window', host: 'fundo', offset: 3 }]), cut);
    expect(openingArea(hidden, 'jf')).toBeLessThan(1e-6);
    expect(wallArea(hidden, 'fundo')).toBeLessThan(1e-6);
    // controle: sem a parede da frente, a mesma janela aparece inteira
    const alone = computeSection(build([{ id: 'fundo', a: P(0, -1), b: P(0, 5) }], [{ id: 'jf', kind: 'window', host: 'fundo', offset: 3 }]), cut);
    expect(openingArea(alone, 'jf')).toBeCloseTo(1.2 * 1.2, 6);
  });

  it('parede cortada oculta só a parte da janela atrás dela (parcialmente visível)', () => {
    // Parede de corte ao longo de x em y = 2 cruza o plano x = 3; a janela do fundo (x = 0, centro em y = 2) cai atrás.
    const r = computeSection(
      build([{ id: 'corte', a: P(1, 2), b: P(6, 2) }, { id: 'fundo', a: P(0, -1), b: P(0, 5) }], [{ id: 'jf', kind: 'window', host: 'fundo', offset: 3 }]),
      { a: P(3, -1), b: P(3, 5), depth: 4 },
    );
    const o = openingOf(r, 'jf');
    expect(o).toBeDefined();
    const cutArea = multiArea(cutMulti(r));
    expect(cutArea).toBeGreaterThan(0);
    // nada da janela sobrepõe a região cortada
    expect(multiArea(intersection(o!.polygons, cutMulti(r)))).toBeLessThan(1e-6);
    // o visível é a janela menos a faixa cortada (parede de 14 cm)
    const full = rectRing(o!.t0, o!.t1, o!.z0, o!.z1);
    const overlap = multiArea(intersection([[full]], cutMulti(r)));
    expect(overlap).toBeGreaterThan(0.1 * 1.2);
    expect(multiArea(o!.polygons)).toBeCloseTo(1.2 * 1.2 - overlap, 4);
    expect(multiArea(o!.polygons)).toBeLessThan(1.2 * 1.2 - 0.1 * 1.2);
  });
});

describe('linha oculta na elevação (caixa de 6 × 4 m, janela em cada face)', () => {
  const BOX: WallSpec[] = [
    { id: 'frente', a: P(0, 0), b: P(6, 0) },
    { id: 'fundo', a: P(6, 4), b: P(0, 4) },
    { id: 'leste', a: P(6, 0), b: P(6, 4) },
    { id: 'oeste', a: P(0, 4), b: P(0, 0) },
    { id: 'interna', a: P(0, 2), b: P(6, 2) },
  ];
  const WINDOWS: OpeningSpec[] = [
    { id: 'jf', kind: 'window', host: 'frente', offset: 3 },
    { id: 'jb', kind: 'window', host: 'fundo', offset: 3 },
    { id: 'ji', kind: 'window', host: 'interna', offset: 3 },
  ];
  // Observador em y = −2 olhando para +y: a face voltada para ele é a da frente.
  const FROM_OUTSIDE = { a: P(0, -2), b: P(6, -2), depth: 8 };

  it('mostra só paredes e janelas da face voltada ao observador', () => {
    const r = computeSection(build(BOX, WINDOWS), FROM_OUTSIDE);
    expect(r.cut).toHaveLength(0);
    const wallIds = new Set(r.beyond.map((b) => b.wallId));
    expect(wallIds.has('frente')).toBe(true);
    expect(wallIds.has('fundo')).toBe(false);
    expect(wallIds.has('interna')).toBe(false);
    expect(openingArea(r, 'jf')).toBeGreaterThan(1);
    expect(openingArea(r, 'jb')).toBeLessThan(1e-6);
    expect(openingArea(r, 'ji')).toBeLessThan(1e-6);
  });

  it('a face da frente aparece inteira: igual à da parede isolada', () => {
    const r = computeSection(build(BOX, WINDOWS), FROM_OUTSIDE);
    const alone = computeSection(build([BOX[0]!], [WINDOWS[0]!]), FROM_OUTSIDE);
    expect(wallArea(r, 'frente') + openingArea(r, 'jf')).toBeCloseTo(wallArea(alone, 'frente') + openingArea(alone, 'jf'), 4);
  });

  it('paredes laterais aparecem só na quina (a face delas está atrás da frente)', () => {
    const r = computeSection(build(BOX, WINDOWS), FROM_OUTSIDE);
    for (const b of r.beyond.filter((x) => x.wallId === 'leste' || x.wallId === 'oeste')) {
      for (const ring of b.polygons.flat()) {
        for (const v of ring) {
          const nearCorner = Math.abs(v.x) < 0.1 || Math.abs(v.x - 6) < 0.1;
          expect(nearCorner, `vértice ${v.x.toFixed(3)} de ${b.wallId} fora da quina`).toBe(true);
        }
      }
    }
  });

  it('o vidro da janela da frente é opaco: esconde a parede interna e a janela dela', () => {
    const r = computeSection(build(BOX, WINDOWS), FROM_OUTSIDE);
    expect(wallArea(r, 'interna')).toBeLessThan(1e-6);
    expect(openingArea(r, 'ji')).toBeLessThan(1e-6);
    // e a parte visível da janela da frente é ela inteira (nada a cobre)
    expect(openingArea(r, 'jf')).toBeCloseTo(1.2 * 1.2, 4);
  });

  it('a silhueta é a união das regiões visíveis (paredes, pisos e telhados; vãos ficam como furos)', () => {
    const r = computeSection(build(BOX, WINDOWS), FROM_OUTSIDE);
    const solids = [...r.cut.map((c) => c.polygons), ...r.beyond.map((b) => b.polygons)];
    expect(multiArea(r.silhouette)).toBeCloseTo(multiArea(unionClipper(...solids)), 4);
  });
});

describe('linha oculta com profundidades diferentes', () => {
  it('elementos se ocultam só onde se sobrepõem em projeção: soma das partes visíveis = área da união', () => {
    // Parede da frente (curta, y = 0, x ∈ [0, 3]) e parede do fundo (y = 4, x ∈ [0, 6]), vistas de y = −2.
    const SHORT: WallSpec = { id: 'frente', a: P(0, 0), b: P(3, 0) };
    const LONG: WallSpec = { id: 'fundo', a: P(0, 4), b: P(6, 4) };
    const from = { a: P(0, -2), b: P(6, -2), depth: 8 };
    const r = computeSection(build([SHORT, LONG]), from);
    const aloneShort = computeSection(build([SHORT]), from);
    const aloneLong = computeSection(build([LONG]), from);
    const union = multiArea(unionClipper(aloneShort.silhouette, aloneLong.silhouette));
    expect(areaOf(r.beyond)).toBeCloseTo(union, 4);
    // a parede do fundo perde só o trecho atrás da curta; a da frente fica inteira
    expect(wallArea(r, 'frente')).toBeCloseTo(wallArea(aloneShort, 'frente'), 4);
    expect(wallArea(r, 'fundo')).toBeLessThan(wallArea(aloneLong, 'fundo') - 1);
    expect(wallArea(r, 'fundo')).toBeGreaterThan(1);
    // nada do fundo sobra na faixa atrás da frente
    const back = r.beyond.filter((b) => b.wallId === 'fundo').flatMap((b) => b.polygons);
    const front = r.beyond.filter((b) => b.wallId === 'frente').flatMap((b) => b.polygons);
    expect(multiArea(intersection(back, front))).toBeLessThan(1e-6);
  });
});
