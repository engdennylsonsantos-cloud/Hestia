import { arcSample, intersectSegments, ringArea, type Ring, type Vec2 } from '@hestia/geom';
import { layerSpans } from '@hestia/model';
import { pointAt, sAtDepth, toLocal, type WallFrame } from './frame.ts';
import { miterBreaks, miterPoint, type EndSpec, type WallEnds } from './joins.ts';
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

export function endPoint(f: WallFrame, which: 'a' | 'b', spec: EndSpec, s: number): Vec2 {
  if (spec.kind === 'flat') return pointAt(f, spec.t, s);
  const d = spec.self.sigma > 0 ? spec.self.sHi - s : s - spec.self.sLo;
  const p = miterPoint(spec.self, spec.other, Math.max(0, Math.min(d, spec.self.sHi - spec.self.sLo)));
  return p ? onLayerCircle(f, p, s) : pointAt(f, which === 'a' ? 0 : f.length, s);
}

/** Vértices intermediários da linha de esquadria entre as fronteiras s=lo e s=hi, em ordem crescente de s. */
function chainBetween(spec: EndSpec, lo: number, hi: number): Vec2[] {
  if (spec.kind !== 'miter') return [];
  const m = spec.self;
  const dOf = (s: number): number => (m.sigma > 0 ? m.sHi - s : s - m.sLo);
  const d1 = Math.min(dOf(lo), dOf(hi));
  const d2 = Math.max(dOf(lo), dOf(hi));
  const ds = miterBreaks(m, spec.other).filter((d) => d > d1 + 1e-7 && d < d2 - 1e-7);
  const pts = ds.flatMap((d) => {
    const p = miterPoint(m, spec.other, d);
    return p ? [{ d, p }] : [];
  });
  // s crescente = d decrescente quando a face externa do canto é a de s maior.
  pts.sort((x, y) => (m.sigma > 0 ? y.d - x.d : x.d - y.d));
  return pts.map((q) => q.p);
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
  const quad = [endPoint(f, 'a', ends.a, lo), endPoint(f, 'b', ends.b, lo), endPoint(f, 'b', ends.b, hi), endPoint(f, 'a', ends.a, hi)];
  if (isSimple(quad)) {
    // Em esquadria entre tipos diferentes a linha do canto tem quebras: a camada acompanha a cadeia inteira.
    const aMid = chainBetween(ends.a, lo, hi);
    const bMid = chainBetween(ends.b, lo, hi);
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

/** Perfil superior (só parede reta): recorta as faixas de cada camada pelo topo poligonal. */
export function withProfile(layers: ResolvedLayer[], f: WallFrame): ResolvedLayer[] {
  const pts = f.wall.topProfile;
  if (!pts || f.wall.sag !== 0 || pts.length < 2) return layers;
  return layers.map((l) => ({ ...l, bands: clipBandsToProfile(l.bands, f.a, f.u, f.length, pts) }));
}

