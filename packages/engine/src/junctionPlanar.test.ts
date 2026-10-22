import { describe, expect, it } from 'vitest';
import { intersection, multiArea, type MultiPolygon } from '@hestia/geom';
import type { Layer, LayerFunction } from '@hestia/model';
import { layerCoreFlags, layerMetas, resolveJunction, winsOver, zOverlaps, type JunctionMeta, type PlanarPiece, type ResolvedPrism } from './junctionPlanar.ts';

const volume = (ps: readonly ResolvedPrism[]): number => ps.reduce((s, p) => s + multiArea(p.poly) * (p.z1 - p.z0), 0);

const rect = (x0: number, y0: number, x1: number, y1: number): MultiPolygon => [[[
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]]];

const m = (kind: JunctionMeta['kind'], priority: number, core = false): JunctionMeta => ({ kind, priority, core });
const L = (fn: LayerFunction, materialId = 'mat_x'): Layer => ({ function: fn, materialId, thickness: 0.01 }) as Layer;

describe('winsOver (decisão 0023 §1)', () => {
  it('prioridade menor (número) vence, independente do tipo', () => {
    expect(winsOver(m('wall', 1), m('floor', 4))).toBe(true);
    expect(winsOver(m('slab', 4), m('wall', 2))).toBe(false);
  });

  it('empate de prioridade: laje corta piso e parede; piso corta parede; mesmo tipo não resolve', () => {
    expect(winsOver(m('slab', 4), m('floor', 4))).toBe(true);
    expect(winsOver(m('floor', 4), m('slab', 4))).toBe(false);
    expect(winsOver(m('floor', 4), m('wall', 4))).toBe(true);
    expect(winsOver(m('wall', 4), m('floor', 4))).toBe(false);
    expect(winsOver(m('floor', 4), m('floor', 4))).toBeNull();
  });

  it('regra do núcleo (§1.2): camada do núcleo atravessa prioridade maior fora do núcleo do outro', () => {
    // Camada de prioridade 4 no núcleo atravessa a camada de prioridade 2 que está fora do núcleo do outro.
    expect(winsOver(m('floor', 4, true), m('wall', 2, false))).toBe(true);
    expect(winsOver(m('wall', 2, false), m('floor', 4, true))).toBe(false);
    // Sem o núcleo, a prioridade comum decide: a de número 2 vence.
    expect(winsOver(m('floor', 4, false), m('wall', 2, false))).toBe(false);
  });

  it('a regra do núcleo não atravessa camadas do núcleo do outro (núcleo com núcleo segue a prioridade)', () => {
    expect(winsOver(m('floor', 4, true), m('wall', 2, true))).toBe(false);
  });
});

describe('núcleo e metadados de camada', () => {
  it('núcleo é da primeira à última camada de estrutura; sem estrutura, tudo', () => {
    const f = [L('finish1'), L('substrate'), L('structure'), L('substrate'), L('finish2')];
    expect(layerCoreFlags(f)).toEqual([false, false, true, false, false]);
    expect(layerCoreFlags([L('finish1'), L('finish2')])).toEqual([true, true]);
  });

  it('metas usam prioridade efetiva e não dependem do nome do material', () => {
    const a = layerMetas('floor', [{ ...L('finish1', 'mat_a'), priority: 2 }, L('structure', 'mat_b')]);
    const b = layerMetas('floor', [{ ...L('finish1', 'mat_zz'), priority: 2 }, L('structure', 'mat_yy')]);
    expect(a).toEqual(b);
    expect(a).toEqual([
      { kind: 'floor', priority: 2, core: false },
      { kind: 'floor', priority: 1, core: true },
    ]);
  });
});

describe('resolveJunction (região resolvida por camada)', () => {
  const piece = (meta: JunctionMeta, poly: MultiPolygon, z0: number, z1: number): PlanarPiece => ({ meta, poly, z0, z1 });

  it('acabamento de piso (4) cruzando substrato de parede (2) perde a região comum', () => {
    const wall = piece(m('wall', 2), rect(0, 0, 0.2, 1), 0, 1);
    const finish = piece(m('floor', 4), rect(0, 0, 1, 1), 0.99, 1);
    const [w, f] = resolveJunction([wall, finish]);
    expect(volume(w!)).toBeCloseTo(0.2, 9);
    // Acabamento do piso: 0,8 m² na faixa de 0,01 m (a parte sob a parede sai).
    expect(volume(f!)).toBeCloseTo(0.8 * 0.01, 9);
  });

  it('camada de número maior recorta só na faixa de cota em que a outra existe', () => {
    // Estrutura do piso (1, núcleo) em cota 0 a 0,1; a parede (5) vai de 0 a 1 m: só a base da parede é cortada.
    const floorStruct = piece(m('floor', 1, true), rect(0, 0, 1, 1), 0, 0.1);
    const wallFinish = piece(m('wall', 5), rect(0.5, 0, 0.7, 1), 0, 1);
    const [f, w] = resolveJunction([floorStruct, wallFinish]);
    expect(volume(f!)).toBeCloseTo(0.1, 9);
    expect(volume(w!)).toBeCloseTo(0.2 * 1 - 0.2 * 0.1, 9);
  });

  it('sem sobreposição de cota, a camada fica inteira (um prisma só)', () => {
    const a = piece(m('floor', 1), rect(0, 0, 1, 1), 0, 0.1);
    const b = piece(m('wall', 5), rect(0, 0, 1, 1), 0.1, 1);
    expect(resolveJunction([a, b])).toEqual([[{ poly: a.poly, z0: 0, z1: 0.1 }], [{ poly: b.poly, z0: 0.1, z1: 1 }]]);
    expect(zOverlaps(a, b)).toBe(false);
  });

  it('mesmo tipo e mesma prioridade: as duas ficam (aviso, sem resolver)', () => {
    const a = piece(m('floor', 3), rect(0, 0, 1, 1), 0, 1);
    const b = piece(m('floor', 3), rect(0.5, 0, 1.5, 1), 0, 1);
    const [ra, rb] = resolveJunction([a, b]);
    expect(volume(ra!)).toBeCloseTo(1, 9);
    expect(volume(rb!)).toBeCloseTo(1, 9);
  });

  // Caso G-B (decisão 0023 §9.1), com o contorno do piso avançando sobre a parede W1 (núcleo 0,14 m, 2,8 m de altura).
  // Os números são calculados à mão: em cada faixa de cota, quem tem prioridade menor (ou, no empate, o piso) fica.
  it('G-B: piso F1 sobre a parede W1 (contorno avança 0,1 m sobre o eixo); volume por camada', () => {
    const wallLayers = [L('finish2'), L('substrate'), L('structure'), L('substrate'), L('finish2')];
    const wallThick = [0.002, 0.02, 0.14, 0.02, 0.002];
    const wallMetas = layerMetas('wall', wallLayers);
    let y = 0;
    const wallPieces = wallLayers.map((_, i) => {
      const y0 = y;
      y += wallThick[i]!;
      return piece(wallMetas[i]!, rect(0, y0, 2, y), 0, 2.8);
    });
    // Piso: acabamento (z 0,11 a 0,12), substrato (0,09 a 0,11) e estrutura (-0,03 a 0,09); x de 0 a 2, y de 0,1 a 0,5.
    const floorLayers = [L('finish1'), L('substrate'), L('structure')];
    const floorZ = [
      [0.11, 0.12],
      [0.09, 0.11],
      [-0.03, 0.09],
    ] as const;
    const floorMetas = layerMetas('floor', floorLayers);
    const floorPieces = floorLayers.map((_, i) => piece(floorMetas[i]!, rect(0, 0.1, 2, 0.5), floorZ[i]![0], floorZ[i]![1]));
    const res = resolveJunction([...floorPieces, ...wallPieces]);
    // Piso: estrutura (núcleo, 1) inteira; substrato (2) perde a parte do núcleo da parede (1): 0,124 m² de 0,8 m²;
    // acabamento (4) perde o núcleo (1) e o substrato (2) da parede: 0,164 m².
    expect(volume(res[2]!)).toBeCloseTo(0.8 * 0.12, 9);
    expect(volume(res[1]!)).toBeCloseTo((0.8 - 0.124) * 0.02, 9);
    expect(volume(res[0]!)).toBeCloseTo((0.8 - 0.124 - 0.04) * 0.01, 9);
    // Parede (índices 3 a 7, de fora para dentro): o núcleo (1) perde 0,124 m² na faixa de estrutura do piso (0 a 0,09 m);
    // o substrato sob o piso (2) perde a faixa de 0 a 0,11 m; o acabamento sob o piso (5) perde a faixa de 0 a 0,12 m.
    expect(volume(res[3]!)).toBeCloseTo(0.004 * 2.8, 9);
    expect(volume(res[4]!)).toBeCloseTo(0.04 * 2.8, 9);
    expect(volume(res[5]!)).toBeCloseTo(0.28 * 2.8 - 0.124 * 0.09, 9);
    expect(volume(res[6]!)).toBeCloseTo(0.04 * 2.8 - 0.04 * 0.11, 9);
    expect(volume(res[7]!)).toBeCloseTo(0.004 * 2.8 - 0.004 * 0.12, 9);
  });
});

describe('término por prioridade (G-K, decisão 0023 §9.5): sentido de aumentar o número', () => {
  // Acabamento da parede (4), fora do núcleo, encontra o substrato do piso. Região comum: 1 m² em planta e 0,05 m de cota.
  const wallFinish = { kind: 'wall' as const, priority: 4, core: false };
  const region = rect(0, 0, 1, 1);
  const floorSub = (priority: number): PlanarPiece => ({ meta: { kind: 'floor', priority, core: false }, poly: region, z0: 0, z1: 0.05 });
  const wallPiece: PlanarPiece = { meta: wallFinish, poly: region, z0: 0, z1: 0.05 };

  it('G-K1/G-K2: substrato de número 2 (maior prioridade) faz a parede parar; de número 5 a parede atravessa', () => {
    // Número 2 vence o acabamento 4: a parede perde a região comum (o substrato a leva).
    const [w2] = resolveJunction([floorSub(2), wallPiece]).slice(1);
    expect(volume(w2!)).toBeCloseTo(0, 9);
    // Número 5 perde para o acabamento 4: o piso perde a região comum e a parede a mantém.
    const [s5, w5] = resolveJunction([floorSub(5), wallPiece]);
    expect(volume(s5!)).toBeCloseTo(0, 9);
    expect(volume(w5!)).toBeCloseTo(0.05, 9);
  });

  it('no sentido inverso, diminuir o número do acabamento da parede (4 para 1) faz a parede atravessar o substrato', () => {
    const [s, w] = resolveJunction([floorSub(2), { ...wallPiece, meta: { ...wallFinish, priority: 1 } }]);
    expect(volume(s!)).toBeCloseTo(0, 9);
    expect(volume(w!)).toBeCloseTo(0.05, 9);
  });
});

describe('propriedades (10 sementes)', () => {
  const rng = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const kinds: JunctionMeta['kind'][] = ['wall', 'floor', 'slab'];

  for (let seed = 1; seed <= 10; seed++) {
    it(`semente ${seed}: volume resolvido ≤ bruto; par com vencedor não se sobrepõe; sem sobreposição não muda`, () => {
      const r = rng(seed);
      const n = 4 + Math.floor(r() * 4);
      const pieces: PlanarPiece[] = Array.from({ length: n }, () => {
        const x0 = r() * 3;
        const y0 = r() * 3;
        const z0 = r() * 0.5;
        return {
          meta: { kind: kinds[Math.floor(r() * 3)]!, priority: 1 + Math.floor(r() * 5), core: r() < 0.4 },
          poly: rect(x0, y0, x0 + 0.5 + r() * 2, y0 + 0.5 + r() * 2),
          z0,
          z1: z0 + 0.05 + r() * 0.5,
        };
      });
      const res = resolveJunction(pieces);
      const raw = pieces.reduce((s, p) => s + multiArea(p.poly) * (p.z1 - p.z0), 0);
      expect(res.reduce((s, ps) => s + volume(ps), 0)).toBeLessThanOrEqual(raw + 1e-9);
      pieces.forEach((a, i) =>
        pieces.forEach((b, j) => {
          if (i === j || winsOver(b.meta, a.meta) !== true) return;
          for (const pr of res[i]!) {
            if (Math.min(pr.z1, b.z1) - Math.max(pr.z0, b.z0) <= 1e-6) continue;
            // `b` vence `a` nesta faixa: a parte resolvida de `a` não pode sobrepor `b`.
            expect(multiArea(intersection(pr.poly, b.poly))).toBeLessThan(1e-9);
          }
        }),
      );
      const flat = pieces.map((p, k) => ({ ...p, z0: k * 10, z1: k * 10 + 1 }));
      expect(resolveJunction(flat)).toEqual(flat.map((p) => [{ poly: p.poly, z0: p.z0, z1: p.z1 }]));
    });
  }
});
