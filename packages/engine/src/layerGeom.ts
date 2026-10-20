import { intersectSegments, ringArea, type Ring, type Vec2 } from '@hestia/geom';
import { layerSpans, type ProfilePoint } from '@hestia/model';
import { pointAt, sAtDepth, toLocal, type WallFrame } from './frame.ts';
import { miterBreaks, miterPoint } from './joinSides.ts';
import type { EndSpec, SideSpec, StepRun, WallEnds } from './joinTypes.ts';
import { clipBandsToProfile } from './profile.ts';
import type { Membrane, ResolvedLayer } from './types.ts';

const MIN_AREA = 1e-9;
/**
 * Passo (m, em t) do grid que amostra as faces de arco. Global ao arco: duas camadas que dividem a mesma face recebem
 * os mesmos vértices. Flecha de corda ≤ 0,2 mm para raios ≥ 1,4 m.
 */
const ARC_GRID = 0.04;

/** Face da extremidade que vale para `s`: a metade de s maior usa `hi`, a de s menor usa `lo`. */
export const sideAt = (f: WallFrame, spec: EndSpec, s: number): SideSpec => (s >= f.sMid ? spec.hi : spec.lo);

/** Posição do corte de uma faixa na espessura `s` (linear entre `t` e `t1` quando a faixa é oblíqua). */
export function runT(r: StepRun, s: number): number {
  if (r.t1 === undefined || r.s1 === undefined || r.s1 === r.s) return r.t;
  const f = (s - r.s) / (r.s1 - r.s);
  if (f <= 0) return r.t;
  if (f >= 1) return r.t1;
  return r.t + (r.t1 - r.t) * f;
}

/**
 * Posição do corte em degraus para a espessura `s`. `edge` diz qual borda da faixa está sendo cortada: a de baixo
 * (`low`, faixa que começa em `s`) ou a de cima (`high`, faixa que termina em `s`) — as duas camadas que dividem a
 * mesma fronteira têm cortes diferentes, e é justamente esse degrau que o pareamento por face usa.
 */
function stepT(runs: readonly StepRun[], s: number, edge: 'low' | 'high'): number {
  let run = runs[0]!;
  for (const r of runs) {
    if (edge === 'low' ? r.s > s + 1e-12 : r.s >= s - 1e-12) break;
    run = r;
  }
  return runT(run, s);
}

/**
 * Ponto da extremidade em `s` segundo uma face (corte reto, esquadria contra o vizinho ou degraus por camada). Em arco a
 * esquadria é a interseção exata da circunferência com a face do vizinho (`crossAt`), então o ponto não precisa de
 * correção: é o mesmo que o vizinho calcula para o mesmo canto.
 */
function pointOnSide(f: WallFrame, which: 'a' | 'b', side: SideSpec, s: number, edge: 'low' | 'high' = 'low'): Vec2 {
  if (side.kind === 'flat') return pointAt(f, side.t, s);
  if (side.kind === 'steps') return pointAt(f, stepT(side.runs, s, edge), s);
  const d = side.self.sigma > 0 ? side.self.sHi - s : s - side.self.sLo;
  const p = miterPoint(side.self, side.other, Math.max(0, Math.min(d, side.self.sHi - side.self.sLo)));
  return p ?? pointAt(f, which === 'a' ? 0 : f.length, s);
}

export function endPoint(f: WallFrame, which: 'a' | 'b', spec: EndSpec, s: number): Vec2 {
  return pointOnSide(f, which, sideAt(f, spec, s), s);
}

/** Vértices intermediários da linha de uma face entre s=lo e s=hi, em ordem crescente de s. */
function sideChain(f: WallFrame, side: SideSpec, lo: number, hi: number): Vec2[] {
  if (side.kind === 'steps') {
    // Cada troca de faixa é um degrau: o vértice de baixo (fim do corte anterior) e o de cima (início do seguinte).
    const out: Vec2[] = [];
    for (let i = 1; i < side.runs.length; i++) {
      const r = side.runs[i]!;
      if (r.s <= lo + 1e-9 || r.s >= hi - 1e-9) continue;
      out.push(pointAt(f, runT(side.runs[i - 1]!, r.s), r.s), pointAt(f, r.t, r.s));
    }
    return out;
  }
  if (side.kind !== 'miter') return [];
  const m = side.self;
  const dOf = (s: number): number => (m.sigma > 0 ? m.sHi - s : s - m.sLo);
  const d1 = Math.min(dOf(lo), dOf(hi));
  const d2 = Math.max(dOf(lo), dOf(hi));
  const ds = miterBreaks(m, side.other).filter((d) => d > d1 + 1e-7 && d < d2 - 1e-7);
  const pts = ds.flatMap((d) => {
    const p = miterPoint(m, side.other, d);
    return p ? [{ d, p }] : [];
  });
  // s crescente = d decrescente quando a face externa do canto é a de s maior.
  pts.sort((x, y) => (m.sigma > 0 ? y.d - x.d : x.d - y.d));
  return pts.map((q) => q.p);
}

/**
 * Linha da extremidade entre s=lo e s=hi (crescente), incluindo as pontas. A faixa da metade de s menor usa `lo`, a
 * de s maior usa `hi`; uma camada que cruza o meio parte ali (dois pontos coincidentes são fundidos).
 */
function endPolyline(f: WallFrame, which: 'a' | 'b', spec: EndSpec, lo: number, hi: number): Vec2[] {
  const piece = (side: SideSpec, a: number, b: number): Vec2[] => [
    pointOnSide(f, which, side, a, 'low'),
    ...sideChain(f, side, a, b),
    pointOnSide(f, which, side, b, 'high'),
  ];
  if (spec.hi === spec.lo) return piece(spec.hi, lo, hi);
  const mid = f.sMid;
  if (hi <= mid) return piece(spec.lo, lo, hi);
  if (lo >= mid) return piece(spec.hi, lo, hi);
  const out = [...piece(spec.lo, lo, mid), ...piece(spec.hi, mid, hi)];
  return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1]!.x, p.y - out[i - 1]!.y) > 1e-9);
}

function isSimple(q: Ring): boolean {
  return Math.abs(ringArea(q)) >= MIN_AREA && !crossing(q);
}

/** Quadrilátero com arestas opostas cruzadas = camada "torcida" por esquadro mal condicionado. */
function crossing(q: Ring): boolean {
  const hit = (i: number, j: number): boolean => {
    const p = intersectSegments(q[i]!, q[(i + 1) % 4]!, q[j]!, q[(j + 1) % 4]!);
    if (!p) return false;
    // Tocar num vértice compartilhado não é cruzamento.
    return !q.some((v) => Math.abs(v.x - p.x) < 1e-9 && Math.abs(v.y - p.y) < 1e-9);
  };
  return hit(0, 2) || hit(1, 3);
}

/**
 * Vértices de uma face de arco à profundidade `s`, ordenados por t: as pontas que qualquer camada dessa face pode usar
 * (os dois lados, faixas alta e baixa) e um grid global de comprimento. Duas camadas que dividem a face leem a mesma
 * lista, então as cordas da borda comum são idênticas dos dois lados.
 */
function arcBoundary(f: WallFrame, ends: WallEnds, s: number): Array<{ t: number; p: Vec2 }> {
  const pts: Vec2[] = [];
  for (const which of ['a', 'b'] as const) {
    const spec = ends[which];
    for (const side of [spec.lo, spec.hi]) for (const edge of ['low', 'high'] as const) pts.push(pointOnSide(f, which, side, s, edge));
  }
  const ts = pts.map((p) => toLocal(f, p).t);
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const out = pts.map((p, i) => ({ t: ts[i]!, p }));
  for (let k = Math.ceil(tMin / ARC_GRID); k * ARC_GRID < tMax; k++) {
    const t = k * ARC_GRID;
    if (t > tMin) out.push({ t, p: pointAt(f, t, s) });
  }
  out.sort((x, y) => x.t - y.t);
  return out.filter((q, i) => i === 0 || q.t - out[i - 1]!.t > 1e-9);
}

/** Vértices intermediários da face de arco à profundidade `s`, de `from` até `to` (pontas excluídas). */
function arcEdge(f: WallFrame, ends: WallEnds, s: number, from: Vec2, to: Vec2): Vec2[] {
  const t0 = toLocal(f, from).t;
  const t1 = toLocal(f, to).t;
  const lo = Math.min(t0, t1) + 1e-9;
  const hi = Math.max(t0, t1) - 1e-9;
  const inside = arcBoundary(f, ends, s).filter((q) => q.t > lo && q.t < hi).map((q) => q.p);
  return t0 <= t1 ? inside : inside.reverse();
}

/**
 * Camada de parede curva: o contorno segue as cadeias das duas extremidades (com as quebras de esquadria e os degraus
 * de cada face, como na reta) e as faces de arco entre elas, pelo mesmo grid de `arcBoundary`.
 */
function arcLayerRing(f: WallFrame, ends: WallEnds, lo: number, hi: number): Ring {
  const aLine = endPolyline(f, 'a', ends.a, lo, hi);
  const bLine = endPolyline(f, 'b', ends.b, lo, hi);
  const aLo = aLine[0]!;
  const aHi = aLine[aLine.length - 1]!;
  const bLo = bLine[0]!;
  const bHi = bLine[bLine.length - 1]!;
  return [aLo, ...arcEdge(f, ends, lo, aLo, bLo), ...bLine, ...arcEdge(f, ends, hi, bHi, aHi), ...aLine.slice(1).reverse()];
}

export function layerQuad(f: WallFrame, ends: WallEnds, s1: number, s2: number): Ring {
  const lo = Math.min(s1, s2);
  const hi = Math.max(s1, s2);
  if (f.arc) return arcLayerRing(f, ends, lo, hi);
  const aLine = endPolyline(f, 'a', ends.a, lo, hi);
  const bLine = endPolyline(f, 'b', ends.b, lo, hi);
  const quad = [aLine[0]!, bLine[0]!, bLine[bLine.length - 1]!, aLine[aLine.length - 1]!];
  if (isSimple(quad)) {
    // Em esquadria entre tipos diferentes a linha do canto tem quebras: a camada acompanha a cadeia inteira.
    const aMid = aLine.slice(1, -1);
    const bMid = bLine.slice(1, -1);
    return aMid.length || bMid.length ? [quad[0]!, quad[1]!, ...bMid, quad[2]!, quad[3]!, ...aMid.reverse()] : quad;
  }
  return [pointAt(f, 0, lo), pointAt(f, f.length, lo), pointAt(f, f.length, hi), pointAt(f, 0, hi)];
}

/** Membranas (camadas de espessura zero) como linhas entre as extremidades já esquadrejadas. */
export function membranesOf(f: WallFrame, ends: WallEnds): Membrane[] {
  if (f.arc) return [];
  return layerSpans(f.type)
    .filter((sp) => sp.layer.thickness < 1e-6)
    .map((sp) => {
      const s = sAtDepth(f, sp.from);
      return { layerIndex: sp.index, materialId: sp.layer.materialId, pts: [endPoint(f, 'a', ends.a, s), endPoint(f, 'b', ends.b, s)] };
    });
}

/** Perfil superior (só parede reta): recorta as faixas de cada camada pelo topo poligonal (do modelo ou do telhado). */
export function withProfile(layers: ResolvedLayer[], f: WallFrame, pts: ProfilePoint[] | null | undefined = f.wall.topProfile): ResolvedLayer[] {
  if (!pts || f.wall.sag !== 0 || pts.length < 2) return layers;
  return layers.map((l) => ({ ...l, bands: clipBandsToProfile(l.bands, f.a, f.u, f.length, pts) }));
}
