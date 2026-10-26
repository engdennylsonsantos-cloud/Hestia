import { describe, expect, it } from 'vitest';
import { validateSketch, v2, type SketchDraft, type SketchSeg, type Vec2 } from '@hestia/geom';
import { newDraft } from './perimeterSession.ts';
import {
  alignSegToLine,
  arraySegs,
  copySegs,
  deleteSegs,
  extendToBoundary,
  joinLoose,
  mirrorSegs,
  offsetLoop,
  offsetSegs,
  rotateSegs,
  snapEndsToCorners,
  splitAt,
  splitBetween,
  trimExtendToCorner,
  trimToBoundary,
} from './perimeterModify.ts';

const P = (x: number, y: number): Vec2 => v2(x, y);

/** Rascunho de telhado com as linhas dadas (defaults do programa). */
function draftOf(segs: SketchSeg[]): SketchDraft {
  return { ...newDraft('roof'), segs };
}

const line = (id: string, a: Vec2, b: Vec2, extra: Partial<SketchSeg> = {}): SketchSeg => ({ id, a, b, ...extra });

const byId = (d: SketchDraft, id: string): SketchSeg => {
  const s = d.segs.find((x) => x.id === id);
  if (!s) throw new Error(`sem linha ${id}`);
  return s;
};

const near = (p: Vec2, q: Vec2, tol = 1e-6): boolean => Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;

/** Retângulo com as quatro linhas dadas, cada uma com as pontas nos cantos (ou sobras para aparar). */
function rectSegs(W: number, H: number, over: number): SketchSeg[] {
  return [
    line('s1', P(-over, 0), P(W + over, 0)),
    line('s2', P(W, -over), P(W, H + over)),
    line('s3', P(W + over, H), P(-over, H)),
    line('s4', P(0, H + over), P(0, -over)),
  ];
}

/** Quatro cantos de um retângulo W×H (s1 inferior, s2 direita, s3 superior, s4 esquerda), um clique por linha. */
function squareCorners(d: SketchDraft, W: number, H: number): SketchDraft | null {
  const ops: Array<(dd: SketchDraft) => SketchDraft | null> = [
    (dd) => trimExtendToCorner(dd, 's1', P(W / 2, 0), 's4', P(0, H / 2)),
    (dd) => trimExtendToCorner(dd, 's1', P(W / 2, 0), 's2', P(W, H / 2)),
    (dd) => trimExtendToCorner(dd, 's2', P(W, H / 2), 's3', P(W / 2, H)),
    (dd) => trimExtendToCorner(dd, 's3', P(W / 2, H), 's4', P(0, H / 2)),
  ];
  let cur: SketchDraft | null = d;
  for (const op of ops) cur = cur && op(cur);
  return cur;
}

describe('trimExtendToCorner', () => {
  it('apara as quatro linhas que passam dos cantos e o rascunho continua válido', () => {
    const d = draftOf(rectSegs(5, 3, 0.3));
    const r = squareCorners(d, 5, 3);
    expect(r).not.toBeNull();
    const res = validateSketch(r!.segs);
    expect(res.ok).toBe(true);
    expect(res.loops).toHaveLength(1);
    expect(res.loops[0]!.role).toBe('outer');
    const corners = [P(0, 0), P(5, 0), P(5, 3), P(0, 3)];
    for (const c of corners) expect(res.loops[0]!.ring.some((q) => near(q, c))).toBe(true);
  });

  it('estende as quatro linhas que ficaram curtas e o rascunho continua válido', () => {
    const shortRect = [
      line('s1', P(0.3, 0), P(4.7, 0)),
      line('s2', P(5, 0.3), P(5, 2.7)),
      line('s3', P(4.7, 3), P(0.3, 3)),
      line('s4', P(0, 2.7), P(0, 0.3)),
    ];
    const r = squareCorners(draftOf(shortRect), 5, 3);
    expect(r).not.toBeNull();
    expect(validateSketch(r!.segs).ok).toBe(true);
    expect(near(byId(r!, 's1').a, P(0, 0))).toBe(true);
    expect(near(byId(r!, 's1').b, P(5, 0))).toBe(true);
  });

  it('aceita um retângulo misto (uns passam, outros ficam curtos)', () => {
    const mixed = [
      line('s1', P(-0.3, 0), P(4.6, 0)),
      line('s2', P(5, -0.3), P(5, 2.8)),
      line('s3', P(5.4, 3), P(0.2, 3)),
      line('s4', P(0, 3.3), P(0, 0.4)),
    ];
    const r = squareCorners(draftOf(mixed), 5, 3);
    expect(r).not.toBeNull();
    expect(validateSketch(r!.segs).ok).toBe(true);
  });

  it('mantém o lado clicado: a linha fica com a parte que contém o clique', () => {
    const d = draftOf([line('h', P(0, 0), P(10, 0)), line('v', P(4, -1), P(4, 1))]);
    const r = trimExtendToCorner(d, 'h', P(7, 0), 'v', P(4, 0.8))!;
    expect(near(byId(r, 'h').a, P(4, 0))).toBe(true);
    expect(near(byId(r, 'h').b, P(10, 0))).toBe(true);
    expect(near(byId(r, 'v').a, P(4, 0))).toBe(true);
    expect(near(byId(r, 'v').b, P(4, 1))).toBe(true);
  });

  it('preserva ids, ordem e flags de telhado das linhas aparadas', () => {
    const flags = { definesSlope: false, slopePct: 12, overhang: 0.8 };
    const d = draftOf([line('x', P(-0.5, 0), P(4, 0), flags), line('y', P(0, -1), P(0, 2), { slopePct: 45 })]);
    const r = trimExtendToCorner(d, 'x', P(2, 0), 'y', P(0, 1))!;
    expect(r.segs.map((s) => s.id)).toEqual(['x', 'y']);
    expect(byId(r, 'x')).toMatchObject(flags);
    expect(byId(r, 'y').slopePct).toBe(45);
    expect(byId(r, 'y').definesSlope).toBeUndefined();
  });

  it('não muta o rascunho de entrada', () => {
    const d = draftOf(rectSegs(5, 3, 0.3));
    const before = JSON.stringify(d);
    squareCorners(d, 5, 3);
    expect(JSON.stringify(d)).toBe(before);
  });

  it('linhas paralelas não têm canto: null', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 0)), line('b', P(0, 1), P(4, 1))]);
    expect(trimExtendToCorner(d, 'a', P(1, 0), 'b', P(1, 1))).toBeNull();
  });

  it('ids iguais ou desconhecidos: null', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 0))]);
    expect(trimExtendToCorner(d, 'a', P(1, 0), 'a', P(1, 0))).toBeNull();
    expect(trimExtendToCorner(d, 'a', P(1, 0), 'zz', P(1, 0))).toBeNull();
  });

  it('arco aparado em uma reta: a ponta vai para o cruzamento e continua na circunferência', () => {
    // Arco de (0,0) a (2,0) com flecha 0,5 (abaulado para +y): R = 1,25, centro (1, -0,75).
    const d = draftOf([line('arc', P(0, 0), P(2, 0), { sag: 0.5 }), line('v', P(0.4, -1), P(0.4, 1))]);
    const r = trimExtendToCorner(d, 'arc', P(1, 0.5), 'v', P(0.4, -0.9))!;
    const arc = byId(r, 'arc');
    const center = P(1, -0.75);
    const dist = (p: Vec2): number => Math.hypot(p.x - center.x, p.y - center.y);
    expect(dist(arc.a)).toBeCloseTo(1.25, 6);
    expect(dist(arc.b)).toBeCloseTo(1.25, 6);
    // Cruzamento de x = 0,4 com o círculo, no ramo superior: y = -0,75 + √(1,5625 − 0,36).
    const yCorner = -0.75 + Math.sqrt(1.5625 - 0.36);
    expect(arc.a.x).toBeCloseTo(0.4, 6);
    expect(arc.a.y).toBeCloseTo(yCorner, 6);
    expect(arc.sag).toBeGreaterThan(0);
    expect(near(arc.b, P(2, 0))).toBe(true);
    // A reta v fica com a parte de baixo (é a que contém o clique em y = -0,9).
    expect(near(byId(r, 'v').a, P(0.4, -1))).toBe(true);
    expect(byId(r, 'v').b.x).toBeCloseTo(0.4, 6);
    expect(byId(r, 'v').b.y).toBeCloseTo(yCorner, 6);
  });
});

describe('trimToBoundary e extendToBoundary', () => {
  const wall = line('w', P(4, -5), P(4, 5));

  it('apara a linha no limite e mantém o trecho do clique', () => {
    const d = draftOf([line('h', P(0, 0), P(10, 0)), wall]);
    const right = trimToBoundary(d, 'h', P(7, 0), 'w')!;
    expect(near(byId(right, 'h').a, P(4, 0))).toBe(true);
    expect(near(byId(right, 'h').b, P(10, 0))).toBe(true);
    const left = trimToBoundary(d, 'h', P(2, 0), 'w')!;
    expect(near(byId(left, 'h').a, P(0, 0))).toBe(true);
    expect(near(byId(left, 'h').b, P(4, 0))).toBe(true);
  });

  it('sem cruzamento por dentro da linha: null', () => {
    const d = draftOf([line('h', P(0, 0), P(3, 0)), wall]);
    expect(trimToBoundary(d, 'h', P(1, 0), 'w')).toBeNull();
  });

  it('estende a ponta mais próxima do clique até o limite', () => {
    const d = draftOf([line('h', P(0, 0), P(3, 0)), line('w', P(5, -2), P(5, 2))]);
    const r = extendToBoundary(d, 'h', P(2.5, 0), 'w')!;
    expect(near(byId(r, 'h').a, P(0, 0))).toBe(true);
    expect(near(byId(r, 'h').b, P(5, 0))).toBe(true);
  });

  it('estende pelo lado da ponta a: limite atrás dela', () => {
    const d = draftOf([line('h', P(0, 0), P(3, 0)), line('w', P(-2, -2), P(-2, 2))]);
    const r = extendToBoundary(d, 'h', P(0.5, 0), 'w')!;
    expect(near(byId(r, 'h').a, P(-2, 0))).toBe(true);
    expect(near(byId(r, 'h').b, P(3, 0))).toBe(true);
  });

  it('limite fora do alcance na direção do clique: null', () => {
    const d = draftOf([line('h', P(0, 0), P(3, 0)), line('w', P(-2, -2), P(-2, 2))]);
    expect(extendToBoundary(d, 'h', P(2.5, 0), 'w')).toBeNull();
  });

  it('arco estendido até uma reta fica na circunferência original', () => {
    // Arco de (0,0) a (1,1) com flecha 0,3 (R ≈ 0,983); limite vertical em x = 1,5 à frente da ponta b.
    const d = draftOf([line('arc', P(0, 0), P(1, 1), { sag: 0.3 }), line('w', P(1.5, -1), P(1.5, 3))]);
    const before = curveRadiusCheck(byId(d, 'arc'));
    const r = extendToBoundary(d, 'arc', P(0.9, 0.9), 'w');
    expect(r).not.toBeNull();
    const arc = byId(r!, 'arc');
    expect(arc.a).toEqual(P(0, 0));
    expect(arc.b.x).toBeCloseTo(1.5, 6);
    expect(curveRadiusCheck(arc)).toBeCloseTo(before, 6);
  });
});

/** Raio da circunferência de um arco de flecha `sag` entre a e b (mesma fórmula da geometria do esboço). */
function curveRadiusCheck(s: SketchSeg): number {
  const c = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
  const h = Math.abs(s.sag ?? 0);
  return (c * c) / 4 / (2 * h) + h / 2;
}

describe('splitAt e splitBetween', () => {
  it('divide a reta no ponto: duas metades, a primeira com o id original e a outra com id novo', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 0), { definesSlope: false, slopePct: 20 })]);
    const r = splitAt(d, 'a', P(1, 0.2))!;
    expect(r.segs).toHaveLength(2);
    expect(r.segs[0]!.id).toBe('a');
    expect(r.segs[1]!.id).not.toBe('a');
    expect(near(r.segs[0]!.b, P(1, 0))).toBe(true);
    expect(near(r.segs[1]!.a, P(1, 0))).toBe(true);
    expect(r.segs[1]!.slopePct).toBe(20);
    expect(r.segs[1]!.definesSlope).toBe(false);
  });

  it('divide arco em dois arcos sobre a mesma circunferência', () => {
    const d = draftOf([line('arc', P(0, 0), P(2, 0), { sag: 0.5 })]);
    const r = splitAt(d, 'arc', P(1, 0.5))!;
    expect(r.segs).toHaveLength(2);
    const [first, second] = r.segs as [SketchSeg, SketchSeg];
    expect(first.sag).toBeGreaterThan(0);
    expect(second.sag).toBeGreaterThan(0);
    expect(curveRadiusCheck(first)).toBeCloseTo(1.25, 6);
    expect(curveRadiusCheck(second)).toBeCloseTo(1.25, 6);
    expect(near(first.b, second.a, 1e-9)).toBe(true);
  });

  it('ponto nas pontas: null', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 0))]);
    expect(splitAt(d, 'a', P(0, 0.0005))).toBeNull();
    expect(splitAt(d, 'a', P(4, 0))).toBeNull();
  });

  it('divide com espaço: remove o trecho entre os dois cliques', () => {
    const d = draftOf([line('a', P(0, 0), P(10, 0), { overhang: 1 })]);
    const r = splitBetween(d, 'a', P(4, 0), P(6, 0))!;
    expect(r.segs).toHaveLength(2);
    expect(near(r.segs[0]!.b, P(4, 0))).toBe(true);
    expect(near(r.segs[1]!.a, P(6, 0))).toBe(true);
    expect(r.segs[1]!.overhang).toBe(1);
  });

  it('trecho no início: só sobra a parte da direita, com o id original', () => {
    const d = draftOf([line('a', P(0, 0), P(10, 0))]);
    const r = splitBetween(d, 'a', P(0, 0), P(3, 0))!;
    expect(r.segs).toHaveLength(1);
    expect(r.segs[0]!.id).toBe('a');
    expect(near(r.segs[0]!.a, P(3, 0))).toBe(true);
  });

  it('trecho vazio ou que apaga a linha inteira: null', () => {
    const d = draftOf([line('a', P(0, 0), P(10, 0))]);
    expect(splitBetween(d, 'a', P(4, 0), P(4, 0))).toBeNull();
    expect(splitBetween(d, 'a', P(-1, 0), P(11, 0))).toBeNull();
  });
});

describe('offsetSegs', () => {
  it('cópia paralela para o lado do ponto; a original fica', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 0))]);
    const r = offsetSegs(d, ['a'], 0.5, P(2, 1))!;
    expect(r.segs).toHaveLength(2);
    expect(byId(r, 'a')).toEqual(d.segs[0]);
    const copy = r.segs[1]!;
    expect(copy.id).not.toBe('a');
    expect(near(copy.a, P(0, 0.5))).toBe(true);
    expect(near(copy.b, P(4, 0.5))).toBe(true);
  });

  it('lado do outro lado: a cópia vai para baixo', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 0))]);
    const r = offsetSegs(d, ['a'], 0.5, P(2, -1))!;
    expect(near(r.segs[1]!.a, P(0, -0.5))).toBe(true);
  });

  it('arco: cópia concêntrica, para fora quando o ponto está fora da circunferência', () => {
    const d = draftOf([line('arc', P(0, 0), P(2, 0), { sag: 0.5 })]);
    const r = offsetSegs(d, ['arc'], 0.25, P(1, 1.5))!;
    const copy = r.segs[1]!;
    expect(curveRadiusCheck(copy)).toBeCloseTo(1.5, 6);
    expect(copy.sag).toBeGreaterThan(0);
    const center = P(1, -0.75);
    expect(Math.hypot(copy.a.x - center.x, copy.a.y - center.y)).toBeCloseTo(1.5, 6);
  });

  it('ponto de lado sobre a própria linha: null', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 0))]);
    expect(offsetSegs(d, ['a'], 0.5, P(2, 0))).toBeNull();
  });

  it('distância zero ou ids desconhecidos: null', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 0))]);
    expect(offsetSegs(d, ['a'], 0, P(2, 1))).toBeNull();
    expect(offsetSegs(d, ['zz'], 0.5, P(2, 1))).toBeNull();
  });
});

describe('offsetLoop', () => {
  it('deslocar um retângulo fechado para dentro: cantos recalculados e laço conectado', () => {
    const rect = [
      line('a', P(0, 0), P(4, 0)),
      line('b', P(4, 0), P(4, 3)),
      line('c', P(4, 3), P(0, 3)),
      line('e', P(0, 3), P(0, 0)),
    ];
    const r = offsetLoop(draftOf(rect), ['a', 'b', 'c', 'e'], 0.5, P(2, 1.5))!;
    const copies = r.segs.slice(4);
    expect(copies).toHaveLength(4);
    const corners = [P(0.5, 0.5), P(3.5, 0.5), P(3.5, 2.5), P(0.5, 2.5)];
    for (const c of corners) expect(copies.some((s) => near(s.a, c) || near(s.b, c))).toBe(true);
    const res = validateSketch(r.segs);
    expect(res.ok).toBe(true);
    expect(res.loops.map((l) => l.role)).toEqual(['outer', 'hole']);
  });

  it('cadeia aberta: pontas perpendiculares e canto recalculado', () => {
    const d = draftOf([line('p1', P(0, 0), P(4, 0)), line('p2', P(4, 0), P(4, 3))]);
    const r = offsetLoop(d, ['p2', 'p1'], 0.2, P(2, 1))!;
    const [c1, c2] = r.segs.slice(2) as [SketchSeg, SketchSeg];
    expect(near(c1.a, P(0, 0.2))).toBe(true);
    expect(near(c1.b, P(3.8, 0.2))).toBe(true);
    expect(near(c2.a, P(3.8, 0.2))).toBe(true);
    expect(near(c2.b, P(3.8, 3))).toBe(true);
  });

  it('laço com arco: a cópia do arco é concêntrica e o laço continua válido', () => {
    // D: (0,0)→(4,0)→(4,2)→(0,2), e de volta a (0,0) por um arco abaulado para -x (flecha -0,8).
    const D = [
      line('L1', P(0, 0), P(4, 0)),
      line('L2', P(4, 0), P(4, 2)),
      line('L3', P(4, 2), P(0, 2)),
      line('A', P(0, 2), P(0, 0), { sag: -0.8 }),
    ];
    const r = offsetLoop(draftOf(D), ['L1', 'L2', 'L3', 'A'], 0.2, P(2, 1))!;
    // As quatro cópias vêm depois das originais, na ordem do percurso: a última é a do arco.
    const arcCopy = r.segs[7]!;
    expect(arcCopy.sag).toBeLessThan(0);
    expect(curveRadiusCheck(arcCopy)).toBeCloseTo(0.825, 3);
    expect(validateSketch(r.segs).ok).toBe(true);
  });

  it('seleção que não forma cadeia (duas partes separadas): null', () => {
    const d = draftOf([line('a', P(0, 0), P(1, 0)), line('b', P(5, 5), P(6, 5))]);
    expect(offsetLoop(d, ['a', 'b'], 0.2, P(0, 1))).toBeNull();
  });

  it('ramificação (três linhas no mesmo ponto): null', () => {
    const d = draftOf([line('a', P(0, 0), P(2, 0)), line('b', P(2, 0), P(4, 0)), line('c', P(2, 0), P(2, 2))]);
    expect(offsetLoop(d, ['a', 'b', 'c'], 0.2, P(0, 1))).toBeNull();
  });
});

describe('transformações', () => {
  it('espelhar no lugar: mesmo id e arco com a flecha invertida', () => {
    const d = draftOf([line('arc', P(0, 1), P(2, 1), { sag: 0.5 })]);
    const r = mirrorSegs(d, ['arc'], P(0, 0), P(1, 0), false)!;
    expect(r.segs).toHaveLength(1);
    expect(r.segs[0]!.id).toBe('arc');
    expect(near(r.segs[0]!.a, P(0, -1))).toBe(true);
    expect(near(r.segs[0]!.b, P(2, -1))).toBe(true);
    expect(r.segs[0]!.sag).toBeCloseTo(-0.5, 9);
  });

  it('espelhar com cópia: a original fica e a cópia ganha id novo', () => {
    const d = draftOf([line('a', P(1, 1), P(2, 3), { slopePct: 25 })]);
    const r = mirrorSegs(d, ['a'], P(0, 0), P(1, 0), true)!;
    expect(r.segs).toHaveLength(2);
    expect(near(r.segs[1]!.a, P(1, -1))).toBe(true);
    expect(near(r.segs[1]!.b, P(2, -3))).toBe(true);
    expect(r.segs[1]!.slopePct).toBe(25);
    expect(r.segs[0]).toEqual(d.segs[0]);
  });

  it('girar 90° em torno da origem, com e sem cópia', () => {
    const d = draftOf([line('a', P(1, 0), P(2, 0))]);
    const moved = rotateSegs(d, ['a'], P(0, 0), Math.PI / 2, false)!;
    expect(near(moved.segs[0]!.a, P(0, 1), 1e-9)).toBe(true);
    expect(near(moved.segs[0]!.b, P(0, 2), 1e-9)).toBe(true);
    const copied = rotateSegs(d, ['a'], P(0, 0), Math.PI / 2, true)!;
    expect(copied.segs).toHaveLength(2);
    expect(near(copied.segs[1]!.a, P(0, 1), 1e-9)).toBe(true);
  });

  it('copiar: cópias deslocadas, originais inalteradas', () => {
    const d = draftOf([line('a', P(0, 0), P(1, 0))]);
    const r = copySegs(d, ['a'], P(0, 3))!;
    expect(r.segs).toHaveLength(2);
    expect(near(r.segs[1]!.a, P(0, 3))).toBe(true);
    expect(near(r.segs[0]!.a, P(0, 0))).toBe(true);
  });

  it('matriz: count conta o original, então count 3 cria duas cópias', () => {
    const d = draftOf([line('a', P(0, 0), P(1, 0))]);
    const r = arraySegs(d, ['a'], P(2, 0), 3)!;
    expect(r.segs).toHaveLength(3);
    expect(near(r.segs[1]!.a, P(2, 0))).toBe(true);
    expect(near(r.segs[2]!.a, P(4, 0))).toBe(true);
    expect(arraySegs(d, ['a'], P(2, 0), 1)).toBeNull();
    expect(arraySegs(d, ['a'], P(0, 0), 3)).toBeNull();
  });

  it('alinhar reta à linha de referência: pontas projetadas; arco fica de fora', () => {
    const d = draftOf([line('a', P(0, 0), P(4, 1), { definesSlope: false }), line('arc', P(0, 0), P(2, 0), { sag: 0.5 })]);
    const r = alignSegToLine(d, 'a', P(0, 2), P(5, 2))!;
    expect(near(byId(r, 'a').a, P(0, 2))).toBe(true);
    expect(near(byId(r, 'a').b, P(4, 2))).toBe(true);
    expect(byId(r, 'a').definesSlope).toBe(false);
    expect(alignSegToLine(d, 'arc', P(0, 2), P(5, 2))).toBeNull();
  });

  it('excluir: remove as linhas e limpa a seleção; ids desconhecidos: null', () => {
    const d = { ...draftOf([line('a', P(0, 0), P(1, 0)), line('b', P(1, 0), P(2, 0))]), selected: ['a', 'b'] };
    const r = deleteSegs(d, ['a'])!;
    expect(r.segs.map((s) => s.id)).toEqual(['b']);
    expect(r.selected).toEqual(['b']);
    expect(deleteSegs(d, ['zz'])).toBeNull();
  });
});

describe('joinLoose e snapEndsToCorners', () => {
  /** Retângulo com folgas de 2 cm nas emendas. */
  const gappy = (): SketchSeg[] => [
    line('s1', P(0, 0), P(4, 0)),
    line('s2', P(4.02, 0), P(4, 3)),
    line('s3', P(4, 3.02), P(0, 3)),
    line('s4', P(0, 3), P(0.02, 0)),
  ];

  it('une pontas soltas com folga de até 5 cm: rascunho fica fechado e válido', () => {
    expect(validateSketch(gappy()).ok).toBe(false);
    const r = joinLoose(draftOf(gappy()), 0.05)!;
    expect(validateSketch(r.segs).ok).toBe(true);
    expect(near(byId(r, 's1').b, P(4.01, 0), 1e-9)).toBe(true);
    expect(near(byId(r, 's2').a, P(4.01, 0), 1e-9)).toBe(true);
  });

  it('tolerância menor que a folga: nada se une (null)', () => {
    expect(joinLoose(draftOf(gappy()), 0.01)).toBeNull();
  });

  it('folga maior que 5 cm não é ajustada, mesmo com tolerância grande', () => {
    const far = [line('a', P(0, 0), P(4, 0)), line('b', P(4.2, 0), P(4, 3))];
    expect(joinLoose(draftOf(far), 1)).toBeNull();
  });

  it('encaixa uma ponta solta no canto formado por duas outras linhas', () => {
    const d = draftOf([
      line('c1', P(0, 0), P(4, 0)),
      line('c2', P(4, -1), P(4, 2)),
      line('l3', P(4.03, 0.02), P(6, 0.02)),
    ]);
    const r = snapEndsToCorners(d, 0.05)!;
    expect(near(byId(r, 'l3').a, P(4, 0), 1e-9)).toBe(true);
    expect(near(byId(r, 'l3').b, P(6, 0.02))).toBe(true);
  });

  it('nenhuma ponta perto de um canto: null', () => {
    const d = draftOf([line('c1', P(0, 0), P(4, 0)), line('c2', P(4, -1), P(4, 2)), line('l3', P(4.5, 0.5), P(6, 0.5))]);
    expect(snapEndsToCorners(d, 0.05)).toBeNull();
  });
});
