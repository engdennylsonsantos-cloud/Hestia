import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Id, type Project } from '@hestia/model';
import { LevelResolveCache, niveisAfetados } from './resolveLevels.ts';
import { resolveLevel } from './resolve.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Três pavimentos (elevações 0, 3 e 6 m), uma parede por nível e um piso no térreo. */
function tresNiveis(): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  const base = s.project.levels[0]!;
  s.exec({ type: 'upsertLevel', level: { ...base, id: 'lv_1', name: 'Pav. 1', elevation: 3 } });
  s.exec({ type: 'upsertLevel', level: { ...base, id: 'lv_2', name: 'Cobertura', elevation: 6 } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w0', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_2', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3 }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f0', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(-1, -2, 5, 2) }) });
  return s;
}

const NIVEIS: Id[] = ['lv_0', 'lv_1', 'lv_2'];

/** Confere: cada nível do cache é igual ao cálculo do zero (sem cache) sobre o mesmo projeto. */
function conferir(cache: LevelResolveCache, p: Project): void {
  for (const id of NIVEIS) expect(cache.get(p, id)).toEqual(resolveLevel(p, id));
}

/** Aquece o cache com o projeto e zera o contador, para medir só o que a próxima edição recalcula. */
function aquecer(cache: LevelResolveCache, p: Project): void {
  for (const id of NIVEIS) cache.get(p, id);
  cache.recalculated = 0;
}

describe('LevelResolveCache', () => {
  it('mesmo projeto: acerto, sem recálculo', () => {
    const p = tresNiveis().project;
    const cache = new LevelResolveCache();
    const a = cache.get(p, 'lv_0');
    expect(cache.get(p, 'lv_0')).toBe(a);
    expect(cache.recalculated).toBe(1);
  });

  it('editar parede de um nível recalcula só esse nível', () => {
    const s = tresNiveis();
    const cache = new LevelResolveCache();
    aquecer(cache, s.project);
    const antes = NIVEIS.map((id) => cache.get(s.project, id));
    const p0 = s.project;
    s.exec({ type: 'setWallEnds', id: 'w1', b: { x: 5, y: 0 } });
    expect(niveisAfetados(p0, s.project)).toEqual(new Set(['lv_1']));
    cache.recalculated = 0;
    expect(cache.get(s.project, 'lv_0')).toBe(antes[0]);
    expect(cache.get(s.project, 'lv_2')).toBe(antes[2]);
    expect(cache.get(s.project, 'lv_1')).not.toBe(antes[1]);
    expect(cache.recalculated).toBe(1);
    conferir(cache, s.project);
  });

  it('mudança global (nome do projeto) recalcula todos os níveis', () => {
    const p = tresNiveis().project;
    const cache = new LevelResolveCache();
    aquecer(cache, p);
    const q = { ...p, name: 'Outro nome' };
    expect(niveisAfetados(p, q)).toBe('todos');
    conferir(cache, q);
    expect(cache.recalculated).toBe(3);
  });

  it('parede anexada ao piso do nível de cima: editar a laje de cima recalcula o de baixo', () => {
    const s = tresNiveis();
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_1', boundary: rect(-1, -1, 5, 1) }) });
    s.exec({ type: 'updateElements', ids: ['w0'], patch: { attachTopToFloor: true, topLevelId: 'lv_1' } });
    const cache = new LevelResolveCache();
    aquecer(cache, s.project);
    const antes = NIVEIS.map((id) => cache.get(s.project, id));
    const p0 = s.project;
    s.exec({ type: 'updateElements', ids: ['s1'], patch: { boundary: rect(-1, -1, 5, 3) } });
    // Editar a laje de lv_1 altera lv_1 e lv_0 (a parede de lv_0 se anexa ao topo em lv_1). lv_2 não depende de nada.
    expect(niveisAfetados(p0, s.project)).toEqual(new Set(['lv_1', 'lv_0']));
    const depois = NIVEIS.map((id) => cache.get(s.project, id));
    expect(cache.recalculated).toBe(2);
    expect(depois[0]).not.toBe(antes[0]);
    expect(depois[1]).not.toBe(antes[1]);
    expect(depois[2]).toBe(antes[2]);
    conferir(cache, s.project);
  });

  it('parede de cima sem anexo: editar o nível de baixo não recalcula o de cima', () => {
    const s = tresNiveis();
    const cache = new LevelResolveCache();
    aquecer(cache, s.project);
    const antes = NIVEIS.map((id) => cache.get(s.project, id));
    cache.recalculated = 0;
    s.exec({ type: 'setWallEnds', id: 'w0', b: { x: 6, y: 0 } });
    const depois = NIVEIS.map((id) => cache.get(s.project, id));
    expect(depois[2]).toBe(antes[2]);
    expect(depois[1]).toBe(antes[1]);
    expect(cache.recalculated).toBe(1);
    conferir(cache, s.project);
  });

  it('release libera só o nível pedido; o próximo acesso recalcula esse nível', () => {
    const p = tresNiveis().project;
    const cache = new LevelResolveCache();
    aquecer(cache, p);
    expect(cache.size).toBe(3);
    cache.release('lv_1');
    expect(cache.size).toBe(2);
    cache.get(p, 'lv_1');
    expect(cache.recalculated).toBe(1);
  });

  it('clear esvazia tudo', () => {
    const p = tresNiveis().project;
    const cache = new LevelResolveCache();
    cache.get(p, 'lv_0');
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('sequência de edições: cada nível continua igual ao cálculo do zero', () => {
    const s = tresNiveis();
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_1', boundary: rect(-1, -1, 5, 1) }) });
    const cache = new LevelResolveCache();
    const passos: Array<() => void> = [
      () => s.exec({ type: 'updateElements', ids: ['w0'], patch: { attachTopToFloor: true, topLevelId: 'lv_1' } }),
      () => s.exec({ type: 'setWallEnds', id: 'w1', b: { x: 5, y: 1 } }),
      () => s.exec({ type: 'updateElements', ids: ['s1'], patch: { boundary: rect(-1, -1, 6, 1) } }),
      () => s.exec({ type: 'updateElements', ids: ['w2'], patch: { attachBottomToFloor: true } }),
      () => s.exec({ type: 'setWallEnds', id: 'w0', b: { x: 3, y: 0 } }),
      () => s.exec({ type: 'updateElements', ids: ['s1'], patch: { boundary: rect(-2, -1, 6, 1) } }),
    ];
    for (const id of NIVEIS) cache.get(s.project, id);
    for (const passo of passos) {
      passo();
      conferir(cache, s.project);
    }
  });
});
