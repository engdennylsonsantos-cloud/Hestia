import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, floorTypeThickness, makeFloor, makeWall, type Floor } from '@hestia/model';
import { computeSection, resolveFloors } from './index.ts';

const RECT = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
const HOLE = [{ x: 2, y: 1.5 }, { x: 4, y: 1.5 }, { x: 4, y: 2.5 }, { x: 2, y: 2.5 }];

function storeWithFloor(extra: Partial<Floor> = {}) {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: RECT, ...extra }) });
  return s;
}

describe('corte e elevação com pisos (D3)', () => {
  it('corte atravessando o piso: silhueta = largura × espessura total do tipo', () => {
    const s = storeWithFloor();
    const thick = floorTypeThickness(s.project.floorTypes.ft_ceram!);
    // linha em y = 2, de x = -1 a 7: cruza os 6 m do piso
    const r = computeSection(s.project, { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 });
    expect(multiArea(r.silhouette)).toBeCloseTo(6 * thick, 6);
    // uma faixa por camada da tipologia (acabamento, argamassa, argamassa, concreto)
    expect(r.cut.find((c) => c.materialId === 'mat_concreto')).toBeDefined();
    expect(r.zMin).toBeCloseTo(-thick, 6);
    expect(r.zMax).toBeCloseTo(0, 6);
  });

  it('piso com furo: o corte tem vão do tamanho do furo', () => {
    const s = storeWithFloor({ holes: [HOLE] });
    const thick = floorTypeThickness(s.project.floorTypes.ft_ceram!);
    // y = 2 cruza o furo entre x = 2 e x = 4
    const r = computeSection(s.project, { a: { x: -1, y: 2 }, b: { x: 7, y: 2 }, depth: 2 });
    expect(r.cut.reduce((acc, c) => acc + multiArea(c.polygons), 0)).toBeCloseTo((6 - 2) * thick, 6);
    // além do plano, a face do furo (o reveal, no lado do observador) aparece pelo vão: a silhueta fica cheia
    expect(multiArea(r.silhouette)).toBeCloseTo(6 * thick, 6);
  });

  it('linha de corte que não toca o piso não o inclui', () => {
    const s = storeWithFloor();
    const r = computeSection(s.project, { a: { x: -1, y: 10 }, b: { x: 7, y: 10 }, depth: 2 });
    expect(r.cut).toHaveLength(0);
    expect(r.beyond.filter((b) => b.floorId)).toHaveLength(0);
  });

  it('elevação: o piso aparece em beyond, uma faixa por camada, com a profundidade do trecho mais próximo', () => {
    const s = storeWithFloor();
    const layers = resolveFloors(s.project, 'lv_0')[0]!.layers;
    // linha em y = -2, olhando para +y: o piso está a 2 m do plano; a laje de visão vai até 4 m
    const r = computeSection(s.project, { a: { x: 0, y: -2 }, b: { x: 6, y: -2 }, depth: 4 });
    expect(r.cut).toHaveLength(0);
    const floorItems = r.beyond.filter((b) => b.floorId === 'f1');
    expect(floorItems).toHaveLength(layers.length);
    for (const b of floorItems) expect(b.depth).toBeCloseTo(2, 6);
    // cada camada é um retângulo t 0..6 × z0..z1 da camada
    const boxes = floorItems.map((b) => b.polygons[0]![0]!);
    for (const ring of boxes) {
      const xs = ring.map((v) => v.x);
      expect(Math.min(...xs)).toBeCloseTo(0, 6);
      expect(Math.max(...xs)).toBeCloseTo(6, 6);
    }
  });

  it('elevação: piso e paredes ficam ordenados pela profundidade (do mais longe ao mais perto)', () => {
    const s = storeWithFloor();
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 3 }, b: { x: 6, y: 3 } }) });
    const r = computeSection(s.project, { a: { x: 0, y: -2 }, b: { x: 6, y: -2 }, depth: 6 });
    expect(r.beyond.some((b) => b.floorId === 'f1')).toBe(true);
    expect(r.beyond.some((b) => b.wallId === 'w')).toBe(true);
    for (let i = 1; i < r.beyond.length; i++) expect(r.beyond[i - 1]!.depth).toBeGreaterThanOrEqual(r.beyond[i]!.depth);
  });
});
