import { afterEach, describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Project } from '@hestia/model';
import { levelCutterSet, type LevelCutters } from './junctionNet.ts';
import {
  CacheLRUPorBytes,
  TETO_CACHE_CORTADORES_PADRAO,
  definirTetoCacheCortadores,
  estadoCacheCortadores,
} from './cutterCache.ts';

/**
 * Teto do cache de cortadores (junctionNet). A expulsão LRU só recalcula sob demanda: o resultado tem de ser o mesmo
 * com cache cheio, vazio ou com teto mínimo.
 */

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Dois pavimentos: térreo com parede e piso que se cruzam; pavimento 2 com parede e laje (alcança o térreo). */
function predio(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3, baseOffset: -0.2 }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3) }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 1, y: 0 }, b: { x: 5, y: 0 }, height: 3 }) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_1', boundary: rect(0, 0, 4, 3) }) });
  return s.project;
}

/** Forma comparável dos cortadores: planta, faixa de cota (amostrada no primeiro vértice) e metadados. */
function forma(c: LevelCutters): unknown {
  const solidos = (ss: LevelCutters['walls']) =>
    ss.map((s) => ({
      kind: s.kind,
      pieces: s.pieces.map((sp) => ({
        poly: sp.poly,
        flat: sp.flat,
        span: sp.poly[0]?.[0]?.map((v) => sp.span(v)) ?? null,
        meta: sp.meta ?? null,
        external: sp.external ?? false,
      })),
    }));
  return { floors: solidos(c.floors), slabs: solidos(c.slabs), walls: solidos(c.walls) };
}

describe('CacheLRUPorBytes (teto em bytes estimados)', () => {
  it('expulsa o item menos usado recentemente ao passar do teto', () => {
    const c = new CacheLRUPorBytes<number>(10, (n) => n);
    c.set('a', 4);
    c.set('b', 4);
    c.get('a');
    c.set('c', 4);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(4);
    expect(c.get('c')).toBe(4);
    expect(c.expulsoes).toBe(1);
  });

  it('nunca passa do teto e não guarda item maior que o teto', () => {
    const c = new CacheLRUPorBytes<number>(10, (n) => n);
    c.set('grande', 11);
    expect(c.size).toBe(0);
    for (let i = 0; i < 50; i++) c.set(`k${i}`, 3);
    expect(c.bytes).toBeLessThanOrEqual(10);
    expect(c.size).toBe(3);
  });

  it('reduzir o teto expulsa o que não cabe mais', () => {
    const c = new CacheLRUPorBytes<number>(100, (n) => n);
    c.set('a', 40);
    c.set('b', 40);
    c.definirLimite(50);
    expect(c.bytes).toBeLessThanOrEqual(50);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(40);
  });
});

describe('teto do cache de cortadores (junctionNet)', () => {
  afterEach(() => definirTetoCacheCortadores(TETO_CACHE_CORTADORES_PADRAO));

  it('teto mínimo (nada cabe) não muda o resultado: recalcula sob demanda', () => {
    const p = predio();
    const cheio = [forma(levelCutterSet(p, 'lv_0')), forma(levelCutterSet(p, 'lv_1'))];
    definirTetoCacheCortadores(1);
    expect(estadoCacheCortadores().size).toBe(0);
    const sem = [forma(levelCutterSet({ ...p }, 'lv_0')), forma(levelCutterSet({ ...p }, 'lv_1'))];
    expect(sem).toEqual(cheio);
    expect(estadoCacheCortadores().bytes).toBe(0);
  });

  it('expulsão com teto apertado respeita o teto, conta as expulsões e não muda o resultado', () => {
    const p = predio();
    definirTetoCacheCortadores(1); // esvazia o cache
    definirTetoCacheCortadores(TETO_CACHE_CORTADORES_PADRAO);
    const ref0 = forma(levelCutterSet(p, 'lv_0'));
    const ref1 = forma(levelCutterSet(p, 'lv_1'));
    definirTetoCacheCortadores(1); // esvazia de novo
    definirTetoCacheCortadores(TETO_CACHE_CORTADORES_PADRAO);
    // Cópia do projeto: o cache por projeto não guarda, então o nível 0 é recalculado e volta ao cache global.
    expect(forma(levelCutterSet({ ...p }, 'lv_0'))).toEqual(ref0);
    // Teto igual ao que o nível 0 ocupa: o nível 1 não cabe junto e expulsa.
    const teto = estadoCacheCortadores().bytes;
    expect(teto).toBeGreaterThan(0);
    definirTetoCacheCortadores(teto);
    const antes = estadoCacheCortadores().expulsoes;
    expect(forma(levelCutterSet({ ...p }, 'lv_1'))).toEqual(ref1);
    expect(estadoCacheCortadores().bytes).toBeLessThanOrEqual(teto);
    expect(estadoCacheCortadores().expulsoes).toBeGreaterThan(antes);
    expect(forma(levelCutterSet({ ...p }, 'lv_0'))).toEqual(ref0);
    expect(estadoCacheCortadores().bytes).toBeLessThanOrEqual(teto);
  });

  it('o teto padrão é de 64 MB e pode ser trocado; valor não positivo é recusado', () => {
    expect(estadoCacheCortadores().limit).toBe(TETO_CACHE_CORTADORES_PADRAO);
    expect(TETO_CACHE_CORTADORES_PADRAO).toBe(64 * 1024 * 1024);
    expect(() => definirTetoCacheCortadores(0)).toThrow();
    definirTetoCacheCortadores(1024);
    expect(estadoCacheCortadores().limit).toBe(1024);
  });
});
