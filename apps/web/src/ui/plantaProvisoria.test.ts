import { describe, expect, it } from 'vitest';
import { LIGHT } from '@hestia/render';
import { caixaDe, empacotarAnel } from '@hestia/engine/src/fluxoGeometria.ts';
import type { ElementoGeometrico } from '@hestia/engine/src/fluxoPatch.ts';
import { faixaApagadora, operacoesProvisorias, temContorno, temProvisorioVisivel } from './plantaProvisoria.ts';

/** Elemento provisório com um anel dado. */
const elemento = (id: string, kind: ElementoGeometrico['kind'], anel: Array<[number, number]>): ElementoGeometrico => {
  const geometria = empacotarAnel(anel.map(([x, y]) => ({ x, y })));
  return { id, kind, provisorio: true, z0: 0, z1: 3, geometria, caixa: caixaDe(geometria) };
};
const vazio = (id: string): ElementoGeometrico => elemento(id, 'stair', []);

/** Parede reta de 4 m por 0,2 m, no formato de `contornoDaParede`: lado baixo de a a b, depois o alto de b a a. */
const parede = (id: string, x0: number, y = 0): ElementoGeometrico => elemento(id, 'wall', [[x0, y - 0.1], [x0 + 4, y - 0.1], [x0 + 4, y + 0.1], [x0, y + 0.1]]);

describe('faixaApagadora', () => {
  it('cobre a espessura inteira do retângulo, pela linha central, com folga nas pontas', () => {
    const anel = [{ x: 0, y: -0.1 }, { x: 4, y: -0.1 }, { x: 4, y: 0.1 }, { x: 0, y: 0.1 }];
    const f = faixaApagadora(anel, 50, '#fff')!;
    expect(f.closed).toBe(false);
    expect(f.widthPx).toBeCloseTo(0.2 * 50 + 6, 6); // espessura em pixels mais a folga
    expect(f.pts).toHaveLength(2);
    expect(f.pts[0]!.y).toBeCloseTo(0, 9);
    expect(f.pts[0]!.x).toBeLessThan(0); // estendida além da ponta
    expect(f.pts[1]!.x).toBeGreaterThan(4);
  });

  it('parede em arco (anel longo) segue a poligonal central', () => {
    const lo = [0, 1, 2, 3].map((i) => ({ x: i, y: 0 }));
    const hi = [0, 1, 2, 3].map((i) => ({ x: i, y: 0.3 }));
    const f = faixaApagadora([...lo, ...hi.reverse()], 100, '#fff')!;
    expect(f.pts).toHaveLength(4);
    expect(f.widthPx).toBeCloseTo(0.3 * 100 + 6, 6);
  });

  it('anel que não é faixa (ímpar ou curto) não gera faixa', () => {
    expect(faixaApagadora([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 10, '#fff')).toBeNull();
    expect(faixaApagadora([], 10, '#fff')).toBeNull();
  });
});

describe('operacoesProvisorias', () => {
  it('apaga o contorno antigo com a cor do fundo antes de desenhar o novo (traços e preenchimentos)', () => {
    const ops = operacoesProvisorias({ apagar: [parede('w', 0)], desenhar: [parede('w', 1)] }, LIGHT, 50);
    expect(ops.fills).toHaveLength(2);
    expect(ops.fills[0]!.color).toBe(LIGHT.bg); // primeiro o apagador
    expect(ops.fills[0]!.alpha).toBe(1);
    expect(ops.fills[1]!.color).toBe(LIGHT.inkSoft); // depois a parede nova
    expect(ops.strokes[0]!.color).toBe(LIGHT.bg); // faixa apagadora cobre linhas de camada e contorno
    expect(ops.strokes[0]!.closed).toBe(false);
    expect(ops.strokes.at(-1)!.color).toBe(LIGHT.ink); // contorno da parede nova por último
  });

  it('o vão vazado vem depois da parede, para cortá-la', () => {
    const porta = elemento('p', 'door', [[1, -0.1], [2, -0.1], [2, 0.1], [1, 0.1]]);
    const ops = operacoesProvisorias({ apagar: [], desenhar: [porta, parede('w', 0)] }, LIGHT, 50);
    expect(ops.fills.map((f) => f.color)).toEqual([LIGHT.inkSoft, LIGHT.bg]);
  });

  it('elemento sem contorno (escada) não gera nada; piso apagado usa o traço de contorno', () => {
    expect(operacoesProvisorias({ apagar: [vazio('e')], desenhar: [vazio('e')] }, LIGHT, 50)).toEqual({ fills: [], strokes: [] });
    const piso = elemento('f', 'floor', [[0, 0], [2, 0], [2, 2]]);
    const ops = operacoesProvisorias({ apagar: [piso], desenhar: [] }, LIGHT, 50);
    expect(ops.strokes).toHaveLength(1);
    expect(ops.strokes[0]!).toMatchObject({ closed: true, color: LIGHT.bg });
  });

  it('sem nada a apagar nem a desenhar: vazio', () => {
    expect(operacoesProvisorias({ apagar: [], desenhar: [] }, LIGHT, 50)).toEqual({ fills: [], strokes: [] });
  });
});

describe('temProvisorioVisivel', () => {
  it('só conta contorno de verdade, ou remoção a esconder', () => {
    expect(temContorno([vazio('e')])).toBe(false);
    expect(temContorno([parede('w', 0)])).toBe(true);
    expect(temProvisorioVisivel({ apagar: [], desenhar: [vazio('e')] }, [])).toBe(false);
    expect(temProvisorioVisivel({ apagar: [], desenhar: [parede('w', 0)] }, [])).toBe(true);
    expect(temProvisorioVisivel({ apagar: [parede('w', 0)], desenhar: [] }, [])).toBe(true);
    expect(temProvisorioVisivel({ apagar: [], desenhar: [] }, ['w'])).toBe(true);
  });
});
