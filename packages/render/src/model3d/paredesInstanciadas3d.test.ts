import { describe, expect, it } from 'vitest';
import type { LayerBand } from '@hestia/engine';
import { junctionLevel, resolveLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeLevel, makeWall, type Opening } from '@hestia/model';
import { projetoDaJuncao } from '../plan/viewContext.ts';
import { arestasDaUniao } from './arestasDaUniao3d.ts';
import type { CaixaPlanta } from './caixas3d.ts';
import { buildLevelSolidsComCaixas, caixasDaCamada } from './paredesInstanciadas3d.ts';

/** Faixa retangular (x0..x1, y0..y1) entre as cotas z0 e z1. */
const faixa = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): LayerBand => ({
  z0,
  z1,
  poly: [[[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]]],
});

const comprimento = (arestas: readonly number[]): number => {
  let t = 0;
  for (let i = 0; i < arestas.length; i += 6) t += Math.hypot(arestas[i + 3]! - arestas[i]!, arestas[i + 4]! - arestas[i + 1]!, arestas[i + 5]! - arestas[i + 2]!);
  return t;
};

describe('caixasDaCamada', () => {
  it('uma faixa retangular vira uma caixa (e as 12 arestas dela, se pedidas)', () => {
    const c = caixasDaCamada([faixa(0, 4, 0, 0.14, 0, 2.8)], 1, true)!;
    expect(c.matrizes).toHaveLength(1);
    expect(Array.from(c.matrizes[0]!).slice(12, 15)).toEqual([2, 0.07, 1 + 1.4]);
    expect(c.arestas).toHaveLength(72);
    expect(comprimento(c.arestas)).toBeCloseTo(4 * (4 + 0.14 + 2.8), 9);
    expect(caixasDaCamada([faixa(0, 4, 0, 0.14, 0, 2.8)], 1, false)!.arestas).toEqual([]);
  });

  it('faixa sem altura é ignorada (como na extrusão); fina demais manda a camada para a geometria', () => {
    expect(caixasDaCamada([faixa(0, 4, 0, 0.14, 0, 0)], 0, false)!.matrizes).toHaveLength(0);
    expect(caixasDaCamada([faixa(0, 4, 0, 0.14, 0, 5e-5)], 0, false)).toBeNull();
  });

  it('o que não é prisma retangular plano fica na geometria: topo inclinado, trapézio, furo, peças que se sobrepõem', () => {
    const inclinada: LayerBand = { ...faixa(0, 4, 0, 0.14, 0, 2.8), slope: { o: { x: 0, y: 0 }, d: { x: 1, y: 0 }, t0: 0, t1: 4, h0: 2, h1: 3 } };
    expect(caixasDaCamada([inclinada], 0, false)).toBeNull();
    const trapezio: LayerBand = { z0: 0, z1: 2.8, poly: [[[{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 3.9, y: 0.14 }, { x: 0, y: 0.14 }]]] };
    expect(caixasDaCamada([trapezio], 0, false)).toBeNull();
    const furo: LayerBand = { z0: 0, z1: 2.8, poly: [[[{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 0, y: 1 }], [{ x: 1, y: 0.2 }, { x: 1, y: 0.4 }, { x: 2, y: 0.4 }, { x: 2, y: 0.2 }]]] };
    expect(caixasDaCamada([furo], 0, false)).toBeNull();
    expect(caixasDaCamada([faixa(0, 4, 0, 0.14, 0, 2.8), faixa(3, 5, 0, 0.14, 0, 2.8)], 0, false)).toBeNull();
  });

  it('peças encostadas valem; com arestas, saem as da união (sem as juntas)', () => {
    // Parede com janela de 1 × 1 m: abaixo, acima, à esquerda e à direita do vão (espessura 0,14).
    const janela = [faixa(0, 4, 0, 0.14, 0, 1), faixa(0, 4, 0, 0.14, 2, 2.8), faixa(0, 1.5, 0, 0.14, 1, 2), faixa(2.5, 4, 0, 0.14, 1, 2)];
    const c = caixasDaCamada(janela, 0, true)!;
    expect(c.matrizes).toHaveLength(4);
    // Caixa externa (12 arestas) + contorno do vão nas duas faces (2 × 4 m) + as 4 arestas do vão ao longo da espessura.
    expect(comprimento(c.arestas)).toBeCloseTo(4 * (4 + 0.14 + 2.8) + 2 * 4 + 4 * 0.14, 9);
  });

  it('duas faixas empilhadas com a mesma planta dão as arestas de uma caixa só', () => {
    const c = caixasDaCamada([faixa(0, 4, 0, 0.14, 0, 1), faixa(0, 4, 0, 0.14, 1, 2.8)], 0, true)!;
    expect(comprimento(c.arestas)).toBeCloseTo(4 * (4 + 0.14 + 2.8), 9);
  });
});

describe('arestasDaUniao', () => {
  const caixa = (cx: number, cy: number, ang: number, w: number, d: number): CaixaPlanta => ({ cx, cy, ang, w, d, z0: 0, h: 1 });
  it('caixas com giros incompatíveis ou em excesso ficam fora (null)', () => {
    expect(arestasDaUniao([caixa(0, 0, 0, 1, 1), caixa(2, 0, 0.3, 1, 1)])).toBeNull();
    expect(arestasDaUniao(Array.from({ length: 25 }, (_, i) => caixa(i * 2, 0, 0, 1, 1)))).toBeNull();
    expect(arestasDaUniao([])).toEqual([]);
  });
  it('caixa girada de um quarto de volta (lados trocados) entra na mesma grade', () => {
    const a = arestasDaUniao([caixa(0, 0, 0, 2, 1), caixa(0, 1, Math.PI / 2, 1, 2)])!;
    const b = arestasDaUniao([caixa(0, 0, 0, 2, 1), caixa(0, 1, 0, 2, 1)])!;
    expect(comprimento(a)).toBeCloseTo(comprimento(b), 9);
  });
  it('peça separada por um vão dá as arestas das duas caixas', () => {
    const c = arestasDaUniao([caixa(0, 0, 0, 1, 1), caixa(3, 0, 0, 1, 1)])!;
    expect(comprimento(c)).toBeCloseTo(2 * 12, 9);
  });
});

describe('paredes do nível em caixas', () => {
  function projeto(extra: (s: ProjectStore) => void): { rl: ReturnType<typeof resolveLevel>; jl: ReturnType<typeof junctionLevel> } {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_0', name: 'P', elevation: 0 }) });
    extra(s);
    const p = s.project;
    return { rl: resolveLevel(p, 'lv_0'), jl: junctionLevel(projetoDaJuncao(p, 'lv_0'), 'lv_0') };
  }
  const parede = (s: ProjectStore, id: string, a: [number, number], b: [number, number], sag = 0): void => {
    s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, sag }) });
  };

  it('parede reta isolada: as 5 camadas viram caixas e nada vai para a geometria', () => {
    const { rl, jl } = projeto((s) => parede(s, 'w', [0, 0], [4, 0]));
    const r = buildLevelSolidsComCaixas(rl, jl, true);
    expect(r.batches).toHaveLength(0);
    expect(r.caixas).toHaveLength(5);
    expect(r.caixas.every((c) => c.wallId === 'w')).toBe(true);
    expect(r.arestas.length).toBe(5 * 72);
  });

  it('parede curva fica na geometria (a reta do mesmo nível vira caixas)', () => {
    const { rl, jl } = projeto((s) => {
      parede(s, 'reta', [0, 0], [4, 0]);
      parede(s, 'curva', [0, 5], [4, 5], 1);
    });
    const r = buildLevelSolidsComCaixas(rl, jl, true);
    expect(r.caixas.every((c) => c.wallId === 'reta')).toBe(true);
    expect(r.batches.flatMap((b) => b.ids.map((x) => x.id))).toContain('curva');
    expect(r.batches.flatMap((b) => b.ids.map((x) => x.id))).not.toContain('reta');
  });

  it('parede com porta: com ou sem arestas, as camadas viram caixas (mais de uma por camada)', () => {
    const { rl, jl } = projeto((s) => {
      parede(s, 'w', [0, 0], [4, 0]);
      const porta: Opening = { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'w', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' };
      s.exec({ type: 'addOpening', opening: porta });
    });
    for (const arestas of [true, false]) {
      const r = buildLevelSolidsComCaixas(rl, jl, arestas);
      expect(r.batches).toHaveLength(0);
      expect(r.caixas.length).toBeGreaterThan(5);
    }
  });
});
