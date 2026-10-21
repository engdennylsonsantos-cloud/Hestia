import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeSlab, slabTypeThickness, type Slab } from '@hestia/model';
import { computeSection, resolveSlabs } from './index.ts';

const RECT: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
const HOLE: Vec2[] = [{ x: 2, y: 1.5 }, { x: 4, y: 1.5 }, { x: 4, y: 2.5 }, { x: 2, y: 2.5 }];

function storeWithSlab(extra: Partial<Slab> = {}) {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_mac15', levelId: 'lv_0', boundary: RECT, ...extra }) });
  return s;
}

/** Inclinação de 10% ao longo de x, com a origem em x = 0 (topo 0,00 na origem, 0,60 em x = 6). */
const SLOPE_X = { origin: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 };
const THICK = 0.17; // ls_mac15: regularização 2 cm + concreto 15 cm

describe('corte com lajes (D3)', () => {
  it('laje horizontal: silhueta = largura × espessura total, cotas de -0,17 a 0', () => {
    const s = storeWithSlab();
    expect(slabTypeThickness(s.project.slabTypes.ls_mac15!)).toBeCloseTo(THICK, 9);
    const r = computeSection(s.project, { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 });
    expect(multiArea(r.silhouette)).toBeCloseTo(6 * THICK, 6);
    expect(r.zMin).toBeCloseTo(-THICK, 6);
    expect(r.zMax).toBeCloseTo(0, 6);
    expect(r.cut.find((c) => c.materialId === 'mat_concreto')).toBeDefined();
  });

  it('laje inclinada 10% em x, corte em x: trapézio com área largura × espessura e topo de 0,60 m em x = 6', () => {
    const s = storeWithSlab({ slope: SLOPE_X });
    const r = computeSection(s.project, { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 });
    expect(multiArea(r.silhouette)).toBeCloseTo(6 * THICK, 6);
    expect(r.zMax).toBeCloseTo(0.6, 6);
    expect(r.zMin).toBeCloseTo(-THICK, 6);
    // o topo sobe de 0 a 0,60: o ponto mais alto está em x = 6, que é t = 7 (a linha começa em x = -1)
    const top = r.silhouette.flat(2).reduce((m, v) => (v.y > m.y ? v : m));
    expect(top.x).toBeCloseTo(7, 6);
    expect(top.y).toBeCloseTo(0.6, 6);
  });

  it('corte perpendicular à inclinação: faixa retangular na cota do ponto de corte (x = 3 → +0,30)', () => {
    const s = storeWithSlab({ slope: SLOPE_X });
    const r = computeSection(s.project, { a: { x: 3, y: -1 }, b: { x: 3, y: 5 }, depth: 2 });
    expect(r.cut.reduce((acc, c) => acc + multiArea(c.polygons), 0)).toBeCloseTo(4 * THICK, 6);
    // silhueta = corte + a laje que desce atrás do plano (visível sob a faixa de corte): cotas de 0,10 − 0,17 a 0,30
    expect(multiArea(r.silhouette)).toBeCloseTo(4 * (0.3 - (0.1 - THICK)), 6);
    // o observador olha para -x: a parte além do plano (x entre 1 e 3) fica mais baixa, a 0,10 de subida
    expect(r.zMax).toBeCloseTo(0.3, 6);
    expect(r.zMin).toBeCloseTo(0.1 - THICK, 6);
    // só o corte (sem a parte além): a faixa é uma horizontal só, em 0,13 a 0,30
    const cutZ = r.cut.flatMap((c) => c.polygons.flat(2)).map((v) => v.y);
    expect(Math.min(...cutZ)).toBeCloseTo(0.3 - THICK, 6);
    expect(Math.max(...cutZ)).toBeCloseTo(0.3, 6);
  });

  it('laje com furo: o corte tem vão do tamanho do furo', () => {
    const s = storeWithSlab({ holes: [HOLE] });
    // y = 2 cruza o furo entre x = 2 e x = 4
    const r = computeSection(s.project, { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 });
    expect(r.cut.reduce((acc, c) => acc + multiArea(c.polygons), 0)).toBeCloseTo((6 - 2) * THICK, 6);
    // o reveal do furo, além do plano, é visível pelo vão e preenche a silhueta
    expect(multiArea(r.silhouette)).toBeCloseTo(6 * THICK, 6);
  });

  it('linha de corte que não toca a laje não a inclui', () => {
    const s = storeWithSlab({ slope: SLOPE_X });
    const r = computeSection(s.project, { a: { x: -1, y: 10 }, b: { x: 7, y: 10 }, depth: 2 });
    expect(r.cut).toHaveLength(0);
    expect(r.beyond.filter((b) => b.slabId)).toHaveLength(0);
  });

  it('elevação: a laje inclinada aparece em beyond, uma faixa por camada, em trapézio entre 0 e 0,60', () => {
    const s = storeWithSlab({ slope: SLOPE_X });
    const layers = resolveSlabs(s.project, 'lv_0')[0]!.layers;
    // linha em y = -2, olhando para +y: a laje está a 2 m do plano; a laje de visão vai até 4 m
    const r = computeSection(s.project, { a: { x: 0, y: -2 }, b: { x: 6, y: -2 }, depth: 4 });
    expect(r.cut).toHaveLength(0);
    const items = r.beyond.filter((b) => b.slabId === 's');
    expect(items).toHaveLength(layers.length);
    for (const b of items) {
      expect(b.depth).toBeCloseTo(2, 6);
      expect(multiArea(b.polygons)).toBeCloseTo(6 * (b.layerIndex === 0 ? 0.02 : 0.15), 6);
    }
    expect(r.zMax).toBeCloseTo(0.6, 6);
    expect(r.zMin).toBeCloseTo(-THICK, 6);
  });

  it('elevação com piso e laje: a laje entra na ordenação pela profundidade', () => {
    const s = storeWithSlab({ slope: SLOPE_X });
    const r = computeSection(s.project, { a: { x: 0, y: -2 }, b: { x: 6, y: -2 }, depth: 6 });
    expect(r.beyond.some((b) => b.slabId === 's')).toBe(true);
    for (let i = 1; i < r.beyond.length; i++) expect(r.beyond[i - 1]!.depth).toBeGreaterThanOrEqual(r.beyond[i]!.depth);
  });
});
