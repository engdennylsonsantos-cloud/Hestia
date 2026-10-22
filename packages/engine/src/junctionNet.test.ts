import { describe, expect, it } from 'vitest';
import { multiArea, type MultiPolygon } from '@hestia/geom';
import { cutVolume, coveredFaceArea, flatPiece, overlapVolume, type CutterSolid, type SolidPiece } from './junctionNet.ts';

const sq = (x0: number, y0: number, x1: number, y1: number): MultiPolygon => [[[
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]]];

describe('volume de interseção entre pedaços', () => {
  it('faixas constantes: área da interseção vezes a sobreposição de cota', () => {
    const a = flatPiece(sq(0, 0, 4, 3), 0, 1);
    const b = flatPiece(sq(2, 1, 6, 5), 0.5, 2);
    // Interseção 2 × 2 = 4 m² por 0,5 m de cota em comum.
    expect(overlapVolume(a, b)).toBeCloseTo(2, 9);
  });

  it('sem sobreposição em planta ou em cota, volume zero', () => {
    const a = flatPiece(sq(0, 0, 1, 1), 0, 1);
    expect(overlapVolume(a, flatPiece(sq(5, 5, 6, 6), 0, 1))).toBe(0);
    expect(overlapVolume(a, flatPiece(sq(0, 0, 1, 1), 1, 2))).toBe(0);
  });

  it('faixa inclinada: integra a sobreposição que varia em x (afim em cada triângulo, exato)', () => {
    // Base da faixa inclinada em 0,5 e topo em 0,5 + 0,2 x; a outra faixa vai de 0 a 1. Sobreposição = 0,2 x em [0; 2].
    const flat = flatPiece(sq(0, 0, 2, 1), 0, 1);
    const sloped: SolidPiece = { poly: sq(0, 0, 2, 1), span: (p) => [0.5, 0.5 + 0.2 * p.x], flat: false };
    expect(overlapVolume(flat, sloped)).toBeCloseTo(0.4, 9);
    expect(overlapVolume(sloped, flat)).toBeCloseTo(0.4, 9);
  });

  it('cutVolume: um tipo só perde volume para os elementos que o cortam pelo padrão', () => {
    const piece = flatPiece(sq(0, 0, 2, 2), 0, 1);
    const slab: CutterSolid = { kind: 'slab', pieces: [flatPiece(sq(1, 0, 3, 2), 0.5, 1)] };
    const floor: CutterSolid = { kind: 'floor', pieces: [flatPiece(sq(1, 0, 3, 2), 0.5, 1)] };
    // Laje e piso cortam parede: a parede (kind wall) perde a interseção de cada um.
    expect(cutVolume(piece, 'wall', [slab])).toBeCloseTo(1, 9);
    expect(cutVolume(piece, 'wall', [slab, floor])).toBeCloseTo(2, 9);
    // Piso é cortado pela laje, mas não pelo piso nem pela parede.
    expect(cutVolume(piece, 'floor', [floor])).toBe(0);
    expect(cutVolume(piece, 'floor', [slab])).toBeCloseTo(1, 9);
    // A laje não é cortada por nenhum elemento.
    expect(cutVolume(piece, 'slab', [slab, floor])).toBe(0);
  });

  it('face de espessura zero (membrana) só some dentro da faixa do cortador', () => {
    const face = flatPiece(sq(0, 0, 2, 2), 0.5, 0.5);
    const inside: CutterSolid = { kind: 'slab', pieces: [flatPiece(sq(0, 0, 1, 2), 0.2, 0.6)] };
    const outside: CutterSolid = { kind: 'slab', pieces: [flatPiece(sq(0, 0, 2, 2), 0.6, 0.9)] };
    expect(coveredFaceArea(face, 'floor', [inside])).toBeCloseTo(2, 9);
    expect(coveredFaceArea(face, 'floor', [outside])).toBe(0);
    expect(coveredFaceArea(face, 'wall', [inside])).toBeCloseTo(2, 9);
    expect(coveredFaceArea(face, 'slab', [inside])).toBe(0);
    expect(multiArea(sq(0, 0, 2, 2))).toBe(4);
  });
});

describe('corte por prioridade de camada (0023 §1, P7)', () => {
  const withMeta = (poly: MultiPolygon, z0: number, z1: number, meta: SolidPiece['meta']): SolidPiece => ({ ...flatPiece(poly, z0, z1), meta });

  it('com atributos, a camada de prioridade menor corta a de número maior; a de número maior não corta a outra', () => {
    const core = withMeta(sq(0, 0, 2, 2), 0, 1, { kind: 'wall', priority: 1, core: true, owner: 'w1' });
    const acab = withMeta(sq(0, 0, 2, 2), 0, 1, { kind: 'floor', priority: 4, core: false, owner: 'f1' });
    const cutters: CutterSolid[] = [{ kind: 'wall', pieces: [core] }];
    expect(cutVolume(acab, 'floor', cutters)).toBeCloseTo(4, 9);
    expect(cutVolume(core, 'wall', [{ kind: 'floor', pieces: [acab] }])).toBe(0);
  });

  it('a camada não corta as outras camadas do próprio elemento', () => {
    const own1 = withMeta(sq(0, 0, 2, 2), 0, 1, { kind: 'floor', priority: 1, core: true, owner: 'f1' });
    const own2 = withMeta(sq(0, 0, 2, 2), 0, 1, { kind: 'floor', priority: 4, core: false, owner: 'f1' });
    expect(cutVolume(own2, 'floor', [{ kind: 'floor', pieces: [own1] }])).toBe(0);
  });

  it('empate de prioridade: a laje corta o piso, e a camada de mesmo tipo e prioridade não corta', () => {
    const floor = withMeta(sq(0, 0, 2, 2), 0, 1, { kind: 'floor', priority: 3, core: false, owner: 'f1' });
    const slab = withMeta(sq(0, 0, 2, 2), 0, 1, { kind: 'slab', priority: 3, core: false, owner: 's1' });
    const other = withMeta(sq(0, 0, 2, 2), 0, 1, { kind: 'floor', priority: 3, core: false, owner: 'f2' });
    expect(cutVolume(floor, 'floor', [{ kind: 'slab', pieces: [slab] }])).toBeCloseTo(4, 9);
    expect(cutVolume(floor, 'floor', [{ kind: 'floor', pieces: [other] }])).toBe(0);
  });
});

