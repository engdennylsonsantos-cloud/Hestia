import { dist, dot, type Vec2 } from '@hestia/geom';
import { toLocal, type WallFrame } from './frame.ts';
import type { EndRef, MiterSide, SideSpec, WallEnds } from './joinTypes.ts';
import { both, miterPoint, setEnd, sideOf, sub2 } from './joinSides.ts';

const MITER_LIMIT = 6;

/** Ponto em que o eixo do ramal (tangente na extremidade) encontra a linha de centro da parede atravessada. */
export function centerlineHit(branch: EndRef, through: WallFrame): Vec2 | null {
  const o = branch.o;
  const d = branch.dir;
  if (!through.arc) {
    const den = dot(d, through.n);
    if (Math.abs(den) < 0.05) return null;
    const lam = (through.sMid - dot(sub2(o, through.a), through.n)) / den;
    return { x: o.x + d.x * lam, y: o.y + d.y * lam };
  }
  // Círculo da linha de centro: |o + λd − C|² = ρ².
  const rho = through.arc.radius + through.arc.k * through.sMid;
  const w = sub2(o, through.arc.center);
  const bq = dot(w, d);
  const disc = bq * bq - (dot(w, w) - rho * rho);
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const l1 = -bq - sq;
  const l2 = -bq + sq;
  const lam = Math.abs(l1) <= Math.abs(l2) ? l1 : l2;
  return { x: o.x + d.x * lam, y: o.y + d.y * lam };
}

/** Ramal que termina no meio de outra parede: o fim vai até a linha de centro da parede atravessada. */
export function toCenterline(branch: EndRef, through: WallFrame): SideSpec | null {
  const hit = centerlineHit(branch, through);
  if (!hit) return null;
  const t = toLocal(branch.f, hit).t;
  if (branch.which === 'a') return { kind: 'flat', t: Math.min(t, branch.f.length - 0.01) };
  return { kind: 'flat', t: Math.max(t, 0.01) };
}

/** Corte reto afastado `ext` do eixo, para a extremidade ficar além do canto. */
const flatAt = (r: EndRef, ext: number): SideSpec => ({ kind: 'flat', t: r.which === 'a' ? -ext : r.f.length + ext });

/** Extensão (corte reto) necessária para cobrir o canto externo com `other`. */
function outerExtension(a: EndRef, b: EndRef): number {
  const sa = sideOf(a, b.dir);
  const sb = sideOf(b, a.dir);
  const p = miterPoint(sa, sb, 0);
  if (!p) return 0;
  return Math.max(0, -dot(sub2(p, a.o), a.dir));
}

const capExt = (ext: number, ...f: WallFrame[]): number => Math.min(ext, MITER_LIMIT * Math.max(0.05, ...f.map((x) => x.thickness)));

function miterPair(out: Map<string, WallEnds>, a: EndRef, b: EndRef): void {
  const sa = sideOf(a, b.dir);
  const sb = sideOf(b, a.dir);
  const limit = MITER_LIMIT * Math.max(a.f.thickness, b.f.thickness, 0.05);
  const ok = (s: MiterSide, o: MiterSide, ref: EndRef): boolean => {
    const t = s.sHi - s.sLo;
    for (const d of [0, t]) {
      const p = miterPoint(s, o, d);
      if (!p || dist(p, ref.o) > limit) return false;
    }
    return true;
  };
  if (!ok(sa, sb, a) || !ok(sb, sa, b)) return; // ângulo agudo demais: mantém corte reto
  setEnd(out, a, both({ kind: 'miter', self: sa, other: sb }));
  setEnd(out, b, both({ kind: 'miter', self: sb, other: sa }));
}

/** Junção de duas paredes segundo a configuração da mais antiga (docs/05 §9). */
export function joinPair(out: Map<string, WallEnds>, a: EndRef, b: EndRef): void {
  const [first, second] = a.f.wall.order <= b.f.wall.order ? [a, b] : [b, a];
  const cfg = first.which === 'a' ? first.f.wall.joinStart : first.f.wall.joinEnd;
  const lead = cfg.flip ? second : first;
  const follower = cfg.flip ? first : second;
  switch (cfg.kind) {
    case 'miter':
      miterPair(out, a, b);
      return;
    case 'square':
      // Esquadro: cada extremidade é cortada a 90° e prolongada até cobrir o canto externo.
      setEnd(out, a, both(flatAt(a, capExt(outerExtension(a, b), a.f, b.f))));
      setEnd(out, b, both(flatAt(b, capExt(outerExtension(b, a), a.f, b.f))));
      return;
    case 'butt': {
      // Encosto: a parede dominante atravessa até o canto externo; a outra para no núcleo dela.
      setEnd(out, lead, both(flatAt(lead, capExt(outerExtension(lead, follower), lead.f, follower.f))));
      const spec = toCenterline(follower, lead.f);
      if (spec) setEnd(out, follower, both(spec));
      return;
    }
  }
}
