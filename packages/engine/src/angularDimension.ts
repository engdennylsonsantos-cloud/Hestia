import { add, dot, mul, norm, sub, type Vec2 } from '@hestia/geom';
import { angularDimensionData, coreSpan, levelRoomSeparators, projectGrids, type Dimension, type Id, type Project } from '@hestia/model';
import { frameOfWall } from './resolve.ts';
import { pointAt, tangentAt } from './frame.ts';

interface WallRefLine {
  p: Vec2;
  d: Vec2;
  anchor: Vec2;
}

const WALL_REF = /^(.+):(face:hi|face:lo|eixo|nucleo:a|nucleo:b)$/;

/** Reta de uma referência de cota angular presa a uma parede (face, eixo ou face do núcleo). */
function wallRefLine(p: Project, key: string): WallRefLine | null {
  const m = WALL_REF.exec(key);
  if (!m) return null;
  const f = frameOfWall(p, m[1]!);
  if (!f) return null;
  const t = f.length / 2;
  const core = coreSpan(f.type);
  const s = m[2] === 'face:hi' ? f.sHi
    : m[2] === 'face:lo' ? f.sLo
    : m[2] === 'eixo' ? 0
    : f.sign * (f.extOffset - (m[2] === 'nucleo:a' ? core.from : core.to));
  return {
    p: pointAt(f, t, s),
    d: tangentAt(f, t),
    anchor: pointAt(f, t, 0),
  };
}

const segmentRef = (a: Vec2, b: Vec2): WallRefLine | null => {
  const d = sub(b, a);
  if (Math.hypot(d.x, d.y) < 1e-9) return null;
  return { p: a, d: norm(d), anchor: mul(add(a, b), 0.5) };
};

/** Resolve também grades, linhas de detalhe e separadores; desconhecidas mantêm a geometria gravada. */
function refLine(p: Project, levelId: Id, key: string): WallRefLine | null {
  const wall = wallRefLine(p, key);
  if (wall) return wall;
  const grid = /^(.+):grade:(\d+)$/.exec(key);
  if (grid) {
    const g = projectGrids(p).find((x) => x.id === grid[1]);
    const i = Number(grid[2]);
    if (!g || !g.points[i] || !g.points[i + 1]) return null;
    return segmentRef(g.points[i]!, g.points[i + 1]!);
  }
  const detail = /^(.+):detalhe$/.exec(key);
  if (detail) {
    const l = p.levels.find((x) => x.id === levelId)?.detailLines?.find((x) => x.id === detail[1]);
    return l ? segmentRef(l.a, l.b) : null;
  }
  const sep = /^(.+):separador$/.exec(key);
  if (sep) {
    const r = levelRoomSeparators(p, levelId).find((x) => x.id === sep[1]);
    return r ? segmentRef(r.a, r.b) : null;
  }
  return null;
}

function intersection(a: Vec2, da: Vec2, b: Vec2, db: Vec2): Vec2 | null {
  const det = da.x * db.y - da.y * db.x;
  if (Math.abs(det) < 1e-9) return null;
  const t = ((b.x - a.x) * db.y - (b.y - a.y) * db.x) / det;
  return { x: a.x + da.x * t, y: a.y + da.y * t };
}

const orient = (line: WallRefLine, center: Vec2): Vec2 =>
  dot(line.d, sub(line.anchor, center)) >= 0 ? line.d : { x: -line.d.x, y: -line.d.y };

/**
 * Recalcula a cota angular a partir das chaves do Alinhar. Assim as faces/eixos/núcleos continuam valendo depois que a
 * parede se move; referências que não são paredes (ou chaves antigas) mantêm a geometria gravada.
 */
export function resolveAngularDimension(p: Project, levelId: Id, d: Dimension): Dimension {
  const a = d.angular;
  if (!a) return d;
  const ra = refLine(p, levelId, a.refA);
  const rb = refLine(p, levelId, a.refB);
  if (!ra || !rb) return d;
  const center = intersection(ra.p, ra.d, rb.p, rb.d);
  if (!center) return d;
  const from = orient(ra, center);
  const to = orient(rb, center);
  const data = angularDimensionData(center, from, to, a.radius, a.side, a.refA, a.refB, a.base);
  return { ...d, a: center, b: add(center, mul(data.to, a.radius)), angular: { ...a, ...data } };
}
