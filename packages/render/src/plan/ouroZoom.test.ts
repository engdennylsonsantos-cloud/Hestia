import { describe, expect, it } from 'vitest';
import ouro from './ouroZoom.json';
import { buildPlanDrawList } from './build.ts';
import { canonico, cenarios, chaveDoCenario, entradaDe, resumo } from './cenariosZoom.ts';

/**
 * Referência de antes de o zoom sair da geometria: o resumo da lista de desenho canônica de cada cenário nos zooms 12, 60
 * e 220, gerado pelo código anterior (geometria refeita a cada zoom, medidas em pixels resolvidas na construção). A
 * lista de desenho de hoje (geometria sem zoom + `resolverZoom`) tem de dar o mesmo resumo: mesma imagem.
 */
const REFERENCIA = ouro as Record<string, string>;
const ZOOMS = [12, 60, 220];

describe('lista de desenho igual à de antes do zoom sair da geometria', () => {
  const todos = cenarios();
  it('o conjunto de cenários e zooms é o da referência', () => {
    expect(Object.keys(REFERENCIA)).toHaveLength(todos.length * ZOOMS.length);
  });

  for (const c of todos) {
    for (const z of ZOOMS) {
      it(`${c.nome}, zoom ${z}`, () => {
        const chave = chaveDoCenario(c.nome, z);
        const lista = buildPlanDrawList(entradaDe(c, z));
        expect(resumo(canonico(lista, z))).toBe(REFERENCIA[chave]);
      }, 60000);
    }
  }
});
