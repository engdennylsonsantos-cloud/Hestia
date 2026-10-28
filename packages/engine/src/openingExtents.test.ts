import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening } from '@hestia/model';
import { CASING, EX1, EX3, cenaComposicao } from './openingModelFixture.ts';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { openingEdge, openingExtents } from './openingExtents.ts';

const P1 = { nominalRef: 'leaf' as const, width: 0.9, height: 2.1 };

describe('openingExtents', () => {
  it('porta com alizar: 0 < clear ≤ frame ≤ casing (luz 0,44; vão 0,49; alizar +0,07)', () => {
    const { p } = cenaComposicao('ot_p90', EX1, P1);
    const o = p.elements.v as Opening;
    const f = frameOfWall(p, 'w')!;
    const a = openingExtents(p, o, f, 1);
    const b = openingExtents(p, o, f, -1);
    for (const e of [a, b]) {
      expect(e.center).toBe(0);
      expect(e.clear).toBeGreaterThan(0);
      expect(e.clear).toBeLessThanOrEqual(e.frame);
      expect(e.frame).toBeLessThanOrEqual(e.casing);
    }
    expect(a.frame).toBeCloseTo(0.49, 6);
    expect(a.clear).toBeCloseTo(0.44, 6);
    // Uma face tem a aresta do alizar na luz (0,44 + 0,07); a outra recua 14 mm para a folha abrir.
    const casings = [a.casing, b.casing].sort((x, y) => x - y);
    expect(casings[0]).toBeCloseTo(0.51, 6);
    expect(casings[1]).toBeCloseTo(0.524, 6);
  });

  it('sem alizar: casing coincide com frame', () => {
    const { p } = cenaComposicao('ot_p90', { ...EX1, casing: undefined }, P1);
    const e = openingExtents(p, p.elements.v as Opening, frameOfWall(p, 'w')!, 1);
    expect(e.casing).toBe(e.frame);
  });

  it('bandeiras laterais: frame cobre o conjunto inteiro e clear é a luz do conjunto', () => {
    const { p } = cenaComposicao('ot_p90', { ...EX3, casing: CASING }, P1);
    const e = openingExtents(p, p.elements.v as Opening, frameOfWall(p, 'w')!, 1);
    expect(e.frame).toBeGreaterThan(0.9);
    expect(e.clear).toBeCloseTo(e.frame - 0.05, 6);
  });

  it('memoiza por projeto e chave', () => {
    const { p } = cenaComposicao('ot_p90', EX1, P1);
    const o = p.elements.v as Opening;
    const f = frameOfWall(p, 'w')!;
    expect(openingExtents(p, o, f, 1)).toBe(openingExtents(p, o, f, 1));
  });
});

describe('openingEdge', () => {
  it('devolve a meia-largura da referência', () => {
    const ext = { center: 0 as const, clear: 0.4, frame: 0.45, casing: 0.52 };
    expect(openingEdge(ext, 'center')).toBe(0);
    expect(openingEdge(ext, 'clear')).toBe(0.4);
    expect(openingEdge(ext, 'frame')).toBe(0.45);
    expect(openingEdge(ext, 'casing')).toBe(0.52);
  });
});

describe('openingExtents: tipo simples e recorte da parede', () => {
  it('sem composição, frame = largura do tipo = recorte da parede (sem folga de vão bruto)', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    s.exec({ type: 'addOpening', opening: { id: 'v', kind: 'door', typeId: 'ot_p80', hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    const p = s.project;
    const o = p.elements.v as Opening;
    const f = frameOfWall(p, 'w')!;
    const e = openingExtents(p, o, f, 1);
    expect(e.frame).toBeCloseTo(0.4, 6);
    expect(openingGeometry(p, o, f).roughWidth / 2).toBeCloseTo(e.frame, 6);
    expect(e.clear).toBeGreaterThan(0);
    expect(e.clear).toBeLessThan(e.frame);
  });
});
