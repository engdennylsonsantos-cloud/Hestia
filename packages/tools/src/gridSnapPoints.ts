import {
  arcFromSagitta,
  arcLocal,
  arcPointAt,
  closestOnSegment,
  dist,
  dot,
  intersectCircleLine,
  intersectCircles,
  intersectSegments,
  sub,
  type Arc,
  type Vec2,
} from '@hestia/geom';
import { projectGrids, type Grid, type Id, type Project, type Wall } from '@hestia/model';
import type { AddCandidate } from './snapExtras.ts';
import type { SnapOptions } from './types.ts';

/** Trecho de uma grade: reta ou arco. A grade de 2 pontos com `sag` ≠ 0 é um arco; as demais, polilinha de retas. */
type Piece = { kind: 'seg'; a: Vec2; b: Vec2 } | { kind: 'arc'; arc: Arc };

interface GridPieces {
  grid: Grid;
  pieces: Piece[];
}

/** Trechos por projeto: o projeto é imutável, então o cache por identidade acompanha as edições. */
const cache = new WeakMap<Project, GridPieces[]>();

function piecesOf(g: Grid): Piece[] {
  if (g.points.length === 2) {
    const arc = arcFromSagitta(g.points[0]!, g.points[1]!, g.sag);
    if (arc) return [{ kind: 'arc', arc }];
  }
  const out: Piece[] = [];
  for (let i = 1; i < g.points.length; i++) out.push({ kind: 'seg', a: g.points[i - 1]!, b: g.points[i]! });
  return out;
}

function gridPieces(p: Project): GridPieces[] {
  let all = cache.get(p);
  if (!all) {
    all = projectGrids(p).map((grid) => ({ grid, pieces: piecesOf(grid) }));
    cache.set(p, all);
  }
  return all;
}

const onArc = (arc: Arc, q: Vec2): boolean => {
  const { t } = arcLocal(arc, q);
  return t >= -1e-9 && t <= arc.length + 1e-9;
};

function onSeg(a: Vec2, b: Vec2, q: Vec2): boolean {
  const d = sub(b, a);
  const ll = dot(d, d);
  if (ll < 1e-12) return false;
  const t = dot(sub(q, a), d) / ll;
  return t >= -1e-9 && t <= 1 + 1e-9;
}

/** Cruzamentos entre dois trechos (reta ou arco), só onde os dois existem. */
export function pieceCrossings(p1: Piece, p2: Piece): Vec2[] {
  if (p1.kind === 'seg' && p2.kind === 'seg') {
    const q = intersectSegments(p1.a, p1.b, p2.a, p2.b);
    return q ? [q] : [];
  }
  if (p1.kind === 'arc' && p2.kind === 'arc') {
    return intersectCircles(p1.arc.center, p1.arc.radius, p2.arc.center, p2.arc.radius).filter((q) => onArc(p1.arc, q) && onArc(p2.arc, q));
  }
  const [arc, seg] = p1.kind === 'arc' ? [p1.arc, p2 as Extract<Piece, { kind: 'seg' }>] : [(p2 as Extract<Piece, { kind: 'arc' }>).arc, p1 as Extract<Piece, { kind: 'seg' }>];
  return intersectCircleLine(arc.center, arc.radius, seg.a, sub(seg.b, seg.a)).filter((q) => onArc(arc, q) && onSeg(seg.a, seg.b, q));
}

/** Ponto do trecho mais próximo de `q` (no arco, projeção radial presa às pontas). */
function nearestOn(piece: Piece, q: Vec2): Vec2 {
  if (piece.kind === 'seg') return closestOnSegment(q, piece.a, piece.b);
  const t = Math.max(0, Math.min(piece.arc.length, arcLocal(piece.arc, q).t));
  return arcPointAt(piece.arc, t, 0);
}

const wallPiece = (w: Wall): Piece => {
  const arc = arcFromSagitta(w.a, w.b, w.sag);
  return arc ? { kind: 'arc', arc } : { kind: 'seg', a: w.a, b: w.b };
};

/**
 * Capturas das grades de eixos. Pontas e vértices (extremidade), cruzamento grade × grade e grade × eixo de parede
 * (interseção) e o ponto mais próximo sobre a linha, inclusive no arco (sobre o eixo). Seguem as mesmas chaves das
 * paredes: `endpoint`, `intersections` e `axis`. O dono é a grade (`hostId`): some quando ela está em `ignore`.
 * `walls` são as paredes já filtradas pelo motor (nível, visibilidade e ignore).
 */
export function addGridSnaps(project: Project, sn: SnapOptions, cursor: Vec2, tol: number, walls: Wall[], ignore: Set<Id> | undefined, add: AddCandidate): void {
  const grids = gridPieces(project).filter((g) => !ignore?.has(g.grid.id));
  if (grids.length === 0) return;
  // Só entra na conta quem passa ao alcance do cursor: o resto não pode formar captura.
  const near = grids.filter((g) => g.pieces.some((pc) => dist(nearestOn(pc, cursor), cursor) <= tol));

  for (const g of grids) {
    if (sn.endpoint === false) break;
    for (const q of g.grid.points) {
      if (dist(cursor, q) <= tol) add(q, 'endpoint', [], g.grid.id);
    }
  }
  for (const g of near) {
    if (sn.axis) {
      for (const pc of g.pieces) {
        const q = nearestOn(pc, cursor);
        if (dist(cursor, q) <= tol) add(q, 'nearest', [], g.grid.id);
      }
    }
    if (!sn.intersections) continue;
    for (const other of grids) {
      if (other.grid.id <= g.grid.id) continue;
      for (const a of g.pieces) {
        for (const b of other.pieces) {
          for (const q of pieceCrossings(a, b)) if (dist(cursor, q) <= tol) add(q, 'intersection', [], g.grid.id);
        }
      }
    }
    for (const w of walls) {
      if (dist(cursor, nearestOn(wallPiece(w), cursor)) > tol) continue;
      for (const a of g.pieces) {
        for (const q of pieceCrossings(a, wallPiece(w))) if (dist(cursor, q) <= tol) add(q, 'intersection', [], g.grid.id);
      }
    }
  }
}
