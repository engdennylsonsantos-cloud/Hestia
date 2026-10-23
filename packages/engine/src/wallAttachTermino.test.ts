import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeSlab, makeWall, type Project, type SlabType } from '@hestia/model';
import { resolveLevel } from './resolve.ts';

/**
 * Parede anexada ao piso/laje respeita o término por camada (decisão 0025): onde a camada da laje termina na face da
 * parede, o vazio deixado é preenchido pela parede, em vez de a parede parar na face inferior da laje inteira.
 * Laje de 0,15 m (estrutura) + 0,05 m (regularização) no nível de cima (topo na cota do nível, 3 m); parede do térreo
 * com topo anexado à laje; parede do alto com base anexada.
 */
const tipo = (term: 'auto' | 'face'): SlabType => ({
  id: 'ls_t',
  name: 'Laje teste',
  code: 'LT-01',
  description: '',
  cost: 0,
  layers: [
    { function: 'finish1', materialId: 'mat_argamassa', thickness: 0.05, wraps: false, termino: term },
    { function: 'structure', materialId: 'mat_concreto', thickness: 0.15, wraps: false, termino: term },
  ],
});

function cena(term: 'auto' | 'face'): Project {
  const base = createEmptyProject();
  const s = new ProjectStore({ ...base, levels: base.levels.map((l) => (l.id === 'lv_1' ? { ...l, elevation: 3 } : l)) });
  s.exec({ type: 'upsertSlabType', slabType: tipo(term) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 'lj', typeId: 'ls_t', levelId: 'lv_1', boundary: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }] }) });
  const parede = { typeId: 'wt_alv14', a: { x: 5, y: 1 }, b: { x: 5, y: 7 }, height: 3, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } } as const;
  s.exec({ type: 'addWall', wall: makeWall({ id: 'baixo', levelId: 'lv_0', topLevelId: 'lv_1', attachTopToFloor: true, ...parede }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'cima', levelId: 'lv_1', attachBottomToFloor: true, ...parede }) });
  return s.project;
}

describe('parede anexada × término por camada', () => {
  it('sem regra de término: o topo da parede de baixo para na face inferior da laje (como antes)', () => {
    const p = cena('auto');
    const w = resolveLevel(p, 'lv_0').walls.baixo!;
    expect(w.baseZ + w.height).toBeCloseTo(3 - 0.2, 6);
  });

  it('término na face em todas as camadas: a parede de baixo atravessa o vazio da laje até o topo dela', () => {
    const p = cena('face');
    const w = resolveLevel(p, 'lv_0').walls.baixo!;
    expect(w.baseZ + w.height).toBeCloseTo(3, 6);
  });

  it('término na face: a parede de cima mantém a base no topo da laje', () => {
    const p = cena('face');
    const w = resolveLevel(p, 'lv_1').walls.cima!;
    expect(w.baseZ).toBeCloseTo(3, 6);
  });
});
