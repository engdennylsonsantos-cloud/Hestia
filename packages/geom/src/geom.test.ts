import { describe, expect, it } from 'vitest';
import { asMulti, difference, intersection, multiArea, orientedRect, union, v2, intersectLines, triangulate, applyTransform, pointInMulti } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) =>
  asMulti([v2(x0, y0), v2(x1, y0), v2(x1, y1), v2(x0, y1)]);

describe('boolean', () => {
  it('une retângulos que se tocam sem deixar costura', () => {
    const u = union(rect(0, 0, 1, 1), rect(1, 0, 2, 1));
    expect(u).toHaveLength(1);
    expect(multiArea(u)).toBeCloseTo(2, 9);
  });
  it('subtrai e faz furo', () => {
    const d = difference(rect(0, 0, 4, 4), rect(1, 1, 3, 3));
    expect(multiArea(d)).toBeCloseTo(12, 9);
    expect(d[0]).toHaveLength(2);
  });
  it('interseção', () => {
    expect(multiArea(intersection(rect(0, 0, 2, 2), rect(1, 1, 3, 3)))).toBeCloseTo(1, 9);
  });
});

describe('geometria', () => {
  it('retas se cruzam', () => {
    const r = intersectLines(v2(0, 0), v2(1, 0), v2(2, -1), v2(0, 1));
    expect(r?.point.x).toBeCloseTo(2);
    expect(r?.point.y).toBeCloseTo(0);
  });
  it('retângulo orientado tem a área esperada', () => {
    expect(multiArea(asMulti(orientedRect(0, 0, 0.6, 0.8, 2, 0.5)))).toBeCloseTo(4, 9);
  });
  it('triangula com furo', () => {
    const m = difference(rect(0, 0, 4, 4), rect(1, 1, 3, 3));
    const t = triangulate(m[0]!);
    expect(t.indices.length % 3).toBe(0);
    expect(t.indices.length).toBeGreaterThan(0);
  });
  it('espelha em torno de um eixo', () => {
    const p = applyTransform({ kind: 'mirror', a: v2(0, 0), b: v2(0, 1) }, v2(2, 3));
    expect(p.x).toBeCloseTo(-2);
    expect(p.y).toBeCloseTo(3);
  });
  it('ponto dentro de multipolígono', () => {
    expect(pointInMulti(v2(2, 2), rect(0, 0, 4, 4))).toBe(true);
    expect(pointInMulti(v2(5, 2), rect(0, 0, 4, 4))).toBe(false);
  });
});

import { arcFromSagitta, arcLocal, arcPointAt, arcSample, arcTangentAt, offsetArc, sagFromThreePoints } from './index.ts';

describe('arco por flecha', () => {
  const a = v2(0, 0);
  const b = v2(4, 0);
  it('raio, comprimento e centro de um arco de flecha 1 m numa corda de 4 m', () => {
    const arc = arcFromSagitta(a, b, 1)!;
    expect(arc.radius).toBeCloseTo(2.5, 9);
    expect(arc.center.x).toBeCloseTo(2, 9);
    expect(arc.center.y).toBeCloseTo(-1.5, 9);
    expect(arc.length).toBeCloseTo(2.5 * 2 * Math.asin(0.8), 9);
  });
  it('o ponto médio do arco fica a uma flecha da corda, à esquerda quando positiva', () => {
    const arc = arcFromSagitta(a, b, 1)!;
    const m = arcPointAt(arc, arc.length / 2);
    expect(m.x).toBeCloseTo(2, 9);
    expect(m.y).toBeCloseTo(1, 9);
    const m2 = arcPointAt(arcFromSagitta(a, b, -1)!, arcFromSagitta(a, b, -1)!.length / 2);
    expect(m2.y).toBeCloseTo(-1, 9);
  });
  it('extremidades coincidem com a e b', () => {
    for (const sag of [1, -1, 0.3]) {
      const arc = arcFromSagitta(a, b, sag)!;
      const p0 = arcPointAt(arc, 0);
      const p1 = arcPointAt(arc, arc.length);
      expect(p0.x).toBeCloseTo(0, 9);
      expect(p0.y).toBeCloseTo(0, 9);
      expect(p1.x).toBeCloseTo(4, 9);
      expect(p1.y).toBeCloseTo(0, 9);
    }
  });
  it('deslocamento lateral positivo vai para a esquerda do percurso', () => {
    const arc = arcFromSagitta(a, b, 1)!;
    const out = arcPointAt(arc, arc.length / 2, 0.5); // sag>0: esquerda é para fora do centro
    expect(out.y).toBeCloseTo(1.5, 9);
    const arc2 = arcFromSagitta(a, b, -1)!;
    const left = arcPointAt(arc2, arc2.length / 2, 0.5); // sag<0: esquerda é para dentro
    expect(left.y).toBeCloseTo(-0.5, 9);
  });
  it('arcLocal é inverso de arcPointAt', () => {
    for (const sag of [1, -0.7]) {
      const arc = arcFromSagitta(a, b, sag)!;
      for (const t of [0.2, arc.length / 2, arc.length - 0.1]) {
        const p = arcPointAt(arc, t, 0.3);
        const l = arcLocal(arc, p);
        expect(l.t).toBeCloseTo(t, 6);
        expect(l.s).toBeCloseTo(0.3, 6);
      }
    }
  });
  it('tangente é unitária e perpendicular ao raio', () => {
    const arc = arcFromSagitta(a, b, 1)!;
    const t = arcTangentAt(arc, 1);
    const p = arcPointAt(arc, 1);
    expect(Math.hypot(t.x, t.y)).toBeCloseTo(1, 9);
    expect(t.x * (p.x - arc.center.x) + t.y * (p.y - arc.center.y)).toBeCloseTo(0, 9);
  });
  it('amostragem respeita a tolerância de corda', () => {
    const arc = arcFromSagitta(a, b, 1)!;
    const pts = arcSample(arc, 0, arc.length, 0, 0.002);
    for (let i = 0; i + 1 < pts.length; i++) {
      const mid = v2((pts[i]!.x + pts[i + 1]!.x) / 2, (pts[i]!.y + pts[i + 1]!.y) / 2);
      const dev = arc.radius - Math.hypot(mid.x - arc.center.x, mid.y - arc.center.y);
      expect(dev).toBeLessThan(0.0021);
    }
  });
  it('arco concêntrico mantém o centro e muda o raio', () => {
    const o = offsetArc(a, b, 1, 0.5)!; // sag>0: esquerda = fora
    const arc = arcFromSagitta(o.a, o.b, o.sag)!;
    expect(arc.radius).toBeCloseTo(3, 6);
    expect(arc.center.x).toBeCloseTo(2, 6);
    expect(arc.center.y).toBeCloseTo(-1.5, 6);
  });
  it('flecha por três pontos', () => {
    expect(sagFromThreePoints(a, v2(2, 1), b)).toBeCloseTo(1, 6);
    expect(sagFromThreePoints(a, v2(2, -1), b)).toBeCloseTo(-1, 6);
    expect(sagFromThreePoints(a, v2(2, 0), b)).toBe(0);
  });
});
