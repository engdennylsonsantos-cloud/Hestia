import { cross, dist, dot, intersectSegments, sub, type Vec2 } from '@hestia/geom';
import type { ProfilePoint, Wall } from '@hestia/model';
import { roofThickness, roofTopAt, type ResolvedRoof } from './roofs.ts';

/** Altura mínima de uma parede sob o telhado (1 cm), como em wallZ. */
const MIN_HEIGHT = 0.01;
/** Afastamento (m) ao longo do eixo para medir um salto de cota dos dois lados de uma divisa. */
const DELTA = 1e-6;
/** Salto de cota (m) acima do qual a divisa é um degrau real (faces que não se encontram), não inclinação contínua. */
const STEP = 1e-3;
/** Tolerância (m) para um vértice de telhado contar como sobre o eixo da parede. */
const ON_AXIS = 1e-7;

/** Eixo da parede com os telhados que o cobrem: comprimento, pontos de quebra e face inferior do telhado em cada t. */
interface AxisRoofs {
  L: number;
  bps: number[];
  /** Face inferior do telhado sobre o ponto do eixo a distância t, ou null fora de todos os telhados. */
  bottomAt: (t: number) => number | null;
}

/** Eixo reto da parede contra os telhados dos níveis dela (base e topo). Parede curva ou de comprimento nulo, null. */
function axisRoofs(w: Wall, roofs: ResolvedRoof[]): AxisRoofs | null {
  const topLevel = w.topLevelId ?? w.levelId;
  // Com telhado escolhido (attachTopRoofId), só esse telhado conta; sem escolha, qualquer telhado do nível.
  const rs = roofs.filter((r) => (r.levelId === w.levelId || r.levelId === topLevel) && (!w.attachTopRoofId || r.roofId === w.attachTopRoofId));
  const L = dist(w.a, w.b);
  if (L < 1e-9) return null;
  const u = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L };
  const bottomAt = (t: number): number | null => {
    const p = { x: w.a.x + u.x * t, y: w.a.y + u.y * t };
    let z: number | null = null;
    for (const r of rs) {
      const top = roofTopAt(r, p);
      if (top === null) continue;
      const bottom = top - roofThickness(r);
      z = z === null ? bottom : Math.min(z, bottom);
    }
    return z;
  };
  return { L, bps: breakpoints(w, rs, L, u), bottomAt };
}

/**
 * Perfil superior de uma parede reta anexada ao telhado (decisão 0008, item 6): a cota do topo é a face INFERIOR do telhado
 * ao longo do eixo (cota da face superior menos a espessura total), relativa à base `baseZ`. Só o trecho do eixo coberto
 * pelo telhado segue o telhado; o trecho sem telhado fica na altura normal `normalTop` (absoluta), com um degrau no limite.
 * Amostras: extremos do eixo, cada divisa entre águas e cada borda do telhado que o eixo cruza, e um ponto médio entre duas
 * amostras seguidas. Entre telhados que cobrem o mesmo ponto vale a face inferior mais baixa. Sem nenhum trecho coberto,
 * null (a parede segue a altura normal). Parede curva não usa perfil.
 */
export function roofWallProfile(w: Wall, roofs: ResolvedRoof[], baseZ: number, normalTop: number): ProfilePoint[] | null {
  if (w.sag !== 0) return null;
  const ax = axisRoofs(w, roofs);
  if (!ax) return null;
  const { L, bps, bottomAt } = ax;
  const mids = bps.slice(0, -1).map((t, i) => (t + bps[i + 1]!) / 2);
  if (![...bps, ...mids].some((t) => bottomAt(t) !== null)) return null;
  const topAt = (t: number): number => bottomAt(t) ?? normalTop;
  const pt = (t: number, z: number): ProfilePoint => ({ t, h: Math.max(MIN_HEIGHT, z - baseZ) });
  const out: ProfilePoint[] = [];
  for (let i = 0; i < bps.length; i++) {
    const t = bps[i]!;
    const hv = topAt(t);
    if (t > 0 && t < L) {
      const jl = topAt(t - DELTA);
      const jr = topAt(t + DELTA);
      if (Math.abs(jl - jr) > STEP) {
        out.push(pt(t, jl), pt(t, jr));
        continue;
      }
    }
    out.push(pt(t, hv));
    const next = bps[i + 1];
    if (next !== undefined) {
      const m = (t + next) / 2;
      out.push(pt(m, topAt(m)));
    }
  }
  return out.length >= 2 ? out : null;
}

/** Cobertura do eixo de uma parede pelos telhados: comprimento, trecho sem telhado e menor face inferior coberta. */
export interface RoofAxisReport {
  length: number;
  /** Comprimento do eixo que não está sob telhado nenhum (m). */
  uncovered: number;
  /** Menor face inferior de telhado sobre o eixo coberto (cota absoluta); null sem telhado. */
  minBottom: number | null;
}

/** Relatório de cobertura do eixo (parede reta); null em parede curva ou de comprimento nulo. */
export function roofAxisReport(w: Wall, roofs: ResolvedRoof[]): RoofAxisReport | null {
  if (w.sag !== 0) return null;
  const ax = axisRoofs(w, roofs);
  if (!ax) return null;
  const { L, bps, bottomAt } = ax;
  let uncovered = 0;
  for (let i = 0; i + 1 < bps.length; i++) {
    const t0 = bps[i]!;
    const t1 = bps[i + 1]!;
    if (bottomAt((t0 + t1) / 2) === null) uncovered += t1 - t0;
  }
  // A face inferior é linear entre quebras, então o mínimo está numa quebra.
  let minBottom: number | null = null;
  for (const t of bps) {
    const z = bottomAt(t);
    if (z !== null) minBottom = minBottom === null ? z : Math.min(minBottom, z);
  }
  return { length: L, uncovered, minBottom };
}

/** Parâmetros t (0..L) onde o eixo cruza as bordas das águas e onde há vértices sobre ele, com os extremos. */
function breakpoints(w: Wall, rs: ResolvedRoof[], L: number, u: Vec2): number[] {
  const ts = new Set<number>([0, L]);
  const a = w.a;
  const b = w.b;
  for (const r of rs) {
    for (const pl of r.planes) {
      for (const poly of pl.polygon) {
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
  }
  const sorted = [...ts].filter((t) => t >= 0 && t <= L).sort((x, y) => x - y);
  return sorted.filter((t, i) => i === 0 || t - sorted[i - 1]! > 1e-9);
}
