import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeSlab, makeWall, type Project } from '@hestia/model';
import { resolveSlabs } from './slabs.ts';

/**
 * Laje única com término por camada (decisão 0025): `ls_unica` (regularização até a face, estrutura que passa) numa
 * laje de 10 × 8 m no térreo, com topo na cota 3 m (teto do térreo). A parede interna (0,184 m) está no pavimento de
 * cima, com base na cota 3 m: ela entra porque toca a faixa da laje (regra do teto entre pavimentos).
 */
function laje(paredeNoAlto: boolean): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 'lj', typeId: 'ls_unica', levelId: 'lv_0', boundary: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }], heightOffset: 3 }) });
  s.exec({
    type: 'addWall',
    wall: makeWall({
      id: 'w1',
      typeId: 'wt_alv14',
      levelId: paredeNoAlto ? 'lv_1' : 'lv_0',
      a: { x: 5, y: -1 },
      b: { x: 5, y: 9 },
      height: 2.8,
      joinStart: { kind: 'butt', flip: false },
      joinEnd: { kind: 'butt', flip: false },
    }),
  });
  return s.project;
}

describe('laje única: término por camada (decisão 0025)', () => {
  it('a parede do pavimento de cima, que parte da cota da laje, corta a regularização; a estrutura passa inteira', () => {
    const [r] = resolveSlabs(laje(true), 'lv_0');
    expect(multiArea(r!.layers[0]!.polygon)).toBeCloseTo(80 - 0.184 * 8, 6);
    expect(multiArea(r!.layers[1]!.polygon)).toBeCloseTo(80, 6);
  });

  it('uma parede que não encosta na faixa da laje não corta nada (a regra usa a cota)', () => {
    const [r] = resolveSlabs(laje(false), 'lv_0');
    expect(multiArea(r!.layers[0]!.polygon)).toBeCloseTo(80, 6);
  });
});
