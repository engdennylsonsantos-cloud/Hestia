import { describe, expect, it } from 'vitest';
import { closeGapsSafe, multiArea, offsetMulti, ringArea, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type JoinKind, type Project, type Wall } from '@hestia/model';
import { resolveLevel } from './index.ts';

/**
 * Invariantes de junção medidos sobre a união das camadas de TODAS as paredes do nível. Cada cenário é verificado nas
 * três configurações (esquadria, encosto, esquadro) e tem de:
 *  - fresta aberta: o fecho morfológico de 1,5 mm não pode acrescentar área (< 2e-5 m², acima do ruído de grade do Clipper e bem abaixo das frestas reais de ~1e-4) — pega fendas finas abertas
 *    para fora (a checagem de anéis e furos não vê), como a diagonal de 2 mm que o contorno por faces deixava no encosto;
 *  - anéis: tantos anéis externos quantas as edificações do cenário, sem furo real (largura média 2A/P ≥ 1e-6 m);
 *  - sobreposição: a soma das áreas de `cut` é a área da união (as camadas não se sobrepõem), tolerância de grade 1e-5.
 */

const KINDS: JoinKind[] = ['miter', 'butt', 'square'];
const G = 'wt_ext19';
const F = 'wt_alv14';
const rad = (d: number): number => (d * Math.PI) / 180;

interface Seg {
  id: string;
  type: string;
  a: Vec2;
  b: Vec2;
  sag?: number;
}

/** Cadeia/laço de paredes: cada parede termina onde a seguinte começa; `closed` liga a última à primeira. */
function build(segs: Seg[], kind: JoinKind): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const g of segs) s.exec({ type: 'addWall', wall: makeWall({ id: g.id, typeId: g.type, levelId: 'lv_0', a: g.a, b: g.b, ...(g.sag ? { sag: g.sag } : {}) }) });
  const el = { ...s.project.elements } as Record<string, Wall>;
  for (const g of segs) el[g.id] = { ...(el[g.id] as Wall), joinStart: { kind, flip: false }, joinEnd: { kind, flip: false } };
  return { ...s.project, elements: el } as unknown as Project;
}

interface Medida {
  rings: number;
  holes: number;
  fresta: number;
  sobreposicao: number;
}

function medir(p: Project): Medida {
  const r = resolveLevel(p, 'lv_0', new Map());
  const polys: MultiPolygon = Object.values(r.walls).flatMap((w) => w.layers.flatMap((l) => l.cut));
  const soma = Object.values(r.walls).reduce((s, w) => s + w.layers.reduce((t, l) => t + multiArea(l.cut), 0), 0);
  // Fendas de grade (< 20 µm) entre camadas de paredes inclinadas não aparecem em nenhuma saída: o motor também as fecha.
  const u = closeGapsSafe(union(...polys.map((poly) => [poly] as MultiPolygon)), 2e-5, 1e-4);
  const fecho = offsetMulti(offsetMulti(u, 0.0015), -0.0015);
  let holes = 0;
  for (const poly of u) {
    for (const h of poly.slice(1)) {
      const a = Math.abs(ringArea(h));
      let per = 0;
      for (let i = 0; i < h.length; i++) per += Math.hypot(h[(i + 1) % h.length]!.x - h[i]!.x, h[(i + 1) % h.length]!.y - h[i]!.y);
      if (a > 1e-9 && (2 * a) / Math.max(per, 1e-12) >= 1e-6) holes += 1;
    }
  }
  return { rings: u.length, holes, fresta: multiArea(fecho) - multiArea(u), sobreposicao: soma - multiArea(u) };
}

function conferir(nome: string, segs: Seg[], holes = 0, rings = 1): void {
  for (const kind of KINDS) {
    it(`${nome} em ${kind}`, () => {
      const m = medir(build(segs, kind));
      expect(m.rings, 'anéis externos').toBe(rings);
      expect(m.holes, 'furos reais (ambientes fechados)').toBe(holes);
      expect(m.fresta, 'fresta aberta (fecho 1,5 mm)').toBeLessThan(2e-5);
      expect(Math.abs(m.sobreposicao), 'soma das camadas x união').toBeLessThan(1e-5);
    });
  }
}

const P = (x: number, y: number): Vec2 => ({ x, y });

/** Polígono regular fechado de `n` lados, raio `r`, tipos alternando conforme `tipos`. */
function poligono(n: number, r: number, tipos: string[]): Seg[] {
  const v = Array.from({ length: n }, (_, i) => P(r * Math.cos(rad((360 / n) * i)), r * Math.sin(rad((360 / n) * i))));
  return v.map((a, i) => ({ id: `w${i}`, type: tipos[i % tipos.length]!, a, b: v[(i + 1) % n]! }));
}

describe('casas fechadas (o desenho real de uma planta)', () => {
  conferir('retângulo 6x4 de paredes iguais', [
    { id: 'w0', type: F, a: P(0, 0), b: P(6, 0) },
    { id: 'w1', type: F, a: P(6, 0), b: P(6, 4) },
    { id: 'w2', type: F, a: P(6, 4), b: P(0, 4) },
    { id: 'w3', type: F, a: P(0, 4), b: P(0, 0) },
  ], 1);
  conferir('retângulo 6x4 com tipos alternados', [
    { id: 'w0', type: G, a: P(0, 0), b: P(6, 0) },
    { id: 'w1', type: F, a: P(6, 0), b: P(6, 4) },
    { id: 'w2', type: G, a: P(6, 4), b: P(0, 4) },
    { id: 'w3', type: F, a: P(0, 4), b: P(0, 0) },
  ], 1);
  conferir('L fechado (6 paredes, canto reentrante)', [
    { id: 'w0', type: F, a: P(0, 0), b: P(6, 0) },
    { id: 'w1', type: G, a: P(6, 0), b: P(6, 2) },
    { id: 'w2', type: F, a: P(6, 2), b: P(3, 2) },
    { id: 'w3', type: F, a: P(3, 2), b: P(3, 5) },
    { id: 'w4', type: G, a: P(3, 5), b: P(0, 5) },
    { id: 'w5', type: F, a: P(0, 5), b: P(0, 0) },
  ], 1);
  conferir('hexágono (cantos de 120°)', poligono(6, 3, [F]), 1);
  conferir('pentágono com tipos alternados (cantos de 108°)', poligono(5, 3, [G, F]), 1);
  conferir('triângulo (cantos de 60°)', poligono(3, 4, [F, G, F]), 1);
});

describe('L isolado: ângulos e tipos', () => {
  for (const [ta, tb] of [[F, F], [G, F], [F, G]] as const) {
    for (const ang of [45, 60, 90, 120, 135]) {
      conferir(`L ${ta}+${tb} a ${ang}°`, [
        { id: 'g', type: ta, a: P(0, 0), b: P(4, 0) },
        { id: 'f', type: tb, a: P(4, 0), b: P(4 + 3 * Math.cos(rad(ang)), 3 * Math.sin(rad(ang))) },
      ]);
    }
  }
});

describe('T e nós', () => {
  for (const ang of [45, 60, 90, 120, 135]) {
    conferir(`T com ramal a ${ang}°`, [
      { id: 'g', type: G, a: P(-2, 0), b: P(2, 0) },
      { id: 'f', type: F, a: P(0, 0), b: P(3 * Math.cos(rad(ang)), 3 * Math.sin(rad(ang))) },
    ]);
  }
  conferir('Y de 3 iguais', [
    { id: 'a', type: F, a: P(0, 0), b: P(3, 0) },
    { id: 'b', type: F, a: P(0, 0), b: P(3 * Math.cos(rad(120)), 3 * Math.sin(rad(120))) },
    { id: 'c', type: F, a: P(0, 0), b: P(3 * Math.cos(rad(240)), 3 * Math.sin(rad(240))) },
  ]);
  conferir('nó 19 + 14 + 14 (0/90/225)', [
    { id: 'g', type: G, a: P(0, 0), b: P(4, 0) },
    { id: 'f1', type: F, a: P(0, 0), b: P(0, 3) },
    { id: 'f2', type: F, a: P(0, 0), b: P(-2, -2) },
  ]);
  conferir('nó 0/60/120 (lacuna reflexa de 240°)', [0, 60, 120].map((a, i) => ({ id: `r${i}`, type: i === 1 ? F : G, a: P(0, 0), b: P(3 * Math.cos(rad(a)), 3 * Math.sin(rad(a))) })));
  conferir('estrela de 5 braços', [0, 72, 144, 216, 288].map((a, i) => ({ id: `s${i}`, type: i % 2 ? F : G, a: P(0, 0), b: P(3 * Math.cos(rad(a)), 3 * Math.sin(rad(a))) })));
  conferir('X de 4 braços', [
    { id: 'a', type: G, a: P(0, 0), b: P(3, 0) },
    { id: 'b', type: F, a: P(0, 0), b: P(0, 3) },
    { id: 'c', type: G, a: P(0, 0), b: P(-3, 0) },
    { id: 'd', type: F, a: P(0, 0), b: P(0, -3) },
  ]);
});

/** Área da silhueta (união das camadas, fechada como o motor faz) de um cenário em uma configuração. */
function areaSilhueta(segs: Seg[], kind: JoinKind): number {
  const r = resolveLevel(build(segs, kind), 'lv_0', new Map());
  const polys: MultiPolygon = Object.values(r.walls).flatMap((w) => w.layers.flatMap((l) => l.cut));
  return multiArea(closeGapsSafe(union(...polys.map((poly) => [poly] as MultiPolygon)), 2e-5, 1e-4));
}

describe('a silhueta externa não depende da configuração (sem ponta para fora nem entalhe)', () => {
  // O canto externo é o mesmo nas três junções (a dominante chega ao ponto de encontro das faces externas), então
  // a união das camadas tem a mesma área; uma ponta que sobra além da outra parede ou um entalhe aparecem aqui.
  for (const [ta, tb] of [[F, F], [G, F], [F, G]] as const) {
    for (const virada of [5, 10, 20, 30, 45, 60, 90, 120, 135, 150]) {
      it(`L ${ta}+${tb} com virada de ${virada}°`, () => {
        const segs: Seg[] = [
          { id: 'g', type: ta, a: P(0, 0), b: P(4, 0) },
          { id: 'f', type: tb, a: P(4, 0), b: P(4 + 3 * Math.cos(rad(virada)), 3 * Math.sin(rad(virada))) },
        ];
        const ref = areaSilhueta(segs, 'miter');
        for (const kind of ['butt', 'square'] as const) expect(Math.abs(areaSilhueta(segs, kind) - ref), kind).toBeLessThan(5e-4);
      });
    }
  }
  for (const virada of [90, 60, 120]) {
    it(`T com ramal a ${virada}°`, () => {
      const segs: Seg[] = [
        { id: 'g', type: G, a: P(-2, 0), b: P(2, 0) },
        { id: 'f', type: F, a: P(0, 0), b: P(3 * Math.cos(rad(virada)), 3 * Math.sin(rad(virada))) },
      ];
      const ref = areaSilhueta(segs, 'miter');
      for (const kind of ['butt', 'square'] as const) expect(Math.abs(areaSilhueta(segs, kind) - ref), kind).toBeLessThan(5e-4);
    });
  }
});
