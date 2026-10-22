import { describe, expect, it } from 'vitest';
import { ifcGuid } from './ifcGuid.ts';

const ALPHABET = /^[0-9A-Za-z_$]{22}$/;

describe('ifcGuid', () => {
  it('gera 22 caracteres do alfabeto IFC', () => {
    expect(ifcGuid('wall:abc')).toMatch(ALPHABET);
  });

  it('é determinístico: a mesma chave dá o mesmo GlobalId', () => {
    expect(ifcGuid('storey:l1')).toBe(ifcGuid('storey:l1'));
  });

  it('chaves diferentes dão GlobalIds diferentes (sem colisão em 5000 elementos)', () => {
    const ids = new Set(Array.from({ length: 5000 }, (_, i) => ifcGuid(`wall:${i}`)));
    expect(ids.size).toBe(5000);
  });

  it('o primeiro caractere carrega só os 2 bits de cima (0 a 3)', () => {
    for (let i = 0; i < 200; i++) expect('0123'.includes(ifcGuid(`k${i}`)[0]!)).toBe(true);
  });
});
