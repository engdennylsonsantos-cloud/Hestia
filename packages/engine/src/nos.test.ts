import { describe, expect, it } from 'vitest';
import { intersection, multiArea, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type JoinKind, type Wall } from '@hestia/model';
import { resolveLevel } from './index.ts';
import type { ResolvedLevel } from './types.ts';

/** Nós de três ou mais paredes (J-2, docs/08 §6): silhueta sem furo, sem sobreposição e área do núcleo. */

const ALV14 = 'wt_alv14';
const EXT19 = 'wt_ext19';
const BLOCO_GROSSA = 'mat_bloco19';
/**
 * Tolerância das somas (m²). O Clipper trabalha numa grade de 1 µm (`CLIP_SCALE` em geom/boolean.ts) e o fechamento de
 * frestas (`closeGapsSafe`) mexe alguns 1e-6 m² em silhuetas de perímetro de metros: 1e-6 exato não é alcançável.
 */
const TOL = 1e-5;
const O: Vec2 = { x: 0, y: 0 };
/** Caixa em volta do nó (x0, y0, x1, y1), em metros. */
const CAIXA = [-0.15, -0.15, 0.15, 0.15] as const;
const KINDS: JoinKind[] = ['miter', 'butt'];

type Parede = Omit<Wall, 'order'>;

const deg = (d: number): number => (d * Math.PI) / 180;
const ponto = (graus: number, comp = 3): Vec2 => ({ x: comp * Math.cos(deg(graus)), y: comp * Math.sin(deg(graus)) });

function parede(id: string, a: Vec2, b: Vec2, typeId = ALV14, extra: Partial<Wall> = {}): Parede {
  return makeWall({ id, typeId, levelId: 'lv_0', a, b, ...extra });
}

/** Configura o fim `start` (a) das paredes com a mesma configuração de junção. */
const comJuncao = (kind: JoinKind): Partial<Wall> => ({ joinStart: { kind, flip: false } });

function resolver(paredes: Parede[]): ResolvedLevel {
  const s = new ProjectStore(createEmptyProject());
  for (const w of paredes) s.exec({ type: 'addWall', wall: w });
  return resolveLevel(s.project, 'lv_0', new Map());
}

/** Silhueta do nível: um único polígono, um único anel (sem furo), e a soma das camadas igual à área dela. */
function conferirSilhueta(r: ResolvedLevel): number {
  const sil = union(...r.clusters.map((c) => c.silhouette));
  const soma = Object.values(r.walls)
    .flatMap((w) => w.layers)
    .reduce((acc, l) => acc + multiArea(l.cut), 0);
  expect(sil, 'silhueta com um polígono').toHaveLength(1);
  expect(sil[0], 'silhueta sem furo').toHaveLength(1);
  expect(Math.abs(soma - multiArea(sil)), 'camadas somam a silhueta (sem sobreposição)').toBeLessThan(TOL);
  return multiArea(sil);
}

const caixaMP = (c: readonly number[]): MultiPolygon => {
  const [x0, y0, x1, y1] = c as [number, number, number, number];
  return [[[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]]];
};

/** Área por material das camadas dentro da caixa. */
function porMaterial(r: ResolvedLevel, c: readonly number[] = CAIXA): Map<string, number> {
  const box = caixaMP(c);
  const m = new Map<string, number>();
  for (const w of Object.values(r.walls)) {
    for (const l of w.layers) {
      const area = l.cut.length === 0 ? 0 : multiArea(intersection(l.cut, box));
      m.set(l.materialId, (m.get(l.materialId) ?? 0) + area);
    }
  }
  return m;
}

/** Soma em valor absoluto das diferenças de área por material entre dois resultados. */
function diferenca(a: Map<string, number>, b: Map<string, number>): number {
  const materiais = new Set([...a.keys(), ...b.keys()]);
  let d = 0;
  for (const k of materiais) d += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
  return d;
}

describe('nós de três ou mais paredes (J-2)', () => {
  it('Y de três paredes iguais (120°, alvenaria 14): um anel, sem furo, sem sobreposição', () => {
    const r = resolver([0, 120, 240].map((g, i) => parede(`y${i}`, O, ponto(g))));
    conferirSilhueta(r);
  });

  it('Y de três paredes iguais: os totais por material não dependem da ordem de criação', () => {
    const paredes = [0, 120, 240].map((g, i) => parede(`y${i}`, O, ponto(g)));
    const direta = porMaterial(resolver(paredes), [-10, -10, 10, 10]);
    const invertida = porMaterial(resolver([...paredes].reverse()), [-10, -10, 10, 10]);
    expect(diferenca(direta, invertida)).toBeLessThan(TOL);
  });

  describe('Y assimétrico 19+14+14 (cenário NO de juncoesAcabamento.test.ts)', () => {
    const montarNO = (kind: JoinKind): Parede[] => [
      parede('g', O, { x: 4, y: 0 }, EXT19, comJuncao(kind)),
      parede('f1', O, { x: 0, y: 3 }, ALV14, comJuncao(kind)),
      parede('f2', O, { x: -2, y: -2 }, ALV14, comJuncao(kind)),
    ];

    it.each(KINDS)('kind %s: um anel, sem furo, camadas somam a silhueta', (kind) => {
      conferirSilhueta(resolver(montarNO(kind)));
    });

    it.each(KINDS)('kind %s: bloco19 na caixa do nó ≥ 0,0280 m² (o núcleo da grossa não é apertado)', (kind) => {
      const bloco = porMaterial(resolver(montarNO(kind))).get(BLOCO_GROSSA) ?? 0;
      expect(bloco).toBeGreaterThanOrEqual(0.028);
    });
  });

  describe('nó com lacuna reflexa (paredes a 0°, 60°, 120°; mistura de alvenaria 14 e externa 19; área por material muda entre miter e butt)', () => {
    // Lacuna de 240° entre 120° e 0°: canto externo ali, que a junção de par cobre conforme a configuração.
    const montarReflexo = (kind: JoinKind): Parede[] => [
      parede('b', O, ponto(0), EXT19, comJuncao(kind)),
      parede('m', O, ponto(60)),
      parede('a', O, ponto(120), ALV14, comJuncao(kind)),
    ];

    it.each(KINDS)('kind %s: um anel, sem furo, camadas somam a silhueta', (kind) => {
      conferirSilhueta(resolver(montarReflexo(kind)));
    });

    it('a área por material na caixa muda entre miter e butt', () => {
      const porKind = new Map(KINDS.map((k) => [k, porMaterial(resolver(montarReflexo(k)))] as const));
      expect(diferenca(porKind.get('miter')!, porKind.get('butt')!)).toBeGreaterThan(1e-6);
    });
  });

  it('X de quatro paredes (colineares duas a duas): um anel, sem furo', () => {
    const r = resolver([
      parede('h1', O, { x: 3, y: 0 }),
      parede('h2', O, { x: -3, y: 0 }),
      parede('v1', O, { x: 0, y: 3 }),
      parede('v2', O, { x: 0, y: -3 }),
    ]);
    conferirSilhueta(r);
  });

  it('duas paredes sobrepostas na mesma direção + terceira: não há canto falso (um anel, sem furo)', () => {
    const r = resolver([parede('p', O, ponto(0)), parede('q', O, ponto(0)), parede('t', O, ponto(120))]);
    conferirSilhueta(r);
  });

  it('nó de cinco paredes (72° entre elas): um anel, sem furo, sem sobreposição', () => {
    const r = resolver([0, 72, 144, 216, 288].map((g, i) => parede(`p${i}`, O, ponto(g))));
    conferirSilhueta(r);
  });

  describe('X de quatro braços com tipos mistos (dois pares colineares, sem parede passante)', () => {
    // 45° e 225° são colineares (grossa 19), 135° e 315° também (alvenaria 14): nenhum braço é ramal de parede que passa.
    const montarX4 = (kind: JoinKind): Parede[] => [
      parede('a', O, ponto(45), EXT19, comJuncao(kind)),
      parede('b', O, ponto(135), ALV14, comJuncao(kind)),
      parede('c', O, ponto(225), EXT19, comJuncao(kind)),
      parede('d', O, ponto(315), ALV14, comJuncao(kind)),
    ];

    it.each(KINDS)('kind %s: um anel, sem furo, camadas somam a silhueta', (kind) => {
      conferirSilhueta(resolver(montarX4(kind)));
    });
  });

  describe('nó de três braços a 0°, 60° e 120° com tipos mistos (lacuna reflexa de 240°)', () => {
    const montar0_60_120 = (kind: JoinKind): Parede[] => [
      parede('g', O, ponto(0, 3), EXT19, comJuncao(kind)),
      parede('f1', O, ponto(60), ALV14, comJuncao(kind)),
      parede('f2', O, ponto(120), ALV14, comJuncao(kind)),
    ];

    it.each(KINDS)('kind %s: um anel, sem furo, camadas somam a silhueta', (kind) => {
      conferirSilhueta(resolver(montar0_60_120(kind)));
    });
  });

  describe('nó de cinco braços com tipos mistos e configuração de junção', () => {
    const montar5 = (kind: JoinKind): Parede[] =>
      [0, 72, 144, 216, 288].map((g, i) => parede(`p${i}`, O, ponto(g), i % 2 ? ALV14 : EXT19, comJuncao(kind)));

    it.each(KINDS)('kind %s: um anel, sem furo, camadas somam a silhueta', (kind) => {
      conferirSilhueta(resolver(montar5(kind)));
    });
  });
});
