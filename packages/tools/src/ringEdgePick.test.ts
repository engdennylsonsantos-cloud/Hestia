import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab } from '@hestia/model';
import { dist } from '@hestia/geom';
import { pickRingEdgeAt } from './ringEdgePick.ts';

const OUTER = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
const HOLE = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];

function project(parts: 'floor' | 'slab' | 'both' = 'both') {
  const s = new ProjectStore(createEmptyProject());
  if (parts !== 'slab') s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_ceram', levelId: 'lv_0', boundary: OUTER }) });
  if (parts !== 'floor') s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_mac12', levelId: 'lv_0', boundary: OUTER, holes: [HOLE] }) });
  return s.project;
}

describe('captura de aresta de anel', () => {
  it('aresta do contorno externo de piso', () => {
    const pick = pickRingEdgeAt(project('floor'), 'lv_0', { x: 2, y: 0.02 }, 0.01);
    expect(pick).not.toBeNull();
    expect(pick!.ref).toEqual({ elementId: 'f', hole: null, index: 0 });
    expect(pick!.a).toEqual(OUTER[0]);
    expect(pick!.b).toEqual(OUTER[1]);
  });

  it('aresta de furo de laje', () => {
    const pick = pickRingEdgeAt(project('slab'), 'lv_0', { x: 1.5, y: 1.02 }, 0.01);
    expect(pick).not.toBeNull();
    expect(pick!.ref).toEqual({ elementId: 's', hole: 0, index: 0 });
    expect(pick!.a).toEqual(HOLE[0]);
    expect(pick!.b).toEqual(HOLE[1]);
  });

  it('o ponto at cai sobre a aresta', () => {
    const pick = pickRingEdgeAt(project(), 'lv_0', { x: 3, y: 0.02 }, 0.01)!;
    expect(pick.at.x).toBeCloseTo(3, 9);
    expect(pick.at.y).toBeCloseTo(0, 9);
    expect(dist(pick.a, pick.at) + dist(pick.at, pick.b)).toBeCloseTo(dist(pick.a, pick.b), 9);
  });

  it('fora da tolerância (4 * mpp) devolve null', () => {
    expect(pickRingEdgeAt(project(), 'lv_0', { x: 2, y: 0.1 }, 0.01)).toBeNull();
    expect(pickRingEdgeAt(project('slab'), 'lv_0', { x: 2, y: 0.02 }, 0.001)).toBeNull();
    expect(pickRingEdgeAt(project(), 'lv_0', { x: 3, y: 1.5 }, 0.01)).toBeNull();
  });

  it('em empate quase exato vence o elemento mais recente', () => {
    expect(pickRingEdgeAt(project(), 'lv_0', { x: 2, y: 0.02 }, 0.01)!.ref.elementId).toBe('s');
  });

  it('nível diferente devolve null', () => {
    expect(pickRingEdgeAt(project(), 'lv_1', { x: 2, y: 0.02 }, 0.01)).toBeNull();
  });
});
