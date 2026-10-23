import { arcPointAt, cross, dot, intersectSegments, pointInMulti, sub, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { slabRiseAt, wallArc, type Id, type Wall } from '@hestia/model';
import type { ResolvedFloor } from './floors.ts';
import type { ResolvedSlab } from './slabs.ts';

/** Folga mínima para uma parede anexada continuar com altura (1 cm). */
export const MIN_HEIGHT = 0.01;

/** Tolerância para considerar o ponto médio exatamente sobre a borda de um contorno (m). */
const ON_EDGE_EPS = 1e-7;
/** Tolerância (m) para um vértice do contorno contar como sobre o eixo reto. */
const ON_AXIS = 1e-7;
/** Trechos mais curtos que isto (m) são fundidos ao vizinho (quebra numérica). */
const MIN_TRECHO = 1e-9;

/** Trecho do eixo entre dois t (m, a partir da origem da parede) e o ponto médio do trecho na planta. */
export interface Trecho {
  t0: number;
  t1: number;
  mid: Vec2;
}

/**
 * Trecho do eixo com a cota da base e do topo que os anexos dão a ele. `onBottom` / `onTop`: o elemento (piso ou laje)
 * que cobre o trecho foi aplicado; falso = a cota do modelo (base ou altura normal).
 */
export interface AttachSpan {
  t0: number;
  t1: number;
  bottom: number;
  top: number;
  onBottom: boolean;
  onTop: boolean;
}

/** Distância do ponto ao segmento [a, b]. */
function distToSegment(pt: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

/** O ponto cai sobre a borda do anel (a menos de `ON_EDGE_EPS`). */
function onRing(pt: Vec2, r: Ring): boolean {
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (distToSegment(pt, r[j]!, r[i]!) <= ON_EDGE_EPS) return true;
  }
  return false;
}

/**
 * O ponto é coberto pelo contorno (piso ou laje)? Além do teste de interior (`pointInMulti`), trata o ponto sobre a
 * borda como coberto: o ray-casting de `pointInRing` é ambíguo exatamente sobre a borda (o resultado depende do lado em
 * que o ponto cai — defeito 6.1 de docs/projetos/casa-alto-padrao/C-montagem.md). Aqui a decisão fica consistente nos
 * quatro lados, sem alterar o `pointInRing`/`pointInMulti` do geom, que seguem com o comportamento padrão.
 */
export function covered(at: Vec2, m: MultiPolygon): boolean {
  if (pointInMulti(at, m)) return true;
  for (const poly of m) for (const ring of poly) if (onRing(at, ring)) return true;
  return false;
}

/** Ponto médio do eixo: no arco, o ponto do meio do comprimento do arco. */
export function axisMid(w: Wall): Vec2 {
  const arc = wallArc(w);
  if (arc) return arcPointAt(arc, arc.length / 2);
  return { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
}

/**
 * Faces superior e inferior (cotas absolutas) de pisos e lajes do nível que cobrem o ponto. Vale a região de cada
 * camada com volume (decisão 0025): onde o término esvazia as camadas contra a parede, o ponto do eixo não é coberto por
 * elas, e a parede continua pelo vazio até a primeira camada que cobre. Sem término, todas as camadas têm o mesmo
 * contorno e o resultado é o do elemento inteiro.
 */
export function facesAt(levelId: Id, at: Vec2, floors: ResolvedFloor[], slabs: ResolvedSlab[]): { tops: number[]; bottoms: number[] } {
  const tops: number[] = [];
  const bottoms: number[] = [];
  const add = (layers: readonly { z0: number; z1: number; membrane: boolean; polygon: MultiPolygon }[], rise: number): void => {
    const hit = layers.filter((l) => !l.membrane && l.z1 > l.z0 && covered(at, l.polygon));
    if (hit.length === 0) return;
    tops.push(Math.max(...hit.map((l) => l.z1)) + rise);
    bottoms.push(Math.min(...hit.map((l) => l.z0)) + rise);
  };
  for (const f of floors) {
    if (f.levelId !== levelId || !covered(at, f.polygon)) continue;
    add(f.layers, 0);
  }
  for (const s of slabs) {
    if (s.levelId !== levelId || !covered(at, s.polygon)) continue;
    // Lajes inclinadas: as faces sobem juntas, então a cota vale no ponto (topo ou base da origem + subida).
    add(s.layers, slabRiseAt(s.slope, at));
  }
  return { tops, bottoms };
}

/** Polígonos (pisos e lajes, contorno e camadas) do nível, em planta: onde o eixo muda de cobertura. */
export function polygonsOfLevel(levelId: Id, floors: ResolvedFloor[], slabs: ResolvedSlab[]): MultiPolygon[] {
  const own = [...floors.filter((f) => f.levelId === levelId), ...slabs.filter((s) => s.levelId === levelId)];
  return own.flatMap((e) => [e.polygon, ...e.layers.map((l) => l.polygon).filter((m) => m !== e.polygon)]);
}

/**
 * Trechos do eixo para a cobertura por piso e laje. Parede reta: o eixo é cortado nos pontos em que ele cruza uma
 * borda dos contornos e nos vértices que caem sobre ele, então dentro de cada trecho a cobertura é uniforme. Parede
 * curva (ou de comprimento nulo): um trecho só, com o ponto médio do arco (como antes).
 */
export function axisTrechos(w: Wall, polys: MultiPolygon[]): Trecho[] {
  const a = w.a;
  const b = w.b;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (w.sag !== 0 || L < MIN_TRECHO) {
    const len = wallArc(w)?.length ?? L;
    return [{ t0: 0, t1: len, mid: axisMid(w) }];
  }
  const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  const ts = new Set<number>([0, L]);
  for (const m of polys) {
    for (const poly of m) {
      for (const ring of poly) {
        ring.forEach((c, i) => {
          const d = ring[(i + 1) % ring.length]!;
          const x = intersectSegments(a, b, c, d);
          if (x) ts.add(dot(sub(x, a), u));
          if (Math.abs(cross(u, sub(c, a))) < ON_AXIS) ts.add(dot(sub(c, a), u));
        });
      }
    }
  }
  const sorted = [...ts].filter((t) => t >= 0 && t <= L).sort((x, y) => x - y);
  const cuts = sorted.filter((t, i) => i === 0 || t - sorted[i - 1]! > MIN_TRECHO);
  const out: Trecho[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const t0 = cuts[i]!;
    const t1 = cuts[i + 1]!;
    const tm = (t0 + t1) / 2;
    out.push({ t0, t1, mid: { x: a.x + u.x * tm, y: a.y + u.y * tm } });
  }
  return out.length ? out : [{ t0: 0, t1: L, mid: axisMid(w) }];
}

/**
 * Cota da base e do topo de cada trecho do eixo (decisão 0023 §6 e P9). Base: a face superior do piso ou laje do nível
 * que cobre o trecho (entre vários, a mais alta) e, sem cobertura, a cota do modelo (`base`). Topo: a face inferior do
 * elemento do nível de topo que cobre o trecho (a mais baixa), ou a altura normal (`top0`). Cada trecho usa a cota do
 * elemento na posição do seu ponto médio. Uma cota que deixaria a parede sem altura (menos de 1 cm) é ignorada.
 */
export function attachSpans(
  w: Wall,
  base: number,
  top0: number,
  bottomLevel: Id | null,
  topLevel: Id | null,
  floors: ResolvedFloor[],
  slabs: ResolvedSlab[],
): AttachSpan[] {
  const polys = [...(bottomLevel ? polygonsOfLevel(bottomLevel, floors, slabs) : []), ...(topLevel ? polygonsOfLevel(topLevel, floors, slabs) : [])];
  return axisTrechos(w, polys).map((tr) => {
    let bottom = base;
    let onBottom = false;
    if (bottomLevel) {
      const tops = facesAt(bottomLevel, tr.mid, floors, slabs).tops;
      if (tops.length > 0) {
        const z = Math.max(...tops);
        if (z < top0 - MIN_HEIGHT) {
          bottom = z;
          onBottom = true;
        }
      }
    }
    let top = top0;
    let onTop = false;
    if (topLevel) {
      const bottoms = facesAt(topLevel, tr.mid, floors, slabs).bottoms;
      if (bottoms.length > 0) {
        const z = Math.min(...bottoms);
        if (z > bottom + MIN_HEIGHT) {
          top = z;
          onTop = true;
        }
      }
    }
    return { t0: tr.t0, t1: tr.t1, bottom, top, onBottom, onTop };
  });
}
