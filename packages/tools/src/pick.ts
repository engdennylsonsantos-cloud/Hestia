import { dist, boxesOverlap, boxOf, intersectSegments, type Vec2 } from '@hestia/geom';
import { wallMid } from './wallGeom.ts';
import { wallsOnLevel, type Id, type Project } from '@hestia/model';
import { toLocal } from '@hestia/engine';
import { candidatesAt, wallIndexOf } from './pickIndex.ts';

export interface Hit {
  id: Id;
  kind: 'wall' | 'door' | 'window';
}

/**
 * Elemento sob o ponto (aberturas têm prioridade sobre a parede que as hospeda). Só as paredes que podem acertar o ponto
 * entram na conta (índice de `pickIndex.ts`); o resultado é o da varredura de todas as paredes, na mesma ordem.
 */
export function pickAt(p: Project, levelId: Id, at: Vec2, mpp: number): Hit | null {
  const tol = 4 * mpp;
  const ix = wallIndexOf(p, levelId);
  let bestWall: { id: Id; d: number } | null = null;
  for (const i of candidatesAt(ix, at, 2 * tol)) {
    const w = ix.walls[i]!;
    const f = w.frame;
    for (const o of w.opens) {
      const l = toLocal(f, at);
      if (Math.abs(l.t - o.g.offset) <= o.g.width / 2 + tol && l.s <= f.sHi + tol && l.s >= f.sLo - tol) return { id: o.id, kind: o.kind };
    }
    const l = toLocal(f, at);
    if (l.t < -tol || l.t > f.length + tol) continue;
    const over = l.s > f.sHi ? l.s - f.sHi : l.s < f.sLo ? f.sLo - l.s : 0;
    if (over > tol) continue;
    const d = over + Math.abs(l.s - f.sMid) * 1e-3;
    if (!bestWall || d < bestWall.d) bestWall = { id: w.id, d };
  }
  return bestWall ? { id: bestWall.id, kind: 'wall' } : null;
}

export interface Grip {
  wallId: Id;
  /** 'mid' é a alça do meio do arco (muda a flecha). */
  end: 'a' | 'b' | 'mid';
  at: Vec2;
}

export function gripAt(p: Project, ids: Id[], at: Vec2, mpp: number): Grip | null {
  const tol = 9 * mpp;
  for (const id of ids) {
    const w = p.elements[id];
    if (!w || w.kind !== 'wall') continue;
    if (dist(w.a, at) <= tol) return { wallId: id, end: 'a', at: w.a };
    if (dist(w.b, at) <= tol) return { wallId: id, end: 'b', at: w.b };
    if (Math.abs(w.sag) > 1e-6) {
      const m = wallMid(w);
      if (dist(m, at) <= tol) return { wallId: id, end: 'mid', at: m };
    }
  }
  return null;
}

/** Paredes (fora de `exclude`) com uma extremidade em `pt`: acompanham o movimento da parede ligada. */
export function connectedEnds(p: Project, levelId: Id, pt: Vec2, exclude: Set<Id>, tol = 0.02): Array<{ wallId: Id; end: 'a' | 'b' }> {
  const out: Array<{ wallId: Id; end: 'a' | 'b' }> = [];
  for (const w of wallsOnLevel(p, levelId)) {
    if (exclude.has(w.id)) continue;
    if (dist(w.a, pt) <= tol) out.push({ wallId: w.id, end: 'a' });
    if (dist(w.b, pt) <= tol) out.push({ wallId: w.id, end: 'b' });
  }
  return out;
}

/**
 * Quem acompanha uma extremidade movida. Padrão: só em canto simples (exatamente uma outra parede termina ali),
 * como o Revit mantém o canto de duas paredes ligado. Num nó de 3 ou mais paredes (ex.: ramal chegando num canto)
 * a parede se solta sozinha, para não arrastar a casa junto. `invert` (Alt) troca o comportamento: num canto simples
 * solta, num nó leva todas.
 */
export function followingEnds(p: Project, levelId: Id, pt: Vec2, exclude: Set<Id>, invert = false, tol = 0.02): Array<{ wallId: Id; end: 'a' | 'b' }> {
  const all = connectedEnds(p, levelId, pt, exclude, tol);
  const wallsHere = new Set(all.map((c) => c.wallId));
  const simple = wallsHere.size === 1;
  return simple !== invert ? all : [];
}

export function idsInBox(p: Project, levelId: Id, a: Vec2, b: Vec2): Id[] {
  const box = boxOf([a, b]);
  const crossing = b.x < a.x;
  const ids: Id[] = [];
  for (const w of wallsOnLevel(p, levelId)) {
    const bb = boxOf([w.a, w.b]);
    const inside = (q: Vec2): boolean => q.x >= box.minX && q.x <= box.maxX && q.y >= box.minY && q.y <= box.maxY;
    const contained = inside(w.a) && inside(w.b);
    let hit = contained;
    if (!hit && crossing && boxesOverlap(bb, box)) {
      const corners: Vec2[] = [
        { x: box.minX, y: box.minY },
        { x: box.maxX, y: box.minY },
        { x: box.maxX, y: box.maxY },
        { x: box.minX, y: box.maxY },
      ];
      hit = inside(w.a) || inside(w.b) || corners.some((c, i) => intersectSegments(w.a, w.b, c, corners[(i + 1) % 4]!) !== null);
    }
    if (hit) ids.push(w.id);
  }
  return ids;
}

