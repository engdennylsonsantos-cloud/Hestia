import { describe, expect, it } from 'vitest';
import { arcFromSagitta, arcPointAt, arcSample, arcTangentAt, dist, ringArea, type SketchSeg, type Vec2 } from '@hestia/geom';
import {
  SHAPE_KINDS,
  arcCenterEnds,
  arcThreePoints,
  arcTangent,
  circleShape,
  circumscribedPolygon,
  ellipseShape,
  filletShape,
  inscribedPolygon,
  lineShape,
  rectangleShape,
  rotatedRectangleShape,
} from './sketchShapes.ts';

const counter = () => {
  let n = 0;
  return () => `s${++n}`;
};

const near = (p: Vec2, q: Vec2, tol = 1e-9) => expect(dist(p, q)).toBeLessThan(tol);

/** Cadeia aberta: cada ponta é o início do próximo. */
function expectChained(segs: SketchSeg[]) {
  for (let i = 0; i + 1 < segs.length; i++) near(segs[i]!.b, segs[i + 1]!.a);
}

/** Laço fechado: cadeia + a última ponta volta ao início do primeiro. */
function expectClosed(segs: SketchSeg[]) {
  expectChained(segs);
  near(segs[segs.length - 1]!.b, segs[0]!.a);
}

/** Área (valor absoluto) do polígono formado pelas pontas, na ordem das linhas. */
const areaOf = (segs: SketchSeg[]) => Math.abs(ringArea(segs.map((s) => s.a)));

const arcOf = (s: SketchSeg) => arcFromSagitta(s.a, s.b, s.sag ?? 0)!;

describe('lineShape', () => {
  it('gera uma reta entre os pontos, com id injetado', () => {
    const segs = lineShape({ x: 0, y: 0 }, { x: 3, y: 4 }, counter());
    expect(segs).toEqual([{ id: 's1', a: { x: 0, y: 0 }, b: { x: 3, y: 4 } }]);
  });

  it('ponto coincidente não forma linha', () => {
    expect(lineShape({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
});

describe('rectangleShape', () => {
  it('quatro lados fechados a partir de cantos opostos, área = largura × altura', () => {
    const segs = rectangleShape({ x: 4, y: 3 }, { x: 1, y: 0 }, counter());
    expect(segs).toHaveLength(4);
    expectClosed(segs);
    expect(areaOf(segs)).toBeCloseTo(3 * 3, 9);
    const corners = segs.map((s) => s.a);
    for (const c of [{ x: 1, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 1, y: 3 }]) {
      expect(corners.some((p) => dist(p, c) < 1e-9)).toBe(true);
    }
  });

  it('retângulo degenerado (largura zero) é vazio', () => {
    expect(rectangleShape({ x: 0, y: 0 }, { x: 0, y: 5 })).toEqual([]);
  });
});

describe('rotatedRectangleShape', () => {
  it('base horizontal com largura 2 para cima', () => {
    const segs = rotatedRectangleShape({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 2 }, counter());
    expect(segs).toHaveLength(4);
    expectClosed(segs);
    expect(areaOf(segs)).toBeCloseTo(8, 9);
    expect(segs.some((s) => dist(s.a, { x: 0, y: 2 }) < 1e-9 || dist(s.b, { x: 0, y: 2 }) < 1e-9)).toBe(true);
  });

  it('base vertical; o ponto da largura pode estar do outro lado', () => {
    // u = (0,1); perp = (-1,0); a largura 2 fica para x < 1 (lado esquerdo).
    const segs = rotatedRectangleShape({ x: 1, y: 1 }, { x: 1, y: 5 }, { x: -1, y: 3 });
    expect(areaOf(segs)).toBeCloseTo(8, 9);
    expectClosed(segs);
    expect(Math.min(...segs.flatMap((s) => [s.a.x, s.b.x]))).toBeCloseTo(-1, 9);
  });

  it('largura nula ou base nula é vazia', () => {
    expect(rotatedRectangleShape({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 })).toEqual([]);
    expect(rotatedRectangleShape({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 1 })).toEqual([]);
  });
});

describe('inscribedPolygon', () => {
  it('hexágono inscrito: vértices no raio, primeiro vértice em `vertex`, área = 3√3/2 · R²', () => {
    const c = { x: 1, y: 1 };
    const segs = inscribedPolygon(c, { x: 3, y: 1 }, 6, counter());
    expect(segs).toHaveLength(6);
    expectClosed(segs);
    for (const s of segs) expect(dist(s.a, c)).toBeCloseTo(2, 9);
    near(segs[0]!.a, { x: 3, y: 1 });
    expect(areaOf(segs)).toBeCloseTo((3 * Math.sqrt(3)) / 2 * 4, 9);
  });

  it('quadrado inscrito tem diagonal = 2R', () => {
    const segs = inscribedPolygon({ x: 0, y: 0 }, { x: 0, y: 2 }, 4);
    expect(areaOf(segs)).toBeCloseTo(8, 9);
  });

  it('lados inválidos (menos de 3, não inteiros) ou raio nulo são vazios', () => {
    expect(inscribedPolygon({ x: 0, y: 0 }, { x: 1, y: 0 }, 2)).toEqual([]);
    expect(inscribedPolygon({ x: 0, y: 0 }, { x: 1, y: 0 }, 4.5)).toEqual([]);
    expect(inscribedPolygon({ x: 0, y: 0 }, { x: 0, y: 0 }, 5)).toEqual([]);
  });
});

describe('circumscribedPolygon', () => {
  it('quadrado circunscrito a apótema 2: lado 4, área 16, ponto médio da aresta em edgeMid', () => {
    const segs = circumscribedPolygon({ x: 0, y: 0 }, { x: 2, y: 0 }, 4, counter());
    expect(segs).toHaveLength(4);
    expectClosed(segs);
    expect(areaOf(segs)).toBeCloseTo(16, 9);
    const mids = segs.map((s) => ({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }));
    expect(mids.some((m) => dist(m, { x: 2, y: 0 }) < 1e-9)).toBe(true);
  });

  it('hexágono circunscrito: toda aresta tangencia o círculo de apótema a (área 2√3·a²)', () => {
    const c = { x: 0, y: 0 };
    const a = 2;
    const segs = circumscribedPolygon(c, { x: 0, y: -a }, 6);
    expect(areaOf(segs)).toBeCloseTo(2 * Math.sqrt(3) * a * a, 9);
    for (const s of segs) {
      // Distância do centro à reta da aresta = apótema.
      const d = s.b.x - s.a.x;
      const e = s.b.y - s.a.y;
      const dLine = Math.abs(d * (s.a.y - c.y) - e * (s.a.x - c.x)) / Math.hypot(d, e);
      expect(dLine).toBeCloseTo(a, 9);
    }
  });

  it('mesmo círculo (raio 1): área circunscrita > inscrita, com o mesmo número de lados', () => {
    const inn = inscribedPolygon({ x: 0, y: 0 }, { x: 1, y: 0 }, 5);
    const out = circumscribedPolygon({ x: 0, y: 0 }, { x: 1, y: 0 }, 5);
    expect(areaOf(out)).toBeGreaterThan(areaOf(inn));
  });

  it('apótema nulo ou lados inválidos são vazios', () => {
    expect(circumscribedPolygon({ x: 0, y: 0 }, { x: 0, y: 0 }, 6)).toEqual([]);
    expect(circumscribedPolygon({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)).toEqual([]);
  });
});

describe('circleShape', () => {
  it('dois arcos de 180° com raio e centro corretos, fechando a circunferência', () => {
    const c = { x: 2, y: 3 };
    const segs = circleShape(c, { x: 2, y: 5 }, counter());
    expect(segs).toHaveLength(2);
    expectClosed(segs);
    let total = 0;
    for (const s of segs) {
      const arc = arcOf(s);
      expect(arc.radius).toBeCloseTo(2, 9);
      near(arc.center, c, 1e-9);
      expect(arc.length).toBeCloseTo(Math.PI * 2, 9);
      total += arc.length;
    }
    expect(total).toBeCloseTo(4 * Math.PI, 9);
    // Os dois arcos ficam em lados opostos da corda: os pontos médios são antípodas.
    const m1 = arcPointAt(arcOf(segs[0]!), arcOf(segs[0]!).length / 2);
    const m2 = arcPointAt(arcOf(segs[1]!), arcOf(segs[1]!).length / 2);
    near(m1, { x: c.x * 2 - m2.x, y: c.y * 2 - m2.y }, 1e-9);
  });

  it('raio nulo é vazio', () => {
    expect(circleShape({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([]);
  });
});

describe('arcThreePoints', () => {
  it('semicírculo: arco único com o ponto do meio sobre o arco', () => {
    const segs = arcThreePoints({ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, counter());
    expect(segs).toHaveLength(1);
    const arc = arcOf(segs[0]!);
    expect(arc.radius).toBeCloseTo(1, 9);
    near(arc.center, { x: 0, y: 0 }, 1e-9);
    near(arcPointAt(arc, arc.length / 2), { x: 0, y: 1 }, 1e-9);
  });

  it('arco maior que 180° é dividido em dois e passa pelo ponto dado', () => {
    // Início (1,0), fim (0,1) e ponto (−1,0): o caminho pelo ponto dá 270°.
    const segs = arcThreePoints({ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 });
    expect(segs).toHaveLength(2);
    expectChained(segs);
    near(segs[0]!.a, { x: 1, y: 0 });
    near(segs[1]!.b, { x: 0, y: 1 });
    const total = segs.reduce((s, g) => s + arcOf(g).length, 0);
    expect(total).toBeCloseTo(1.5 * Math.PI, 9);
    const pts = segs.flatMap((g) => arcSample(arcOf(g), 0, arcOf(g).length, 0, 1e-5));
    expect(Math.min(...pts.map((p) => dist(p, { x: -1, y: 0 })))).toBeLessThan(1e-4);
  });

  it('pontos alinhados: reta se o meio estiver entre as pontas; senão vazio', () => {
    expect(arcThreePoints({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 })).toHaveLength(1);
    expect(arcThreePoints({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 })).toEqual([]);
  });
});

describe('arcCenterEnds', () => {
  it('quarto de círculo anti-horário com meio em 45°', () => {
    const segs = arcCenterEnds({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, true, counter());
    expect(segs).toHaveLength(1);
    const arc = arcOf(segs[0]!);
    expect(arc.length).toBeCloseTo(Math.PI / 2, 9);
    near(arcPointAt(arc, arc.length / 2), { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 1e-9);
  });

  it('o mesmo par no sentido horário dá 270° (dois arcos)', () => {
    const segs = arcCenterEnds({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, false);
    expect(segs).toHaveLength(2);
    expectChained(segs);
    const total = segs.reduce((s, g) => s + arcOf(g).length, 0);
    expect(total).toBeCloseTo(1.5 * Math.PI, 9);
    near(segs[0]!.a, { x: 1, y: 0 });
    near(segs[1]!.b, { x: 0, y: 1 });
  });

  it('início no centro ou pontos coincidentes são vazios', () => {
    expect(arcCenterEnds({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, true)).toEqual([]);
    expect(arcCenterEnds({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }, true)).toEqual([]);
  });
});

describe('arcTangent', () => {
  it('sai na direção dada e chega em `end`: centro (0,2), raio 2, quarto de arco', () => {
    const segs = arcTangent({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 2 }, counter());
    expect(segs).toHaveLength(1);
    const arc = arcOf(segs[0]!);
    expect(arc.radius).toBeCloseTo(2, 9);
    near(arc.center, { x: 0, y: 2 }, 1e-9);
    expect(arc.length).toBeCloseTo(Math.PI, 9);
    const t0 = arcTangentAt(arc, 0);
    near(t0, { x: 1, y: 0 }, 1e-9);
  });

  it('continuidade G1 em casos gerais (tangente do primeiro arco = direção dada)', () => {
    const cases: Array<[Vec2, Vec2, Vec2]> = [
      [{ x: 5, y: 5 }, { x: 0, y: 1 }, { x: 7, y: 7 }],
      [{ x: -1, y: 2 }, { x: 1, y: -1 }, { x: 3, y: 0 }],
      [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 3 }],
    ];
    for (const [s, dir, e] of cases) {
      const segs = arcTangent(s, dir, e);
      expect(segs.length).toBeGreaterThan(0);
      expectChained(segs);
      near(segs[0]!.a, s);
      near(segs[segs.length - 1]!.b, e);
      const u = { x: dir.x / Math.hypot(dir.x, dir.y), y: dir.y / Math.hypot(dir.x, dir.y) };
      const t0 = arcTangentAt(arcOf(segs[0]!), 0);
      near(t0, u, 1e-9);
    }
  });

  it('end sobre a própria tangente vira reta; atrás do início é vazio', () => {
    expect(arcTangent({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 })).toEqual([{ id: expect.any(String), a: { x: 0, y: 0 }, b: { x: 3, y: 0 } }]);
    expect(arcTangent({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 })).toEqual([]);
  });

  it('direção nula ou fim coincidente é vazio', () => {
    expect(arcTangent({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([]);
    expect(arcTangent({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 })).toEqual([]);
  });
});

describe('filletShape', () => {
  it('canto reto na origem, raio 1: linhas aparadas em (1,0) e (0,1), arco de centro (1,1)', () => {
    const A: SketchSeg = { id: 'A', a: { x: 4, y: 0 }, b: { x: 0, y: 0 } };
    const B: SketchSeg = { id: 'B', a: { x: 0, y: 0 }, b: { x: 0, y: 4 } };
    const r = filletShape(A, B, 1, counter());
    expect(r).not.toBeNull();
    const { a, b, arc } = r!;
    expect(a.id).toBe('A');
    expect(b.id).toBe('B');
    near(a.a, { x: 4, y: 0 });
    near(a.b, { x: 1, y: 0 });
    near(b.a, { x: 0, y: 1 });
    near(b.b, { x: 0, y: 4 });
    const g = arcOf(arc);
    expect(g.radius).toBeCloseTo(1, 9);
    near(g.center, { x: 1, y: 1 }, 1e-9);
    near(arcPointAt(g, g.length / 2), { x: 1 - Math.SQRT1_2, y: 1 - Math.SQRT1_2 }, 1e-9);
  });

  it('canto de 120°: centro a distância r das duas retas e pontos de tangência perpendiculares', () => {
    const A: SketchSeg = { id: 'A', a: { x: 3, y: 0 }, b: { x: 0, y: 0 } };
    const B: SketchSeg = { id: 'B', a: { x: 0, y: 0 }, b: { x: -1.5, y: 3 * Math.sin((2 * Math.PI) / 3) } };
    const r = filletShape(A, B, 0.5);
    expect(r).not.toBeNull();
    const g = arcOf(r!.arc);
    expect(g.radius).toBeCloseTo(0.5, 9);
    // Distância à reta A (eixo x) e à reta B.
    expect(Math.abs(g.center.y)).toBeCloseTo(0.5, 9);
    const ub = { x: -1.5, y: 3 * Math.sin((2 * Math.PI) / 3) };
    const dB = Math.abs(ub.x * g.center.y - ub.y * g.center.x) / Math.hypot(ub.x, ub.y);
    expect(dB).toBeCloseTo(0.5, 9);
    // Tangência em A (eixo x): o ponto de tangência é a projeção do centro sobre a reta.
    near(r!.arc.a, { x: g.center.x, y: 0 }, 1e-9);
  });

  it('linha dentro do canto (ponto P no meio de uma linha) é null', () => {
    const A: SketchSeg = { id: 'A', a: { x: -2, y: 0 }, b: { x: 2, y: 0 } };
    const B: SketchSeg = { id: 'B', a: { x: 0, y: 0 }, b: { x: 0, y: 2 } };
    expect(filletShape(A, B, 0.5)).toBeNull();
  });

  it('paralelas, raio nulo, arco como entrada ou linha curta demais: null', () => {
    const A: SketchSeg = { id: 'A', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } };
    const P: SketchSeg = { id: 'P', a: { x: 0, y: 1 }, b: { x: 4, y: 1 } };
    const B: SketchSeg = { id: 'B', a: { x: 0, y: 0 }, b: { x: 0, y: 4 } };
    const short: SketchSeg = { id: 'S', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } };
    expect(filletShape(A, P, 0.5)).toBeNull();
    expect(filletShape(A, B, 0)).toBeNull();
    expect(filletShape(A, { ...B, sag: 1 }, 0.5)).toBeNull();
    expect(filletShape({ id: 'S', a: { x: 1, y: 0 }, b: { x: 0, y: 0 } }, B, 5)).toBeNull();
    expect(filletShape(short, B, 2)).toBeNull();
  });

  it('preserva as propriedades de telhado da linha aparada', () => {
    const A: SketchSeg = { id: 'A', a: { x: 4, y: 0 }, b: { x: 0, y: 0 }, slopePct: 25, overhang: 0.3, definesSlope: true };
    const B: SketchSeg = { id: 'B', a: { x: 0, y: 0 }, b: { x: 0, y: 4 } };
    const r = filletShape(A, B, 1);
    expect(r!.a).toMatchObject({ id: 'A', slopePct: 25, overhang: 0.3, definesSlope: true });
  });
});

describe('ellipseShape', () => {
  it('vértices sobre a elipse e área próxima de πab (erro < 0,1%)', () => {
    const segs = ellipseShape({ x: 0, y: 0 }, 2, 1, 0, counter());
    expect(segs.length % 4).toBe(0);
    expect(segs.length).toBeGreaterThanOrEqual(8);
    expectClosed(segs);
    for (const s of segs) expect((s.a.x / 2) ** 2 + s.a.y ** 2).toBeCloseTo(1, 9);
    expect(areaOf(segs)).toBeCloseTo(Math.PI * 2, 2);
    expect(Math.abs(areaOf(segs) - Math.PI * 2) / (Math.PI * 2)).toBeLessThan(1e-3);
  });

  it('erro de corda: ponto médio de cada linha fica dentro da elipse a no máximo 2 mm', () => {
    const a = 2;
    const b = 1;
    const segs = ellipseShape({ x: 0, y: 0 }, a, b);
    let worst = 0;
    for (const s of segs) {
      const m = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
      // Distância radial aproximada à elipse: |f| / |∇f| com f = (x/a)² + (y/b)² − 1.
      const f = (m.x / a) ** 2 + (m.y / b) ** 2 - 1;
      const g = Math.hypot((2 * m.x) / a ** 2, (2 * m.y) / b ** 2);
      worst = Math.max(worst, Math.abs(f) / g);
    }
    expect(worst).toBeLessThanOrEqual(0.002 + 1e-6);
  });

  it('rotação de π/2 troca os eixos', () => {
    const segs = ellipseShape({ x: 1, y: 1 }, 2, 1, Math.PI / 2);
    for (const s of segs) {
      const x = s.a.x - 1;
      const y = s.a.y - 1;
      expect(x * x + (y / 2) ** 2).toBeCloseTo(1, 9);
    }
  });

  it('rx = ry vira círculo de dois arcos', () => {
    const segs = ellipseShape({ x: 0, y: 0 }, 3, 3);
    expect(segs).toHaveLength(2);
    expect(segs.every((s) => s.sag !== undefined)).toBe(true);
    expect(arcOf(segs[0]!).radius).toBeCloseTo(3, 9);
  });

  it('semieixo nulo é vazio', () => {
    expect(ellipseShape({ x: 0, y: 0 }, 2, 0)).toEqual([]);
  });
});

describe('SHAPE_KINDS', () => {
  it('cobre todas as formas, com ids e rótulos únicos e entradas nomeadas', () => {
    const ids = SHAPE_KINDS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(['line', 'rectangle', 'rotatedRectangle', 'inscribedPolygon', 'circumscribedPolygon', 'circle', 'arcThreePoints', 'arcCenterEnds', 'arcTangent', 'fillet', 'ellipse']),
    );
    for (const k of SHAPE_KINDS) {
      expect(k.label.length).toBeGreaterThan(0);
      const keys = k.inputs.map((i) => i.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('ids padrão', () => {
  it('ids gerados sem injeção são únicos entre formas', () => {
    const all = [
      ...rectangleShape({ x: 0, y: 0 }, { x: 1, y: 1 }),
      ...circleShape({ x: 0, y: 0 }, { x: 1, y: 0 }),
      ...ellipseShape({ x: 0, y: 0 }, 2, 1),
    ];
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
  });
});
