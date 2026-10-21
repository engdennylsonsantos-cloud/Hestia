import { describe, expect, it } from 'vitest';
import { arcFromSagitta, dist, type Vec2 } from '@hestia/geom';
import type { StairCurve } from '@hestia/model';
import { chainAt, leftSide, nearestPickLine, offsetChain, offsetCurve, type PickLine } from './stairPickLines.ts';

const line = (a: Vec2, b: Vec2): StairCurve => ({ a, b, sag: 0 });
const L = (owner: string, group: string, c: StairCurve): PickLine => ({ owner, group, curve: c });

describe('deslocamento de curvas (stairPickLines)', () => {
  it('reta: paralela ao lado esquerdo do sentido a→b com d > 0, e à direita com d < 0', () => {
    const left = offsetCurve(line({ x: 0, y: 0 }, { x: 4, y: 0 }), 0.3)!;
    expect(left.a.y).toBeCloseTo(0.3, 12);
    expect(left.b.y).toBeCloseTo(0.3, 12);
    const right = offsetCurve(line({ x: 0, y: 0 }, { x: 4, y: 0 }), -0.3)!;
    expect(right.a.y).toBeCloseTo(-0.3, 12);
  });

  it('arco (sag 1, corda 4): raio 2,5 → 2,8 para d = +0,3 (para fora), com o sag novo e o mesmo ângulo central', () => {
    const arc = offsetCurve({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, sag: 1 }, 0.3)!;
    const before = arcFromSagitta({ x: 0, y: 0 }, { x: 4, y: 0 }, 1)!;
    const after = arcFromSagitta(arc.a, arc.b, arc.sag)!;
    expect(before.radius).toBeCloseTo(2.5, 12);
    expect(after.radius).toBeCloseTo(2.8, 9);
    expect(arc.sag).toBeCloseTo(1.12, 9);
    expect(after.sweep).toBeCloseTo(before.sweep, 9);
  });

  it('arco que abaula para a direita (sag −1): d = +0,3 à esquerda vai para dentro (raio 2,2)', () => {
    const arc = offsetCurve({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, sag: -1 }, 0.3)!;
    expect(arcFromSagitta(arc.a, arc.b, arc.sag)!.radius).toBeCloseTo(2.2, 9);
    expect(arc.sag).toBeCloseTo(-0.88, 9);
  });

  it('arco que deixaria de existir (raio ≤ 0) não é deslocado: null', () => {
    expect(offsetCurve({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, sag: 1 }, -2.6)).toBeNull();
  });

  it('lado do cursor: à esquerda do sentido a→b ou para fora do arco que abaula à esquerda', () => {
    const straight = line({ x: 0, y: 0 }, { x: 4, y: 0 });
    expect(leftSide(straight, { x: 2, y: 1 })).toBe(1);
    expect(leftSide(straight, { x: 2, y: -1 })).toBe(-1);
    const arc: StairCurve = { a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, sag: 1 };
    expect(leftSide(arc, { x: 2, y: 2 })).toBe(1); // fora do arco
    expect(leftSide(arc, { x: 2, y: 0.5 })).toBe(-1); // dentro do círculo
  });

  it('cadeia deslocada: a junta de duas retas é o cruzamento dos offsets, e as duas curvas compartilham o mesmo ponto', () => {
    const out = offsetChain([line({ x: 0, y: 0 }, { x: 4, y: 0 }), line({ x: 4, y: 0 }, { x: 4, y: 4 })], 0.3, false)!;
    expect(out[0]!.b.x).toBeCloseTo(3.7, 12);
    expect(out[0]!.b.y).toBeCloseTo(0.3, 12);
    expect(out[1]!.a).toEqual(out[0]!.b);
  });
});

describe('corrente (stairPickLines)', () => {
  it('percorre a cadeia nos dois sentidos a partir da linha pega, orientando cada curva no sentido do percurso', () => {
    const lines = [
      L('w1', 'g', line({ x: 0, y: 0 }, { x: 4, y: 0 })),
      L('w2', 'g', line({ x: 8, y: 0 }, { x: 4, y: 0 })), // escrita ao contrário
      L('w3', 'g', line({ x: 8, y: 0 }, { x: 12, y: 0 })),
      L('other', 'h', line({ x: 12, y: 0 }, { x: 12, y: 5 })), // outro grupo: não entra
    ];
    const r = chainAt(lines, 1);
    expect(r.closed).toBe(false);
    // A linha pega (8→4) mantém o sentido dela; as vizinhas saem no sentido que a cadeia tem a partir dela.
    expect(r.curves.map((c) => [c.a.x, c.b.x])).toEqual([
      [12, 8],
      [8, 4],
      [4, 0],
    ]);
    for (let i = 1; i < r.curves.length; i++) expect(dist(r.curves[i - 1]!.b, r.curves[i]!.a)).toBeLessThan(1e-12);
  });

  it('um laço fechado é reconhecido e a junta de fechamento sai contínua', () => {
    const sq = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    const lines = sq.map((p, i) => L('slab', 'slab:s:0', line(p, sq[(i + 1) % 4]!)));
    const r = chainAt(lines, 2);
    expect(r.closed).toBe(true);
    expect(r.curves).toHaveLength(4);
    const out = offsetChain(r.curves, 0.1, true)!;
    for (let i = 0; i < 4; i++) expect(dist(out[i]!.b, out[(i + 1) % 4]!.a)).toBeLessThan(1e-9);
  });

  it('um vão maior que a tolerância de junta quebra a corrente', () => {
    const lines = [L('w1', 'g', line({ x: 0, y: 0 }, { x: 4, y: 0 })), L('w2', 'g', line({ x: 4.1, y: 0 }, { x: 8, y: 0 }))];
    expect(chainAt(lines, 0).curves).toHaveLength(1);
  });

  it('nearestPickLine: a mais próxima dentro da tolerância; fora dela, −1', () => {
    const lines = [L('w1', 'g', line({ x: 0, y: 0 }, { x: 4, y: 0 })), L('w2', 'g', line({ x: 0, y: 1 }, { x: 4, y: 1 }))];
    expect(nearestPickLine(lines, { x: 2, y: 0.9 }, 0.2)).toBe(1);
    expect(nearestPickLine(lines, { x: 2, y: 0.5 }, 0.2)).toBe(-1);
  });
});
