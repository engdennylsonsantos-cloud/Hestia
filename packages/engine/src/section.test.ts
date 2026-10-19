import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, totalThickness } from '@hestia/model';
import { computeSection } from './index.ts';

function store() {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, height: 3 }) });
  return s;
}

describe('corte e elevação', () => {
  it('corte transversal à parede: uma fatia com a espessura total e a altura da parede', () => {
    const s = store();
    const t = totalThickness(s.project.wallTypes.wt_alv14!);
    const r = computeSection(s.project, { a: { x: 3, y: -1 }, b: { x: 3, y: 1 }, depth: 3 });
    expect(multiArea(r.silhouette)).toBeCloseTo(t * 3, 4);
    expect(r.cut.length).toBe(3); // reboco, bloco, reboco
    expect(r.zMax - r.zMin).toBeCloseTo(3, 6);
  });

  it('corte longitudinal com porta deixa o vão aberto', () => {
    const s = store();
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'w', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    const full = multiArea(computeSection(store().project, { a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, depth: 2 }).silhouette);
    const r = computeSection(s.project, { a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, depth: 2 });
    const hole = multiArea(r.silhouette);
    expect(full).toBeCloseTo(6 * 3, 3);
    // o reboco volta para dentro do vão (retorno): o vão livre é um pouco menor que a porta
    expect(full - hole).toBeGreaterThan(0.74 * 2.1);
    expect(full - hole).toBeLessThanOrEqual(0.8 * 2.1 + 1e-6);
    expect(r.openings).toHaveLength(1);
    expect(r.openings[0]!.cut).toBe(true);
  });

  it('elevação: nada é cortado e a parede aparece além do plano, com o vão', () => {
    const s = store();
    s.exec({ type: 'addOpening', opening: { id: 'j', kind: 'window', typeId: 'ot_j120', hostId: 'w', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    const r = computeSection(s.project, { a: { x: 0, y: -2 }, b: { x: 6, y: -2 }, depth: 4 });
    expect(r.cut).toHaveLength(0);
    expect(r.beyond.length).toBeGreaterThan(0);
    expect(r.openings[0]!.cut).toBe(false);
    for (let i = 1; i < r.beyond.length; i++) expect(r.beyond[i - 1]!.depth).toBeGreaterThanOrEqual(r.beyond[i]!.depth);
  });

  it('o que está atrás do observador não aparece', () => {
    const s = store();
    const r = computeSection(s.project, { a: { x: 0, y: 2 }, b: { x: 6, y: 2 }, depth: 4 });
    // a normal à esquerda de (0,2)→(6,2) aponta para +y, longe da parede
    expect(r.beyond).toHaveLength(0);
  });
});
