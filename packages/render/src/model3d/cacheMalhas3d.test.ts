import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CacheMalhas, TETO_MALHAS_BYTES, bytesDeNivel, disposeNivel, type EntradaNivel } from './cacheMalhas3d.ts';

/** Entrada de nível de teste: grupo vazio e `bytes` informados. */
function entrada(levelId: string, chave: string, bytes: number): EntradaNivel {
  return { levelId, chave, grupo: new THREE.Group(), picks: [], mats: [], bytes };
}

describe('cache de malhas por nível (LRU com teto em bytes)', () => {
  it('o teto padrão é de 128 MB', () => {
    expect(new CacheMalhas().teto).toBe(TETO_MALHAS_BYTES);
    expect(TETO_MALHAS_BYTES).toBe(128 * 2 ** 20);
  });

  it('buscar devolve a entrada só com a mesma chave', () => {
    const c = new CacheMalhas(1000);
    const e = entrada('a', 'k1', 10);
    c.guardar(e);
    expect(c.buscar('a', 'k1')).toBe(e);
    expect(c.buscar('a', 'k2')).toBeUndefined();
    expect(c.buscar('b', 'k1')).toBeUndefined();
  });

  it('guardar com o mesmo nível devolve a entrada que ela substitui', () => {
    const c = new CacheMalhas(1000);
    const velha = entrada('a', 'k1', 10);
    const nova = entrada('a', 'k2', 20);
    c.guardar(velha);
    expect(c.guardar(nova)).toBe(velha);
    expect(c.contem(velha)).toBe(false);
    expect(c.contem(nova)).toBe(true);
    expect(c.total).toBe(20);
  });

  it('enforcar expulsa as menos recentes até caber no teto; buscar conta como uso', () => {
    const c = new CacheMalhas(30);
    const a = entrada('a', 'k', 10);
    const b = entrada('b', 'k', 10);
    const d = entrada('c', 'k', 10);
    c.guardar(a);
    c.guardar(b);
    c.guardar(d);
    expect(c.total).toBe(30);
    // Usa `a`: a menos recente passa a ser `b`.
    c.buscar('a', 'k');
    const e = entrada('e', 'k', 10);
    c.guardar(e);
    expect(c.enforcar()).toEqual([b]);
    expect(c.total).toBe(30);
    expect(c.contem(a) && c.contem(d) && c.contem(e)).toBe(true);
  });

  it('enforcar não expulsa nada enquanto o total cabe no teto', () => {
    const c = new CacheMalhas(100);
    c.guardar(entrada('a', 'k', 40));
    c.guardar(entrada('b', 'k', 60));
    expect(c.enforcar()).toEqual([]);
    expect(c.tamanho).toBe(2);
  });

  it('teto zero: nada fica no cache', () => {
    const c = new CacheMalhas(0);
    const a = entrada('a', 'k', 5);
    c.guardar(a);
    expect(c.enforcar()).toEqual([a]);
    expect(c.tamanho).toBe(0);
  });

  it('limpar devolve todas as entradas e esvazia o cache', () => {
    const c = new CacheMalhas(100);
    const a = entrada('a', 'k', 1);
    const b = entrada('b', 'k', 1);
    c.guardar(a);
    c.guardar(b);
    expect(c.limpar()).toEqual([a, b]);
    expect(c.tamanho).toBe(0);
  });

  it('bytesDeNivel conta as geometrias do grupo e as de picking, cada uma uma vez', () => {
    const grupo = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    grupo.add(new THREE.Mesh(geo));
    const bytes = bytesDeNivel(grupo, [{ geo, owner: grupo, kind: 'wall', ranges: [] }]);
    const esperado = geo.index!.array.byteLength + Object.values(geo.attributes).reduce((s, a) => s + a.array.byteLength, 0);
    expect(bytes).toBe(esperado);
  });

  it('disposeNivel libera as geometrias do grupo e as de picking', () => {
    const grupo = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const geoPick = new THREE.BoxGeometry(2, 2, 2);
    grupo.add(new THREE.Mesh(geo));
    const eGeo = vi.spyOn(geo, 'dispose');
    const ePick = vi.spyOn(geoPick, 'dispose');
    disposeNivel({ levelId: 'a', chave: 'k', grupo, picks: [{ geo: geoPick, owner: grupo, kind: 'wall', ranges: [] }], mats: [], bytes: 0 });
    expect(eGeo).toHaveBeenCalledTimes(1);
    expect(ePick).toHaveBeenCalledTimes(1);
  });
});
