import { describe, expect, it } from 'vitest';
import { cleanRing, normalizePolygon } from './ifcSolids.ts';
import { prismsShape } from './ifcSolids.ts';
import { StepWriter } from './ifcStep.ts';

const square = (s: number) => [
  { x: 0, y: 0 },
  { x: s, y: 0 },
  { x: s, y: s },
  { x: 0, y: s },
];

describe('ifcSolids', () => {
  it('cleanRing tira vértice repetido e o de fechamento; menos de 3 vértices sai vazio', () => {
    expect(cleanRing([...square(2), { x: 0, y: 0 }])).toHaveLength(4);
    expect(cleanRing([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }])).toEqual([]);
  });

  it('normalizePolygon: contorno anti-horário e furos horários', () => {
    const cw = [...square(2)].reverse();
    const [outer, hole] = normalizePolygon([cw, cw.map((p) => ({ x: p.x / 4 + 0.5, y: p.y / 4 + 0.5 }))]);
    const area = (r: typeof outer) => r!.reduce((s, p, i) => s + p.x * r![(i + 1) % r!.length]!.y - r![(i + 1) % r!.length]!.x * p.y, 0);
    expect(area(outer)).toBeGreaterThan(0);
    expect(area(hole)).toBeLessThan(0);
  });

  it('prisma de cota constante vira extrusão; prisma inclinado vira malha de faces planas', () => {
    const w1 = new StepWriter();
    const flat = prismsShape(w1, 0, [{ polygon: [square(1)], top: { a: 0, b: 0, c: 3 }, bottom: { a: 0, b: 0, c: 0 } }], 0);
    expect(flat).toBeGreaterThan(0);
    expect(w1.text({ fileName: 'a', timestamp: 't' })).toContain("'SweptSolid'");
    const w2 = new StepWriter();
    prismsShape(w2, 0, [{ polygon: [square(1)], top: { a: 0.5, b: 0, c: 3 }, bottom: { a: 0.5, b: 0, c: 2.8 } }], 0);
    const text = w2.text({ fileName: 'a', timestamp: 't' });
    expect(text).toContain("'Brep'");
    // Quatro arestas: topo, fundo e quatro laterais = 6 faces.
    expect(text.match(/=IFCFACE\(/g)).toHaveLength(6);
  });
});
