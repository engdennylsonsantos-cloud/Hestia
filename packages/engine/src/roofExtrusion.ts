import { asMulti, difference, dist, dot, intersection, multiArea, orientedRect, sub, type MultiPolygon, type Vec2 } from '@hestia/geom';
import type { Roof, RoofProfilePoint } from '@hestia/model';
import { perpOf, unitOf, WATER_MIN_AREA } from './roofGeom.ts';
import type { ResolvedRoofPlane, RoofLine } from './roofs.ts';
import { presetArco, profileZAt, roofProfileError, shiftProfile } from './roofProfilePresets.ts';

/**
 * Telhado por extrusão (A9, Revit: Roof by extrusion). O perfil `{t, z}` (z relativa à cota do beiral) é extrudado ao
 * longo de `dir`. Referencial: origem = boundary[0], `across` = perpendicular à esquerda de `dir`, t = dot(p − origem,
 * across) e s = dot(p − origem, dir). Cada trecho do perfil vira uma água; fora do intervalo de t do perfil a cota é a
 * do ponto mais próximo (faixas planas). A região é o contorno menos os furos.
 */

/** Tolerância de cota (m) abaixo da qual um trecho conta como horizontal. */
const ZERO_DZ = 1e-12;
/** Tolerância de posição (m) para a borda do contorno e para cordas de comprimento nulo. */
const TOL = 1e-9;

/** Referencial da extrusão de um contorno e de um eixo. */
export interface ExtrusionFrame {
  /** Primeiro vértice do contorno: t = s = 0. */
  origin: Vec2;
  /** Unitária, transversal (perpendicular à esquerda do eixo): t cresce nesta direção. */
  across: Vec2;
  /** Unitária, eixo da extrusão. */
  along: Vec2;
  /** Menor e maior t do contorno, a partir da origem (m). */
  tMin: number;
  tMax: number;
  /** Meio da faixa de s do contorno: referência das origens das águas. */
  sMid: number;
}

/** Referencial de um contorno e de um eixo, ou null sem eixo nulo ou com menos de 3 vértices. */
export function extrusionFrame(boundary: Vec2[], dir: Vec2): ExtrusionFrame | null {
  const along = unitOf(dir);
  if (!along || boundary.length < 3) return null;
  const origin = boundary[0]!;
  const across = perpOf(along);
  const ts = boundary.map((p) => dot(sub(p, origin), across));
  const ss = boundary.map((p) => dot(sub(p, origin), along));
  return { origin, across, along, tMin: Math.min(...ts), tMax: Math.max(...ts), sMid: (Math.min(...ss) + Math.max(...ss)) / 2 };
}

/** Ponto de coordenadas (t, s) no referencial. */
export const frameAt = (f: ExtrusionFrame, t: number, s: number): Vec2 => ({
  x: f.origin.x + f.across.x * t + f.along.x * s,
  y: f.origin.y + f.across.y * t + f.along.y * s,
});

/** Faixa do perfil entre t0 e t1, com cotas z0 e z1 nas bordas. */
interface Band {
  t0: number;
  t1: number;
  z0: number;
  z1: number;
}

/** Uma faixa por trecho do perfil, mais as duas extensões planas (além do primeiro e do último ponto, até passar do contorno). */
function bandsOf(pts: RoofProfilePoint[], f: ExtrusionFrame): Band[] {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const out: Band[] = [{ t0: f.tMin - 1, t1: first.t, z0: first.z, z1: first.z }];
  for (let i = 0; i + 1 < pts.length; i++) out.push({ t0: pts[i]!.t, t1: pts[i + 1]!.t, z0: pts[i]!.z, z1: pts[i + 1]!.z });
  out.push({ t0: last.t, t1: f.tMax + 1, z0: last.z, z1: last.z });
  return out.filter((b) => b.t1 - b.t0 > TOL);
}

/**
 * Plano de uma faixa. Sobe na transversal se a cota cresce (origem na borda t0); desce se cai (up = −transversal,
 * origem na borda t1). Horizontal: percentual 0 e up = transversal. z0 é a cota absoluta na origem.
 */
function planeOfBand(b: Band, f: ExtrusionFrame, eaveZ: number): Omit<ResolvedRoofPlane, 'polygon'> {
  const dz = b.z1 - b.z0;
  const span = b.t1 - b.t0;
  if (Math.abs(dz) < ZERO_DZ) return { origin: frameAt(f, b.t0, f.sMid), up: f.across, percent: 0, z0: eaveZ + b.z0 };
  if (dz > 0) return { origin: frameAt(f, b.t0, f.sMid), up: f.across, percent: (100 * dz) / span, z0: eaveZ + b.z0 };
  return { origin: frameAt(f, b.t1, f.sMid), up: { x: -f.across.x, y: -f.across.y }, percent: (-100 * dz) / span, z0: eaveZ + b.z1 };
}

/**
 * Águas de um telhado por extrusão: cada faixa do perfil recortada pelo contorno (menos os furos). Perfil inválido
 * ou eixo nulo devolvem nenhuma água. `eaveZ` é a cota absoluta do beiral.
 */
export function extrusionPlanes(r: Roof, eaveZ: number): ResolvedRoofPlane[] {
  if (roofProfileError(r.profile)) return [];
  const f = extrusionFrame(r.boundary, r.dir);
  if (!f) return [];
  // Retângulo da faixa maior que o contorno nos dois sentidos do eixo (com folga).
  const reach = 2 * Math.max(...r.boundary.map((p) => Math.hypot(p.x - f.origin.x, p.y - f.origin.y))) + 10;
  const outline = asMulti(r.boundary);
  const holes = r.holes.filter((h) => h.length >= 3).map((h): MultiPolygon => asMulti(h));
  const out: ResolvedRoofPlane[] = [];
  for (const b of bandsOf(r.profile, f)) {
    const c = frameAt(f, (b.t0 + b.t1) / 2, f.sMid);
    const strip = [[orientedRect(c.x, c.y, f.across.x, f.across.y, (b.t1 - b.t0) / 2, reach)]];
    let polygon = intersection(outline, strip);
    if (holes.length) polygon = difference(polygon, ...holes);
    if (multiArea(polygon) <= WATER_MIN_AREA) continue;
    out.push({ polygon, ...planeOfBand(b, f, eaveZ) });
  }
  return out;
}

/** Cordas da reta t = const dentro do contorno menos os furos (regra par-ímpar sobre todas as bordas). */
function chordsAt(r: Roof, f: ExtrusionFrame, t: number): Array<[Vec2, Vec2]> {
  const rings = [r.boundary, ...r.holes.filter((h) => h.length >= 3)];
  const ss: number[] = [];
  for (const ring of rings) {
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      const ta = dot(sub(a, f.origin), f.across);
      const tb = dot(sub(b, f.origin), f.across);
      if ((ta < t) === (tb < t)) return;
      const u = (t - ta) / (tb - ta);
      const p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      ss.push(dot(sub(p, f.origin), f.along));
    });
  }
  ss.sort((x, y) => x - y);
  const out: Array<[Vec2, Vec2]> = [];
  for (let k = 0; k + 1 < ss.length; k += 2) {
    if (ss[k + 1]! - ss[k]! > TOL) out.push([frameAt(f, t, ss[k]!), frameAt(f, t, ss[k + 1]!)]);
  }
  return out;
}

/** Sinal de uma variação de cota, com a tolerância de horizontal. */
const sgn = (x: number): number => (x > ZERO_DZ ? 1 : x < -ZERO_DZ ? -1 : 0);

/** Cosseno a partir do qual uma aresta é paralela ao eixo (mesma regra de 45° da forma 'gable', decisão 0008 item 9). */
const PARALLEL_COS = 0.7;
/** Altura (m) acima do beiral a partir da qual a seção de uma extremidade é frontão (empena). */
const SECTION_TOL = 1e-6;

/** Altura máxima (m, acima do beiral) do perfil entre t0 e t1: linear por trechos, então o máximo está numa borda ou num vértice. */
function sectionHeightOver(pts: RoofProfilePoint[], t0: number, t1: number): number {
  let h = Math.max(0, profileZAt(pts, t0), profileZAt(pts, t1));
  for (const q of pts) if (q.t > t0 && q.t < t1) h = Math.max(h, q.z);
  return h;
}

/**
 * Tipo de cada aresta do contorno de um telhado por extrusão. Aresta paralela ao eixo é beiral (a seção é a mesma ao
 * longo dela). Aresta que corta o eixo é a extremidade, onde a seção termina: empena (frontão) quando a seção tem altura
 * acima do beiral no trecho dela; senão beiral (perfil que termina rente à cota do beiral não tem frontão). Perfil
 * inválido ou eixo nulo: todas beirais, como não há água.
 */
export function extrusionEdgeKinds(r: Roof): Array<'eave' | 'gable'> {
  const n = r.boundary.length;
  const f = extrusionFrame(r.boundary, r.dir);
  if (!f || roofProfileError(r.profile)) return r.boundary.map(() => 'eave');
  return r.boundary.map((a, i) => {
    const b = r.boundary[(i + 1) % n]!;
    const len = dist(a, b);
    if (len < TOL) return 'eave';
    if (Math.abs(dot(sub(b, a), f.along)) / len > PARALLEL_COS) return 'eave';
    const ta = dot(sub(a, f.origin), f.across);
    const tb = dot(sub(b, f.origin), f.across);
    return sectionHeightOver(r.profile, Math.min(ta, tb), Math.max(ta, tb)) > SECTION_TOL ? 'gable' : 'eave';
  });
}

/** Integral de max(0, f) em [x0, x1], com f linear entre (x0, y0) e (x1, y1). */
function clippedLinearArea(x0: number, x1: number, y0: number, y1: number): number {
  const w = x1 - x0;
  if (w <= 0 || (y0 <= 0 && y1 <= 0)) return 0;
  if (y0 >= 0 && y1 >= 0) return (w * (y0 + y1)) / 2;
  // Um dos lados fica acima de zero: o trecho positivo é um triângulo, do zero até a ponta.
  const s = y0 / (y0 - y1);
  return y0 > 0 ? (w * s * y0) / 2 : (w * (1 - s) * y1) / 2;
}

/**
 * Área dos frontões de um telhado por extrusão (metros quadrados): para cada aresta de empena, a integral ao longo dela da altura da
 * seção acima do beiral. Como a altura só depende de t, a integral é feita em t e escalada pelo comprimento da aresta.
 */
export function extrusionGableArea(r: Roof): number {
  const f = extrusionFrame(r.boundary, r.dir);
  if (!f || roofProfileError(r.profile)) return 0;
  const n = r.boundary.length;
  const kinds = extrusionEdgeKinds(r);
  return r.boundary.reduce((sum, a, i) => {
    if (kinds[i] !== 'gable') return sum;
    const b = r.boundary[(i + 1) % n]!;
    const ta = dot(sub(a, f.origin), f.across);
    const tb = dot(sub(b, f.origin), f.across);
    const lo = Math.min(ta, tb);
    const hi = Math.max(ta, tb);
    if (hi - lo < TOL) return sum;
    const xs = [lo, ...r.profile.map((q) => q.t).filter((t) => t > lo && t < hi), hi];
    let area = 0;
    for (let k = 0; k + 1 < xs.length; k++) {
      area += clippedLinearArea(xs[k]!, xs[k + 1]!, profileZAt(r.profile, xs[k]!), profileZAt(r.profile, xs[k + 1]!));
    }
    return sum + (dist(a, b) / (hi - lo)) * area;
  }, 0);
}

/**
 * Linhas notáveis de um telhado por extrusão: as arestas do contorno são beirais (paralelas ao eixo) ou empenas (as
 * extremidades com seção acima do beiral, ver `extrusionEdgeKinds`); cada vértice interno do perfil (dentro do contorno)
 * gera uma linha paralela ao eixo: cumeeira se é máximo local, rincão (vale) se é mínimo local.
 * Vértice no meio de uma subida ou descida não gera linha. Furos cortam as linhas.
 */
export function extrusionLines(r: Roof): RoofLine[] {
  const n = r.boundary.length;
  const kinds = extrusionEdgeKinds(r);
  const out: RoofLine[] = r.boundary.map((a, i) => ({ kind: kinds[i]!, a, b: r.boundary[(i + 1) % n]! }));
  const f = extrusionFrame(r.boundary, r.dir);
  if (!f || roofProfileError(r.profile)) return out;
  const pts = r.profile;
  pts.forEach((q, i) => {
    if (!(q.t > f.tMin + TOL && q.t < f.tMax - TOL)) return;
    // Nas pontas, o lado de fora é a extensão plana (mesma cota).
    const sl = sgn(q.z - (i > 0 ? pts[i - 1]!.z : q.z));
    const sr = sgn((i + 1 < pts.length ? pts[i + 1]!.z : q.z) - q.z);
    let kind: RoofLine['kind'] | null = null;
    if (sl >= 0 && sr <= 0 && (sl > 0 || sr < 0)) kind = 'ridge';
    else if (sl <= 0 && sr >= 0 && (sl < 0 || sr > 0)) kind = 'valley';
    if (!kind) return;
    for (const [a, b] of chordsAt(r, f, q.t)) out.push({ kind, a, b });
  });
  return out;
}

/** Perfil padrão de um telhado por extrusão: arco de `flecha` m sobre a largura do contorno na transversal. */
export function defaultExtrusionProfile(boundary: Vec2[], dir: Vec2, flecha = 1): RoofProfilePoint[] {
  const f = extrusionFrame(boundary, dir);
  return f ? shiftProfile(presetArco(f.tMax - f.tMin, flecha), f.tMin) : [];
}
