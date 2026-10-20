import { asMulti, difference, dot, intersection, multiArea, orientedRect, sub, type MultiPolygon, type Vec2 } from '@hestia/geom';
import type { Roof, RoofProfilePoint } from '@hestia/model';
import { perpOf, unitOf, WATER_MIN_AREA } from './roofGeom.ts';
import type { ResolvedRoofPlane, RoofLine } from './roofs.ts';
import { presetArco, roofProfileError, shiftProfile } from './roofProfilePresets.ts';

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

/**
 * Linhas notáveis de um telhado por extrusão: as arestas do contorno são beirais; cada vértice interno do perfil
 * (dentro do contorno) gera uma linha paralela ao eixo: cumeeira se é máximo local, rincão (vale) se é mínimo local.
 * Vértice no meio de uma subida ou descida não gera linha. Furos cortam as linhas.
 */
export function extrusionLines(r: Roof): RoofLine[] {
  const n = r.boundary.length;
  const out: RoofLine[] = r.boundary.map((a, i) => ({ kind: 'eave', a, b: r.boundary[(i + 1) % n]! }));
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
