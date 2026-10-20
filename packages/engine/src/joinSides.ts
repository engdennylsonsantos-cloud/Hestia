import { coreSpan } from '@hestia/model';
import { add, dot, intersectLines, mul, perp, type Vec2 } from '@hestia/geom';
import type { EndRef, EndSpec, MiterSide, SideSpec, WallEnds } from './joinTypes.ts';

/**
 * Pareamento em duas pontas (decisão 0009): profundidade em `to` que a camada de profundidade `d` de `from` encontra.
 * O acabamento externo pareia pela distância ao início do núcleo; o interno, pela distância ao fim do núcleo; o
 * núcleo varia linearmente entre os dois. Assim o acabamento da parede fina termina nas linhas da grossa e o núcleo
 * da grossa vai até a face do próprio núcleo. Os dois sentidos usam esta mesma função (é a inversa um do outro),
 * então os dois lados do canto produzem os mesmos vértices. Saturado nas faces de `to`.
 */
export function pairDepth(from: MiterSide, to: MiterSide, d: number): number {
  let dd: number;
  if (d <= from.outerToCore) dd = to.outerToCore + (d - from.outerToCore);
  else if (d < from.coreEnd) dd = to.outerToCore + ((d - from.outerToCore) * (to.coreEnd - to.outerToCore)) / (from.coreEnd - from.outerToCore);
  else dd = to.coreEnd + (d - from.coreEnd);
  return Math.max(0, Math.min(dd, to.sHi - to.sLo));
}

/**
 * Profundidades em que a linha de esquadria muda de direção: limites de camada dos dois lados (os do vizinho levados
 * a este pelo pareamento), as dobras do pareamento (início e fim do núcleo) e os pontos em que ele satura nas faces
 * do vizinho. Cada camada segue a cadeia por esses vértices, então os dois lados compartilham arestas exatas.
 */
export function miterBreaks(self: MiterSide, other: MiterSide): number[] {
  const T = self.sHi - self.sLo;
  const To = other.sHi - other.sLo;
  const all = [
    ...self.bounds,
    ...other.bounds.map((b) => pairDepth(other, self, b)),
    self.outerToCore,
    self.coreEnd,
    pairDepth(other, self, 0),
    pairDepth(other, self, To),
  ];
  return [...new Set(all.map((d) => Math.round(d * 1e7) / 1e7).filter((d) => d > 1e-7 && d < T - 1e-7))].sort((a, b) => a - b);
}

export const sOfDepth = (m: MiterSide, d: number): number => (m.sigma > 0 ? m.sHi - d : m.sLo + d);

/** Ponto da aresta de fim da camada, na fronteira à profundidade `d` (medida da face externa do canto). */
export function miterPoint(self: MiterSide, other: MiterSide, d: number): Vec2 | null {
  const dd = pairDepth(self, other, d);
  const sA = sOfDepth(self, d);
  const sB = sOfDepth(other, dd);
  const r = intersectLines(add(self.o, mul(self.n, sA)), self.u, add(other.o, mul(other.n, sB)), other.u);
  return r ? r.point : null;
}

/** Lado do canto de uma extremidade: `sigma` escolhe qual face é a externa do canto (ver `sideOf`). */
export function sideFacing(r: EndRef, sigma: 1 | -1): MiterSide {
  const core = coreSpan(r.f.type);
  // A face externa do tipo fica em sHi quando sign>0. Se a face externa do canto coincide com ela, o núcleo
  // começa a `core.from` dela; senão, a face do canto é a interna do tipo e o núcleo termina a `T - core.to`.
  const cornerIsExterior = sigma > 0 === r.f.sign > 0;
  const outerToCore = Math.max(0, cornerIsExterior ? core.from : r.f.thickness - core.to);
  const u = r.which === 'a' ? r.dir : { x: -r.dir.x, y: -r.dir.y }; // tangente a→b NA extremidade
  const T = r.f.thickness;
  const cum = [0];
  for (const l of r.f.type.layers) cum.push(cum[cum.length - 1]! + l.thickness);
  const bounds = cornerIsExterior ? cum : cum.map((c) => T - c).reverse();
  const coreEnd = outerToCore + (core.to - core.from);
  return { o: r.o, u, n: perp(u), sHi: r.f.sHi, sLo: r.f.sLo, sigma, outerToCore, coreEnd, bounds };
}

/** Lado do canto voltado para o vizinho `towards`: a face externa do canto é a afastada dele. */
export function sideOf(r: EndRef, towards: Vec2): MiterSide {
  // Se o vizinho está à esquerda desta parede, a face externa do canto é a da direita (s menor).
  const sigma: 1 | -1 = dot(r.f.n, towards) > 0 ? -1 : 1;
  return sideFacing(r, sigma);
}

/** Mesma corte nas duas faces. */
export const both = (side: SideSpec): EndSpec => ({ hi: side, lo: side });
export const flatEnd = (t: number): EndSpec => both({ kind: 'flat', t });

export function setEnd(out: Map<string, WallEnds>, r: EndRef, spec: EndSpec): void {
  const e = out.get(r.f.wall.id);
  if (e) e[r.which] = spec;
}

export const sub2 = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x - q.x, y: p.y - q.y });
