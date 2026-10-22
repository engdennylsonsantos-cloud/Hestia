import { describe, expect, it } from 'vitest';
import { openingSymbolPaths, voidCrossPaths, type OpeningSymbolInput, type OpeningSymbolStroke } from './openingSymbol.ts';

/** Vão de 0,90 m numa parede de 0,14 m (faces em s = ±0,07), eixos padrão: t ao longo de x, s para y. */
const base: OpeningSymbolInput = {
  kind: 'door',
  center: { x: 0, y: 0 },
  u: { x: 1, y: 0 },
  n: { x: 0, y: 1 },
  width: 0.9,
  thickness: 0.14,
  sHi: 0.07,
  sLo: -0.07,
  leaves: 1,
  plan: 'swing',
  flipHand: false,
  flipFacing: false,
};

type P = { x: number; y: number };
const sym = (over: Partial<OpeningSymbolInput>): OpeningSymbolStroke[] => openingSymbolPaths({ ...base, ...over });
const close = (a: P, b: P, eps = 1e-6): void => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
  expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThan(eps + 1e-12);
};
const first = (s: OpeningSymbolStroke): P => s.pts[0]!;
const last = (s: OpeningSymbolStroke): P => s.pts.at(-1)!;
const dist = (a: P, b: P): number => Math.hypot(a.x - b.x, a.y - b.y);
const soft = (s: OpeningSymbolStroke[]): OpeningSymbolStroke[] => s.filter((x) => x.tone === 'soft');
const ink = (s: OpeningSymbolStroke[]): OpeningSymbolStroke[] => s.filter((x) => x.tone === 'ink');

describe('porta de giro (1 folha)', () => {
  it('folha de comprimento W a partir da dobradiça, e arco de 90° de raio W até a ombreira oposta', () => {
    const s = sym({ plan: 'swing', leaves: 1 });
    expect(s).toHaveLength(2);
    close(first(s[0]!), { x: -0.45, y: 0.07 });
    close(last(s[0]!), { x: -0.45, y: 0.97 });
    close(first(s[1]!), { x: -0.45, y: 0.97 });
    close(last(s[1]!), { x: 0.45, y: 0.07 });
    for (const p of s[1]!.pts) expect(dist(p, { x: -0.45, y: 0.07 })).toBeCloseTo(0.9, 6);
  });
});

describe('pivotante (eixo a 1/4 da largura, do lado da dobradiça)', () => {
  it('eixo em (-W/2 + W/4, sMid); banda curta (1/4) e longa (3/4), cada uma com arco de 90° do seu raio', () => {
    const s = sym({ plan: 'pivot', leaves: 1 });
    // Anel do eixo, folha aberta e os dois arcos.
    expect(s).toHaveLength(4);
    const arcs = soft(s);
    expect(arcs).toHaveLength(2);
    const axis = { x: -0.225, y: 0 };
    // Banda curta: raio W/4, para o lado da abertura (+s), termina na ombreira da dobradiça (-W/2).
    const short = arcs[0]!;
    close(first(short), { x: -0.225, y: 0.225 });
    close(last(short), { x: -0.45, y: 0 });
    for (const p of short.pts) expect(dist(p, axis)).toBeCloseTo(0.225, 6);
    // Banda longa: raio 3W/4, para o outro lado (-s), termina na ombreira oposta (+W/2).
    const long = arcs[1]!;
    close(first(long), { x: -0.225, y: -0.675 });
    close(last(long), { x: 0.45, y: 0 });
    for (const p of long.pts) expect(dist(p, axis)).toBeCloseTo(0.675, 6);
  });

  it('a folha aberta tem comprimento W e passa pelo eixo, perpendicular à parede', () => {
    const leaf = ink(sym({ plan: 'pivot', leaves: 1 })).find((x) => x.pts.length === 2)!;
    close(first(leaf), { x: -0.225, y: 0.225 });
    close(last(leaf), { x: -0.225, y: -0.675 });
    expect(dist(first(leaf), last(leaf))).toBeCloseTo(0.9, 6);
  });

  it('com flipHand o eixo vai para o lado oposto (+W/4), e os arcos continuam nas duas ombreiras', () => {
    const s = sym({ plan: 'pivot', leaves: 1, flipHand: true });
    const arcs = soft(s);
    const axis = { x: 0.225, y: 0 };
    close(first(arcs[0]!), { x: 0.225, y: 0.225 });
    close(last(arcs[0]!), { x: 0.45, y: 0 });
    close(last(arcs[1]!), { x: -0.45, y: 0 });
    for (const p of arcs[1]!.pts) expect(dist(p, axis)).toBeCloseTo(0.675, 6);
  });

  it('com flipFacing as bandas trocam de lado (curta para -s)', () => {
    const arcs = soft(sym({ plan: 'pivot', leaves: 1, flipFacing: true }));
    close(first(arcs[0]!), { x: -0.225, y: -0.225 });
    close(first(arcs[1]!), { x: -0.225, y: 0.675 });
    close(last(arcs[0]!), { x: -0.45, y: 0 });
    close(last(arcs[1]!), { x: 0.45, y: 0 });
  });
});

describe('porta de 2 folhas (giro)', () => {
  const two = { width: 1.6, leaves: 2 as const };

  it('duas folhas de W/2 com dobradiças nas ombreiras e dois arcos de 90° que terminam no centro', () => {
    const s = sym({ ...two, plan: 'swing' });
    const leaves = ink(s);
    const arcs = soft(s);
    expect(leaves).toHaveLength(2);
    expect(arcs).toHaveLength(2);
    // Dobradiças em ±W/2 (nas ombreiras), na face de abertura (s = sHi).
    close(first(leaves[0]!), { x: -0.8, y: 0.07 });
    close(first(leaves[1]!), { x: 0.8, y: 0.07 });
    expect(dist(first(leaves[0]!), last(leaves[0]!))).toBeCloseTo(0.8, 6);
    expect(dist(first(leaves[1]!), last(leaves[1]!))).toBeCloseTo(0.8, 6);
    // Cada arco nasce na ponta aberta da folha e termina no centro, na face de abertura.
    close(first(arcs[0]!), { x: -0.8, y: 0.87 });
    close(last(arcs[0]!), { x: 0, y: 0.07 });
    close(first(arcs[1]!), { x: 0.8, y: 0.87 });
    close(last(arcs[1]!), { x: 0, y: 0.07 });
  });

  it('os dois lados são simétricos em relação ao eixo do vão (ponto a ponto)', () => {
    const s = sym({ ...two, plan: 'swing' });
    const [lLeaf, rLeaf] = ink(s);
    const [lArc, rArc] = soft(s);
    for (const [l, r] of [[lLeaf!, rLeaf!], [lArc!, rArc!]] as const) {
      expect(r.pts).toHaveLength(l.pts.length);
      l.pts.forEach((p, i) => close({ x: -p.x, y: p.y }, r.pts[i]!));
    }
  });

  it('plan double gera exatamente o mesmo símbolo que swing com 2 folhas', () => {
    expect(sym({ ...two, plan: 'double' })).toEqual(sym({ ...two, plan: 'swing' }));
  });

  it('plan double com 1 folha também vira swing com 2 folhas (é a mesma família)', () => {
    expect(sym({ plan: 'double', leaves: 1 })).toEqual(sym({ plan: 'swing', leaves: 2 }));
  });

  it('double sem folhas segue o vão livre', () => {
    expect(sym({ plan: 'double', leaves: 0 })).toEqual(sym({ plan: 'swing', leaves: 0 }));
  });
});

describe('janela de correr com n folhas', () => {
  const win = { kind: 'window' as const, width: 1.2, plan: 'sliding' as const };
  /** Folhas: linhas de 2 pontos entre as faces do caixilho (|s| < 0,07), de peso 1. */
  const leafLines = (s: OpeningSymbolStroke[]): OpeningSymbolStroke[] =>
    ink(s).filter((x) => x.pts.length === 2 && x.weight === 1 && x.pts.every((p) => Math.abs(p.y) < 0.07 - 1e-9));

  it('conta: 2 faces, 2 ombreiras, n folhas e a seta (2 traços)', () => {
    expect(sym({ ...win, leaves: 1 })).toHaveLength(7);
    expect(sym({ ...win, leaves: 2 })).toHaveLength(8);
    expect(sym({ ...win, leaves: 3 })).toHaveLength(9);
  });

  it('duas folhas em linhas defasadas de T/3, alternando as extremidades com 60% do vão', () => {
    const leaves = leafLines(sym({ ...win, leaves: 2 }));
    expect(leaves).toHaveLength(2);
    const d = 0.14 / 3;
    // Folha 1: de -W/2 até -W/2 + 0,6W, em s = sLo + d.
    close(first(leaves[0]!), { x: -0.6, y: -0.07 + d });
    close(last(leaves[0]!), { x: 0.12, y: -0.07 + d });
    // Folha 2: de W/2 - 0,6W até W/2, em s = sLo + 2d.
    close(first(leaves[1]!), { x: -0.12, y: -0.07 + 2 * d });
    close(last(leaves[1]!), { x: 0.6, y: -0.07 + 2 * d });
  });

  it('com duas folhas não há linha no plano médio', () => {
    const s = sym({ ...win, leaves: 2 });
    expect(s.some((x) => x.pts.length >= 2 && x.pts.every((p) => Math.abs(p.y) < 1e-9))).toBe(false);
  });

  it('uma folha fica no plano médio; três folhas em T/4, T/2 e 3T/4, alternando as extremidades', () => {
    const one = leafLines(sym({ ...win, leaves: 1 }));
    expect(one).toHaveLength(1);
    close(first(one[0]!), { x: -0.6, y: 0 });
    const three = leafLines(sym({ ...win, leaves: 3 }));
    expect(three).toHaveLength(3);
    [-0.035, 0, 0.035].forEach((y, i) => expect(first(three[i]!).y).toBeCloseTo(y, 9));
    [-0.6, -0.12, -0.6].forEach((x, i) => expect(first(three[i]!).x).toBeCloseTo(x, 9));
  });

  it('a seta fica na faixa entre a face de baixo e a primeira folha', () => {
    const shaft = sym({ ...win, leaves: 2 }).find((x) => x.weight === 0.8 && x.pts.length === 2)!;
    const y = shaft.pts[0]!.y;
    expect(y).toBeGreaterThan(-0.07);
    expect(y).toBeLessThan(-0.07 + 0.14 / 3);
  });
});

describe('janela sem folha (vão livre)', () => {
  it('leaves 0: a soleira tracejada no plano médio, de -W/2 a +W/2, e o X ligando os vértices do vão', () => {
    const s = sym({ kind: 'window', plan: 'sliding', leaves: 0 });
    expect(s).toHaveLength(3);
    expect(s[0]!.dash).toBeDefined();
    close(first(s[0]!), { x: -0.45, y: 0 });
    close(last(s[0]!), { x: 0.45, y: 0 });
  });

  it('X do vão livre: diagonais exatas de (-W/2, sLo) a (+W/2, sHi) e de (+W/2, sLo) a (-W/2, sHi)', () => {
    const [, d1, d2] = sym({ leaves: 0 });
    close(first(d1!), { x: -0.45, y: -0.07 });
    close(last(d1!), { x: 0.45, y: 0.07 });
    close(first(d2!), { x: 0.45, y: -0.07 });
    close(last(d2!), { x: -0.45, y: 0.07 });
    expect(d1!.dash).toBeUndefined();
    expect(d2!.dash).toBeUndefined();
  });

  it('X segue a rotação do vão: com u e n trocados, os vértices vão para os novos eixos', () => {
    const [, d1] = sym({ leaves: 0, u: { x: 0, y: 1 }, n: { x: -1, y: 0 } });
    close(first(d1!), { x: 0.07, y: -0.45 });
    close(last(d1!), { x: -0.07, y: 0.45 });
  });

  it('o vão com folha não leva o X (só o vão livre)', () => {
    expect(sym({ leaves: 1 }).some((s) => s.pts.length === 2 && !s.closed && s.weight === 0.6)).toBe(false);
  });
});

describe('voidCrossPaths', () => {
  it('liga os vértices opostos: a→c e b→d', () => {
    const [d1, d2] = voidCrossPaths([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 },
    ]);
    expect(d1).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]);
    expect(d2).toEqual([
      { x: 2, y: 0 },
      { x: 0, y: 1 },
    ]);
  });
});
