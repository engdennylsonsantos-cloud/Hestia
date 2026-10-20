import { arcSample, intersectSegments, ringArea, type Ring, type Vec2 } from '@hestia/geom';
import { layerSpans, type ProfilePoint } from '@hestia/model';
import { pointAt, sAtDepth, toLocal, type WallFrame } from './frame.ts';
import { miterBreaks, miterPoint } from './joinSides.ts';
import type { EndSpec, SideSpec, StepRun, WallEnds } from './joinTypes.ts';
import { clipBandsToProfile } from './profile.ts';
import type { Membrane, ResolvedLayer } from './types.ts';

const MIN_AREA = 1e-9;

/** Em paredes curvas, leva o ponto à circunferência da camada (os cortes usam a tangente: erro de milímetros). */
function onLayerCircle(f: WallFrame, p: Vec2, s: number): Vec2 {
  if (!f.arc) return p;
  const c = f.arc.center;
  const rho = f.arc.radius + f.arc.k * s;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const l = Math.hypot(dx, dy);
  return l < 1e-9 ? p : { x: c.x + (dx / l) * rho, y: c.y + (dy / l) * rho };
}

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

/** Ponto da extremidade em `s` segundo uma face (corte reto, esquadria contra o vizinho ou degraus por camada). */
function pointOnSide(f: WallFrame, which: 'a' | 'b', side: SideSpec, s: number, edge: 'low' | 'high' = 'low'): Vec2 {
  if (side.kind === 'flat') return pointAt(f, side.t, s);
  if (side.kind === 'steps') return pointAt(f, stepT(side.runs, s, edge), s);
  const d = side.self.sigma > 0 ? side.self.sHi - s : s - side.self.sLo;
  const p = miterPoint(side.self, side.other, Math.max(0, Math.min(d, side.self.sHi - side.self.sLo)));
  return p ? onLayerCircle(f, p, s) : pointAt(f, which === 'a' ? 0 : f.length, s);
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

/** Camada de parede curva: contorno com as bordas externa e interna amostradas ao longo do arco. */
function arcLayerRing(f: WallFrame, ends: WallEnds, lo: number, hi: number): Ring {
  const pa = [endPoint(f, 'a', ends.a, lo), endPoint(f, 'a', ends.a, hi)] as const;
  const pb = [endPoint(f, 'b', ends.b, lo), endPoint(f, 'b', ends.b, hi)] as const;
  const t = (p: Vec2): number => toLocal(f, p).t;
  const loPts = arcSample(f.arc!, t(pa[0]), t(pb[0]), lo);
  const hiPts = arcSample(f.arc!, t(pb[1]), t(pa[1]), hi);
  return [pa[0], ...loPts.slice(1, -1), pb[0], pb[1], ...hiPts.slice(1, -1), pa[1]];
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
