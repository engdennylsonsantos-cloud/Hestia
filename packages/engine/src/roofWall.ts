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

/**
 * Perfil superior de uma parede reta sob telhado (decisão 0008, item 6): a cota do topo é a face INFERIOR do telhado
 * ao longo do eixo (cota da face superior menos a espessura total do telhado), relativa à base da parede `baseZ`.
 * Amostras: extremos do eixo, cada divisa entre águas e cada borda do telhado que o eixo cruza, e um ponto médio entre
 * duas amostras seguidas. Entre telhados que cobrem o mesmo ponto vale a face inferior mais baixa. Só vale se o eixo
 * estiver coberto em toda a extensão: qualquer trecho sem telhado devolve null e a parede mantém a altura normal.
 * Parede curva não usa perfil.
 */
export function roofWallProfile(w: Wall, roofs: ResolvedRoof[], baseZ: number): ProfilePoint[] | null {
  if (w.sag !== 0) return null;
  const topLevel = w.topLevelId ?? w.levelId;
  const rs = roofs.filter((r) => r.levelId === w.levelId || r.levelId === topLevel);
  const L = dist(w.a, w.b);
  if (rs.length === 0 || L < 1e-9) return null;
  const u = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L };
  const at = (t: number): Vec2 => ({ x: w.a.x + u.x * t, y: w.a.y + u.y * t });
  /** Face inferior do telhado sobre o ponto do eixo a distância t, ou null fora de todos os telhados. */
  const bottomAt = (t: number): number | null => {
    const p = at(t);
    let z: number | null = null;
    for (const r of rs) {
      const top = roofTopAt(r, p);
      if (top === null) continue;
      const bottom = top - roofThickness(r);
      z = z === null ? bottom : Math.min(z, bottom);
    }
    return z;
  };

  const bps = breakpoints(w, rs, L, u);
  const out: ProfilePoint[] = [];
  const pt = (t: number, z: number): ProfilePoint => ({ t, h: Math.max(MIN_HEIGHT, z - baseZ) });
  for (let i = 0; i < bps.length; i++) {
    const t = bps[i]!;
    const hv = bottomAt(t);
    if (hv === null) return null;
    if (t > 0 && t < L) {
      const jl = bottomAt(t - DELTA);
      const jr = bottomAt(t + DELTA);
      if (jl === null || jr === null) return null;
      if (Math.abs(jl - jr) > STEP) {
        out.push(pt(t, jl), pt(t, jr));
        continue;
      }
    }
    out.push(pt(t, hv));
    const next = bps[i + 1];
    if (next !== undefined) {
      const m = (t + next) / 2;
      const hm = bottomAt(m);
      if (hm === null) return null;
      out.push(pt(m, hm));
    }
  }
  return out.length >= 2 ? out : null;
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
