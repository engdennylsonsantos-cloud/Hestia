import { coreSpan, layerPriority, layerSpans } from '@hestia/model';
import { add, dot, mul, perp, type Vec2 } from '@hestia/geom';
import { faceCurve, intersectCurves, sAtDepth, toLocal, type Curve, type WallFrame } from './frame.ts';
import type { EndRef, EndSpec, MiterSide, SideSpec, StepRun, WallEnds } from './joinTypes.ts';

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

/** Face da extremidade à profundidade `s`: reta pelo nó (paralela ao eixo) ou circunferência no arco. */
const faceOfSide = (m: MiterSide, s: number): Curve =>
  m.arc ? { kind: 'circle', c: m.arc.center, r: m.arc.radius + m.arc.k * s } : { kind: 'line', p: add(m.o, mul(m.n, s)), d: m.u };

/**
 * Interseção da face da `self` em `sA` com a face da `other` em `sB` (coordenadas s de cada parede). Exata também em
 * arco: a face de arco é a circunferência, e a interseção mais próxima do nó é a do canto.
 */
export function crossAt(self: MiterSide, sA: number, other: MiterSide, sB: number): Vec2 | null {
  return intersectCurves(faceOfSide(self, sA), faceOfSide(other, sB), self.o);
}

/** Ponto da aresta de fim da camada, na fronteira à profundidade `d` (medida da face externa do canto). */
export function miterPoint(self: MiterSide, other: MiterSide, d: number): Vec2 | null {
  return crossAt(self, sOfDepth(self, d), other, sOfDepth(other, pairDepth(self, other, d)));
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
  const arc = r.f.arc ? { center: r.f.arc.center, radius: r.f.arc.radius, k: r.f.arc.k } : null;
  return { o: r.o, u, n: perp(u), sHi: r.f.sHi, sLo: r.f.sLo, sigma, outerToCore, coreEnd, bounds, arc };
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

/**
 * Corte em degraus que pareia camada com camada (docs/08 §5.4, passos 2 e 3). As quebras de profundidade são as
 * mesmas da esquadria (`miterBreaks`), então os dois lados do canto produzem os mesmos vértices. Cada faixa corta ao
 * longo de uma face da vizinha, à profundidade pareada de uma das suas fronteiras: `low` (a faixa fica com a célula
 * do canto — é a parede que domina a junção) ou `high` (a faixa para na face da vizinha). A 90° esse corte é
 * perpendicular ao eixo; em ângulo ele acompanha a face oblíqua da vizinha, sem deixar triângulo vazio.
 *
 * É a versão em degraus da diagonal da esquadria: onde ela corta em ângulo, aqui cada camada para numa face de
 * camada do vizinho. Devolve null quando o ponto pareado cai fora do limite em volta da ponta (junção mal
 * condicionada) — quem chama decide o corte alternativo.
 */
export function stairSpec(r: EndRef, self: MiterSide, other: MiterSide, edge: 'low' | 'high', cap: number): SideSpec | null {
  const T = self.sHi - self.sLo;
  const breaks = [0, ...miterBreaks(self, other), T];
  const endT = r.which === 'a' ? 0 : r.f.length;
  const ok = (t: number | null): t is number => t !== null && Number.isFinite(t) && Math.abs(t - endT) <= cap;
  const runs: StepRun[] = [];
  for (let k = 0; k < breaks.length - 1; k++) {
    const d0 = breaks[k]!;
    const d1 = breaks[k + 1]!;
    // A faixa corta ao longo da face da outra parede, à profundidade pareada da borda que a limita (`low`: d0;
    // `high`: d1). Os dois pontos da faixa ficam nessa mesma linha: a 90° ela é perpendicular ao eixo, como antes.
    const dEdge = Math.max(0, Math.min(edge === 'low' ? d0 : d1, T));
    const sOther = sOfDepth(other, pairDepth(self, other, dEdge));
    const tAtS = (s: number): number | null => {
      const p = crossAt(self, s, other, sOther);
      return p ? toLocal(r.f, p).t : null;
    };
    const sA = sOfDepth(self, d0);
    const sB = sOfDepth(self, d1);
    const sLow = Math.min(sA, sB);
    const sHigh = Math.max(sA, sB);
    const tEdge = tAtS(edge === 'low' ? sA : sB);
    const tLow = tAtS(sLow);
    const tHigh = tAtS(sHigh);
    if (!ok(tEdge) || !ok(tLow) || !ok(tHigh)) return null;
    // Faixa que corta a face de arco da outra parede: a corda entre os dois pontos fica registrada em `on`.
    if (Math.abs(tHigh - tLow) < 1e-9 && !other.arc) runs.push({ s: sLow, t: tEdge, on: sOther });
    else runs.push({ s: sLow, s1: sHigh, t: tLow, t1: tHigh, on: sOther });
  }
  runs.sort((x, y) => x.s - y.s);
  return runs.length ? { kind: 'steps', runs } : null;
}

/**
 * Ponta do ramal encostado na parede que passa (docs/08 §5.4 passo 3): cada camada do ramal para na face da camada
 * correspondente da hospedeira — a primeira que ele encontra, vinda da face do lado em que está, com prioridade igual
 * ou mais forte. Antes a ponta ia até a linha de centro, e o núcleo da hospedeira comia o acabamento do ramal.
 * Hospedeira ou ramal curvos: a face é a circunferência do arco e a ponta é a interseção exata com ela.
 */
export function buttAgainst(r: EndRef, host: WallFrame): SideSpec | null {
  const loc = toLocal(host, r.o);
  const fromHi = loc.s >= host.sMid;
  const nearS = fromHi ? host.sHi : host.sLo;
  const spans = layerSpans(host.type).filter((sp) => sp.layer.thickness >= 1e-6);
  const distanceOf = (s: number): number => Math.abs(nearS - s);
  // Distância da face encontrada até a face mais próxima da camada com prioridade igual ou mais forte.
  const faceFor = (priority: number): number => {
    let best = host.thickness;
    for (const sp of spans) {
      if (layerPriority(sp.layer) > priority) continue;
      const d = Math.min(distanceOf(sAtDepth(host, sp.from)), distanceOf(sAtDepth(host, sp.to)));
      if (d < best) best = d;
    }
    return best;
  };
  // Posição na extremidade do ramal, limitada como antes (o corte não sai do ramal).
  const clampT = (t: number): number => (r.which === 'a' ? Math.min(t, r.f.length - 0.01) : Math.max(t, 0.01));
  const axis: Curve = { kind: 'line', p: r.o, d: r.dir };
  const runs: StepRun[] = [];
  for (const sp of layerSpans(r.f.type)) {
    if (sp.layer.thickness < 1e-6) continue;
    const d = faceFor(layerPriority(sp.layer));
    const faceS = fromHi ? nearS - d : nearS + d;
    const face = faceCurve(host, faceS);
    // A face da hospedeira corta a camada do ramal nas duas bordas dela (s menor e s maior): o corte é oblíquo quando
    // o ramal não é perpendicular à hospedeira (T oblíquo), e reto (o mesmo ponto do eixo) quando é.
    const sLo = Math.min(sAtDepth(r.f, sp.from), sAtDepth(r.f, sp.to));
    const sHi = Math.max(sAtDepth(r.f, sp.from), sAtDepth(r.f, sp.to));
    const tOn = (c: Curve): number | null => {
      const q = intersectCurves(face, c, r.o);
      return q ? toLocal(r.f, q).t : null;
    };
    const tLo = tOn(faceCurve(r.f, sLo));
    const tHi = tOn(faceCurve(r.f, sHi));
    if (tLo === null || tHi === null || !Number.isFinite(tLo) || !Number.isFinite(tHi)) return null;
    if (!r.f.arc && !host.arc && Math.abs(tHi - tLo) < 1e-9) {
      const tAxis = tOn(axis);
      if (tAxis === null || !Number.isFinite(tAxis)) return null;
      runs.push({ s: sLo, t: clampT(tAxis), on: faceS });
    } else runs.push({ s: sLo, s1: sHi, t: clampT(tLo), t1: clampT(tHi), on: faceS });
  }
  if (runs.length === 0) return null;
  runs.sort((x, y) => x.s - y.s);
  return { kind: 'steps', runs };
}
