import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GraphicsCategory } from '@hestia/model';
import { criarCaixaUnitaria, matrizDaCaixa } from './caixas3d.ts';
import type { EntradaNivel } from './cacheMalhas3d.ts';
import type { SolidBatch } from './solids.ts';
import { FAIXAS_MAX, LotesPorFaixa, NIVEIS_POR_FAIXA, contarFaixas, indiceDaFaixa, triangulosDaMalha } from './faixas3d.ts';
import { TETO_VRAM_PADRAO } from '../gpu/orcamento.ts';

/** Material neutro: estes testes não olham a cor, só os buffers e as caixas. */
const material = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial();

/** Triângulo de um elemento (categoria piso), deslocado em x e z. */
function triangulo(id: string, x: number, z: number, categoria: GraphicsCategory = 'floor'): SolidBatch {
  return {
    materialId: 'm1',
    category: categoria,
    positions: [x, 0, z, x + 1, 0, z, x, 1, z],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2],
    ids: [{ id, start: 0, count: 3 }],
  };
}

/** Entrada de nível: um piso de um triângulo, uma caixa e arestas. `z` é a cota do nível. */
function entrada(levelId: string, i: number): EntradaNivel {
  const z = i * 3;
  return {
    levelId,
    chave: levelId,
    grupo: new THREE.Group(),
    picks: [],
    mats: [],
    bytes: 0,
    lotes: [triangulo(`${levelId}_f`, i * 2, z)],
    instancias: [{ categoria: 'wall', materialId: 'm1', matrizes: Float32Array.from(matrizDaCaixa(i * 2, 0, z + 1.5, 0, 0.2, 0.2, 3)) }],
    arestas: new Float32Array([i * 2, 0, z, i * 2 + 1, 0, z]),
  };
}

const niveis = (n: number): EntradaNivel[] => Array.from({ length: n }, (_, i) => entrada(`lv_${i}`, i));

/** Faixas com um orçamento e um material só (sem DOM, sem renderer). */
function faixas(opcoes: { niveisPorFaixa?: number; faixasMax?: number } = {}): LotesPorFaixa {
  return new LotesPorFaixa({
    caixaUnitaria: criarCaixaUnitaria(),
    material: () => material(),
    materialArestas: () => material(),
    ...opcoes,
  });
}

const op = { instanciar: true, arestas: true, sombras: true };

describe('divisão em faixas: níveis por faixa, teto de faixas e ordem do projeto', () => {
  it('60 pavimentos com 10 por faixa viram 6 faixas de 10, na ordem do projeto', () => {
    expect(contarFaixas(60)).toBe(6);
    expect(indiceDaFaixa(0, 60)).toBe(0);
    expect(indiceDaFaixa(9, 60)).toBe(0);
    expect(indiceDaFaixa(10, 60)).toBe(1);
    expect(indiceDaFaixa(59, 60)).toBe(5);
  });

  it('projeto pequeno não ganha faixas: 1 faixa até 10 níveis (o caminho do R1)', () => {
    for (const n of [1, 5, 10]) {
      expect(contarFaixas(n)).toBe(1);
      expect(indiceDaFaixa(n - 1, n)).toBe(0);
    }
    expect(contarFaixas(11)).toBe(2);
  });

  it('o teto de faixas limita um prédio muito alto', () => {
    expect(contarFaixas(600, NIVEIS_POR_FAIXA, FAIXAS_MAX)).toBe(FAIXAS_MAX);
    expect(indiceDaFaixa(599, 600, NIVEIS_POR_FAIXA, FAIXAS_MAX)).toBe(FAIXAS_MAX - 1);
  });

  it('faixas o mais iguais possível, sem buraco e sem repetir nível', () => {
    for (const n of [11, 23, 60, 61, 121]) {
      const vistos: number[] = [];
      for (let i = 0; i < n; i++) vistos.push(indiceDaFaixa(i, n));
      expect(new Set(vistos).size).toBe(contarFaixas(n));
      for (let i = 1; i < n; i++) expect(vistos[i]!).toBeGreaterThanOrEqual(vistos[i - 1]!);
      const tamanhos = new Map<number, number>();
      for (const f of vistos) tamanhos.set(f, (tamanhos.get(f) ?? 0) + 1);
      const valores = [...tamanhos.values()];
      const cheias = contarFaixas(n);
      // Até o teto, as faixas são blocos cheios (só a última é menor); acima dele, equilibradas.
      if (n <= NIVEIS_POR_FAIXA * FAIXAS_MAX) expect(valores.slice(0, cheias - 1).every((v) => v === NIVEIS_POR_FAIXA)).toBe(true);
      else expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
    }
  });

  it('índice fora da lista devolve -1', () => {
    expect(indiceDaFaixa(-1, 10)).toBe(-1);
    expect(indiceDaFaixa(10, 10)).toBe(-1);
    expect(indiceDaFaixa(0, 0)).toBe(-1);
  });
});

describe('LotesPorFaixa: um gestor por faixa, um orçamento só', () => {
  it('cria uma faixa por grupo de níveis e devolve as malhas de todas', () => {
    const l = faixas();
    const res = l.atualizar(niveis(25), op, true);
    expect(l.faixas).toHaveLength(3);
    expect(l.faixas.map((f) => f.niveis.length)).toEqual([10, 10, 5]);
    // Um lote de piso, um de parede instanciada e uma linha de arestas por faixa.
    expect(res.solidas).toHaveLength(3);
    expect(res.instanciadas).toHaveLength(3);
    expect(res.arestas).toHaveLength(3);
    l.dispose();
  });

  it('cada faixa desenha só os triângulos dela (nada duplicado, nada perdido)', () => {
    const l = faixas();
    const res = l.atualizar(niveis(25), op, true);
    const porFaixa = l.faixas.map((f) => f.triangulos);
    // Cada nível tem 1 triângulo de piso + 12 da caixa (12 arestas viram 2 triângulos por face... a caixa unitária tem 12).
    expect(porFaixa).toEqual([10 * (1 + 12), 10 * (1 + 12), 5 * (1 + 12)]);
    expect(porFaixa.reduce((a, b) => a + b, 0)).toBe(25 * (1 + 12));
    res.solidas.forEach((m, i) => expect(triangulosDaMalha(m)).toBe(l.faixas[i]!.niveis.length));
    l.dispose();
  });

  it('a caixa de cada faixa cobre só a sua cota (é o que o culling do three usa)', () => {
    const l = faixas();
    l.atualizar(niveis(25), op, true);
    const [a, b, c] = l.faixas;
    expect(a!.caixa.min.z).toBeCloseTo(0, 6);
    expect(a!.caixa.max.z).toBeCloseTo(30, 6); // 10 níveis de 3 m
    expect(b!.caixa.min.z).toBeCloseTo(30, 6);
    expect(c!.caixa.max.z).toBeCloseTo(75, 6);
    expect(c!.caixa.isEmpty()).toBe(false);
    l.dispose();
  });

  it('o orçamento de VRAM é um só para a cena: teto único e usado somado das faixas', () => {
    const l = faixas();
    l.atualizar(niveis(25), op, true);
    expect(l.teto).toBe(TETO_VRAM_PADRAO);
    expect(l.orcamento.usado).toBe(l.bytes);
    expect(l.orcamento.usado).toBeGreaterThan(0);
    expect(l.orcamento.excedido).toBe(false);
    // Cada faixa tem o seu contador (as chaves do R1 repetiriam `categoria|material` entre faixas e se sobrescreveriam).
    expect(l.faixas[0]!.gestor.orcamento).not.toBe(l.faixas[1]!.gestor.orcamento);
    const soma = l.faixas.reduce((t, f) => t + f.gestor.orcamento.usado, 0);
    expect(l.orcamento.usado).toBe(soma);
    l.dispose();
  });

  it('nível novo entra na faixa dele sem mexer no conteúdo das outras', () => {
    const l = faixas();
    const base = niveis(20);
    l.atualizar(base, op, true);
    const antes = l.faixas.map((f) => f.solidas.map((m) => m.geometry.userData.versao));
    // O nível 20 chega como entrada nova; os 20 anteriores são as mesmas entradas (o cache do nível é reaproveitado).
    l.atualizar([...base, entrada('lv_20', 20)], op, true);
    expect(l.faixas).toHaveLength(3);
    // As duas primeiras faixas (níveis 0–19) não foram refeitas: nenhuma geometria foi reenviada.
    const depois = l.faixas.map((f) => f.solidas.map((m) => m.geometry.userData.versao));
    expect(depois[0]).toEqual(antes[0]);
    expect(depois[1]).toEqual(antes[1]);
    expect(l.faixas[2]!.niveis).toEqual(['lv_20']);
    l.dispose();
  });

  it('projeto que encolhe descarta as faixas que sobraram (sem gestor pendurado)', () => {
    const l = faixas();
    l.atualizar(niveis(25), op, true);
    expect(l.faixas).toHaveLength(3);
    l.atualizar(niveis(5), op, true);
    expect(l.faixas).toHaveLength(1);
    expect(l.faixas[0]!.niveis).toHaveLength(5);
    expect(l.faixas[0]!.triangulos).toBe(5 * (1 + 12));
    l.dispose();
    expect(l.faixas).toHaveLength(0);
    expect(l.orcamento.usado).toBe(0);
  });

  it('sem níveis, nenhuma faixa', () => {
    const l = faixas();
    expect(l.atualizar([], op, true)).toEqual({ solidas: [], instanciadas: [], arestas: [], faixas: [] });
    expect(l.faixas).toHaveLength(0);
    l.dispose();
  });

  it('faixasMax = 1 reproduz o lote único do R1 (mesma geometria, um gestor)', () => {
    const l = faixas({ faixasMax: 1 });
    const res = l.atualizar(niveis(25), op, true);
    expect(l.faixas).toHaveLength(1);
    expect(res.solidas).toHaveLength(1);
    expect(l.faixas[0]!.triangulos).toBe(25 * (1 + 12));
    l.dispose();
  });
});
