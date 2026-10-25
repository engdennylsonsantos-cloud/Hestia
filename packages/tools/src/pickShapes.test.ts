import { describe, expect, it } from 'vitest';
import { resolveFloors, resolveSlabs } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab } from '@hestia/model';
import { formasDoNivel } from './pickShapes.ts';
import { pickFloorAt } from './floorPick.ts';
import { pickSlabAt } from './slabPick.ts';

const QUADRADO = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];

function projeto() {
  const s = new ProjectStore(createEmptyProject('Formas'));
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'pi1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: QUADRADO }) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 'la1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: QUADRADO }) });
  return s.project;
}

describe('formas resolvidas para a seleção (pickShapes)', () => {
  it('o mapa de pisos e de lajes é o mesmo que a resolução direta dá', () => {
    const p = projeto();
    const pisos = new Map(resolveFloors(p, 'lv_0').map((r) => [r.floorId, r.polygon] as const));
    const lajes = new Map(resolveSlabs(p, 'lv_0').map((r) => [r.slabId, r.polygon] as const));
    expect(formasDoNivel(p, 'lv_0', 'piso')).toEqual(pisos);
    expect(formasDoNivel(p, 'lv_0', 'laje')).toEqual(lajes);
    expect(pisos.size).toBe(1);
    expect(lajes.size).toBe(1);
  });

  it('guarda por projeto: a segunda chamada devolve o mesmo mapa; outra edição monta outro', () => {
    const p = projeto();
    const primeiro = formasDoNivel(p, 'lv_0', 'piso');
    expect(formasDoNivel(p, 'lv_0', 'piso')).toBe(primeiro);
    const s = new ProjectStore(p);
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'pi2', typeId: 'ft_ceram', levelId: 'lv_0', boundary: QUADRADO }) });
    expect(formasDoNivel(s.project, 'lv_0', 'piso').has('pi2')).toBe(true);
    expect(formasDoNivel(s.project, 'lv_0', 'piso')).not.toBe(primeiro);
  });

  it('o pick de piso e de laje acerta o mesmo que antes (dentro do contorno)', () => {
    const p = projeto();
    expect(pickFloorAt(p, 'lv_0', { x: 2, y: 2 }, 1 / 50)).toBe('pi1');
    expect(pickSlabAt(p, 'lv_0', { x: 2, y: 2 }, 1 / 50)).toBe('la1');
    expect(pickFloorAt(p, 'lv_0', { x: 9, y: 9 }, 1 / 50)).toBeNull();
  });
});
