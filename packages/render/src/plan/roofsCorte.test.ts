import { describe, expect, it } from 'vitest';
import { multiArea, pointInMulti, type Vec2 } from '@hestia/geom';
import { resolveRoofs, type ResolvedRoof } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeRoof } from '@hestia/model';
import { aplicarCorte, cortarTelhado } from './roofsCorte.ts';

const P = (x: number, y: number): Vec2 => ({ x, y });

/** 10 × 8 m, quatro águas a 30 %, beiral a 2,80 m: a cumeeira (4 m do beiral, 2 m do centro curto) sobe a 2,8 + 0,3 × 4 = 4,0 m. */
function telhado(): ResolvedRoof {
  const store = new ProjectStore(createEmptyProject());
  const r = makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: [P(0, 0), P(10, 0), P(10, 8), P(0, 8)], heightOffset: 2.8, shape: 'hip', edgeSlopes: [30, 30, 30, 30] });
  store.exec({ type: 'addRoof', roof: r });
  return resolveRoofs(store.project, 'lv_0')[0]!;
}

const area = (r: ResolvedRoof): number => r.planes.reduce((s, pl) => s + multiArea(pl.polygon), 0);

describe('telhado cortado pelo plano de corte da planta', () => {
  it('corta onde a cota passa do plano: a água fica só com a faixa até 0,6 m / 30 % = 2 m do beiral', () => {
    const r = telhado();
    const c = cortarTelhado(r, 3.4)!;
    // Plano de corte a 3,4 m = 0,6 m acima do beiral = 2 m de distância da aresta (30 %): sobra um anel de 2 m.
    // Retângulo 10 × 8 menos o miolo 6 × 4 (que está acima do plano).
    expect(area(c.roof)).toBeCloseTo(80 - 24, 3);
    expect(pointInMulti(P(5, 4), c.roof.planes.flatMap((pl) => pl.polygon))).toBe(false);
    expect(pointInMulti(P(1, 4), c.roof.planes.flatMap((pl) => pl.polygon))).toBe(true);
    expect(c.corte.length).toBeGreaterThan(0);
  });

  it('a linha de corte fica sobre o retângulo 6 × 4 a 2 m do beiral', () => {
    const c = cortarTelhado(telhado(), 3.4)!;
    for (const [a, b] of c.corte) for (const q of [a, b]) {
      const noRetangulo = (Math.abs(q.x - 2) < 1e-6 || Math.abs(q.x - 8) < 1e-6) && q.y >= 2 - 1e-6 && q.y <= 6 + 1e-6;
      const noRetangulo2 = (Math.abs(q.y - 2) < 1e-6 || Math.abs(q.y - 6) < 1e-6) && q.x >= 2 - 1e-6 && q.x <= 8 + 1e-6;
      expect(noRetangulo || noRetangulo2).toBe(true);
    }
  });

  it('plano acima da cumeeira não corta nada; plano abaixo do beiral não deixa nada', () => {
    const r = telhado();
    expect(area(cortarTelhado(r, 9)!.roof)).toBeCloseTo(area(r), 6);
    expect(cortarTelhado(r, 2.0)).toBeNull();
  });

  it('a cumeeira acima do plano sai; o espigão fica só até o plano', () => {
    const r = telhado();
    const c = cortarTelhado(r, 3.4)!;
    expect(r.lines.some((l) => l.kind === 'ridge')).toBe(true);
    expect(c.roof.lines.some((l) => l.kind === 'ridge')).toBe(false);
    const hip = c.roof.lines.find((l) => l.kind === 'hip')!;
    // O espigão do canto (0,0) sobe 45°: a 2 m do beiral nos dois lados ele está a (2,2), a 0,6 m de altura.
    const longe = [hip.a, hip.b].map((q) => Math.min(q.x, q.y, 10 - q.x, 8 - q.y));
    expect(Math.max(...longe)).toBeLessThanOrEqual(2 + 1e-6);
  });

  it('só os telhados classificados como cut são cortados; a planta de cobertura não corta', () => {
    const r = telhado();
    const mantido = aplicarCorte([r], new Map([['r', 'projection-above']]), 3.4, false);
    expect(mantido.roofs[0]).toBe(r);
    expect(aplicarCorte([r], new Map([['r', 'cut']]), 3.4, true).roofs[0]).toBe(r);
    const cortado = aplicarCorte([r], new Map([['r', 'cut']]), 3.4, false);
    expect(cortado.roofs[0]).not.toBe(r);
    expect(cortado.corte.length).toBeGreaterThan(0);
  });
});
