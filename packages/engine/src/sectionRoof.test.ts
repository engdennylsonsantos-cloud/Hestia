import { describe, expect, it } from 'vitest';
import { multiArea, union, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof } from '@hestia/model';
import { computeSection, sectionOfRoofs, type RoofSection } from './section.ts';
import type { ResolvedRoof, ResolvedRoofLayer } from './roofs.ts';

// rt_ceramica: telha 1,5 cm, ripa 3 cm, caibro 5 cm (espessura vertical total 9,5 cm)
const LAYERS: ResolvedRoofLayer[] = [
  { layerIndex: 0, materialId: 'mat_telha_ceramica', thickness: 0.015, below: 0 },
  { layerIndex: 1, materialId: 'mat_madeira', thickness: 0.03, below: 0.015 },
  { layerIndex: 2, materialId: 'mat_madeira', thickness: 0.05, below: 0.045 },
];
const TOTAL = 0.095;
const EAVE = 2.8;

/** Duas águas 8 × 6 a 30 %, cumeeira em y = 3 (paralela a x), beiral em z = 2,80. */
function gable(eaveZ = EAVE): ResolvedRoof {
  const sq = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return {
    roofId: 'r',
    typeId: 'rt_ceramica',
    levelId: 'lv_0',
    eaveZ,
    joinedArea: 0,
    layers: LAYERS,
    planes: [
      { polygon: [[sq(0, 0, 8, 3)]], origin: { x: 0, y: 0 }, up: { x: 0, y: 1 }, percent: 30, z0: eaveZ },
      { polygon: [[sq(0, 3, 8, 6)]], origin: { x: 0, y: 6 }, up: { x: 0, y: -1 }, percent: 30, z0: eaveZ },
    ],
    lines: [{ kind: 'ridge', a: { x: 0, y: 3 }, b: { x: 8, y: 3 } }],
  };
}

/** Uma água 8 × 6 subindo em y a 30 %, beiral em z = 2,80. */
function shed(): ResolvedRoof {
  return {
    roofId: 's',
    typeId: 'rt_ceramica',
    levelId: 'lv_0',
    eaveZ: EAVE,
    joinedArea: 0,
    layers: LAYERS,
    planes: [{ polygon: [[[{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }]]], origin: { x: 0, y: 0 }, up: { x: 0, y: 1 }, percent: 30, z0: EAVE }],
    lines: [],
  };
}

const silhouette = (r: RoofSection) => union(...r.cut.map((c) => [c.polygon]));
const areaOf = (r: RoofSection, materialId: string) => multiArea(union(...r.cut.filter((c) => c.materialId === materialId).map((c) => [c.polygon])));

describe('telhado no corte (D3)', () => {
  it('corte transversal (x = 4) das duas águas: silhueta em V invertido, cota máxima = beiral + 0,90', () => {
    const r = sectionOfRoofs([gable()], { a: { x: 4, y: -1 }, b: { x: 4, y: 7 }, depth: 4 });
    // t = y + 1: beiral em t = 1 e t = 7, cumeeira em t = 4
    expect(r.zMax).toBeCloseTo(EAVE + 0.9, 9);
    expect(r.zMin).toBeCloseTo(EAVE - TOTAL, 9);
    const sil = silhouette(r).flat(2);
    const topAt = (t: number) => Math.max(...sil.filter((v) => Math.abs(v.x - t) < 1e-6).map((v) => v.y));
    expect(topAt(1)).toBeCloseTo(EAVE, 9);
    expect(topAt(4)).toBeCloseTo(EAVE + 0.9, 9);
    expect(topAt(7)).toBeCloseTo(EAVE, 9);
  });

  it('espessura vertical constante: a área de cada material é a espessura da camada vezes o comprimento do corte (6 m)', () => {
    const r = sectionOfRoofs([gable()], { a: { x: 4, y: -1 }, b: { x: 4, y: 7 }, depth: 4 });
    expect(multiArea(silhouette(r))).toBeCloseTo(6 * TOTAL, 9);
    expect(areaOf(r, 'mat_telha_ceramica')).toBeCloseTo(6 * 0.015, 9);
    expect(areaOf(r, 'mat_madeira')).toBeCloseTo(6 * (0.03 + 0.05), 9);
  });

  it('corte longitudinal (y = 2, abaixo da cumeeira): faixa horizontal na cota do ponto, beiral + 0,60', () => {
    const r = sectionOfRoofs([gable()], { a: { x: -1, y: 2 }, b: { x: 9, y: 2 }, depth: 4 });
    // o corte (sem a parte além) fica entre beiral + 0,60 − 0,095 e beiral + 0,60; a água de cima, além, vai à cumeeira
    const cutTop = Math.max(...silhouette(r).flat(2).map((v) => v.y));
    const cutBase = Math.min(...silhouette(r).flat(2).map((v) => v.y));
    expect(multiArea(silhouette(r))).toBeCloseTo(8 * TOTAL, 9);
    expect(cutTop).toBeCloseTo(EAVE + 0.6, 9);
    expect(cutBase).toBeCloseTo(EAVE + 0.6 - TOTAL, 9);
    expect(r.zMax).toBeCloseTo(EAVE + 0.9, 9);
  });

  it('corte sobre a cumeeira (y = 3): faixa horizontal na cota da cumeeira, com a área de uma água (8 m × 9,5 cm)', () => {
    const r = sectionOfRoofs([gable()], { a: { x: -1, y: 3 }, b: { x: 9, y: 3 }, depth: 4 });
    const sil = silhouette(r);
    expect(multiArea(sil)).toBeCloseTo(8 * TOTAL, 9);
    expect(Math.max(...sil.flat(2).map((v) => v.y))).toBeCloseTo(EAVE + 0.9, 9);
    expect(Math.min(...sil.flat(2).map((v) => v.y))).toBeCloseTo(EAVE + 0.9 - TOTAL, 9);
  });

  it('elevação vista do beiral sul (y = −2): cada água além do plano, com profundidade e silhueta por camada', () => {
    const r = sectionOfRoofs([gable()], { a: { x: 0, y: -2 }, b: { x: 8, y: -2 }, depth: 9 });
    expect(r.cut).toHaveLength(0);
    const a = r.beyond.filter((b) => b.roofId === 'r' && Math.abs(b.depth - 2) < 1e-9);
    const b = r.beyond.filter((b) => b.roofId === 'r' && Math.abs(b.depth - 5) < 1e-9);
    expect(a).toHaveLength(LAYERS.length);
    expect(b).toHaveLength(LAYERS.length);
    // água de baixo (beiral em y = 0): a camada de cima cobre x de 0 a 8 entre z = 2,80 − 0,015 e a cumeeira (3,70)
    const top = a.find((x) => x.layerIndex === 0)!;
    expect(multiArea(top.polygons)).toBeCloseTo(8 * (0.9 + 0.015), 6);
    expect(r.zMax).toBeCloseTo(EAVE + 0.9, 9);
    expect(r.zMin).toBeCloseTo(EAVE - TOTAL, 9);
  });

  it('telhado de uma água: a cota sobe 0,30 por metro na direção up', () => {
    const r = sectionOfRoofs([shed()], { a: { x: 4, y: -1 }, b: { x: 4, y: 7 }, depth: 4 });
    expect(r.zMax).toBeCloseTo(EAVE + 0.3 * 6, 9);
    expect(multiArea(silhouette(r))).toBeCloseTo(6 * TOTAL, 9);
  });

  it('linha que não toca o telhado não gera nada; sem telhados, cotas extremas vazias', () => {
    const far = sectionOfRoofs([gable()], { a: { x: -1, y: 10 }, b: { x: 9, y: 10 }, depth: 2 });
    expect(far.cut).toHaveLength(0);
    expect(far.beyond).toHaveLength(0);
    const none = sectionOfRoofs([], { a: { x: 4, y: -1 }, b: { x: 4, y: 7 }, depth: 4 });
    expect(none.zMin).toBe(Infinity);
    expect(none.zMax).toBe(-Infinity);
  });
});

describe('telhado no corte com o motor real (computeSection)', () => {
  it('duas águas criadas por addRoof: corte transversal dá V invertido até beiral + 0,90 e silhueta de 6 m', () => {
    const st = new ProjectStore(createEmptyProject());
    st.exec({
      type: 'addRoof',
      roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }], heightOffset: 2.8, shape: 'gable', slopePercent: 30, dir: { x: 1, y: 0 } }),
    });
    const r = computeSection(st.project, { a: { x: 4, y: -1 }, b: { x: 4, y: 7 }, depth: 4 });
    const eave = st.project.levels.find((l) => l.id === 'lv_0')!.elevation + 2.8;
    expect(r.zMax).toBeCloseTo(eave + 0.9, 6);
    expect(multiArea(r.silhouette)).toBeCloseTo(6 * 0.095, 6);
    expect(r.beyond.some((b) => b.roofId === 'r')).toBe(true);
  });
});
