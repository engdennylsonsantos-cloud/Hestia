import { add, dot, mul, norm, sub, type Vec2 } from '@hestia/geom';
import { angularDimensionData, coreSpan, levelRoomSeparators, projectGrids, type Dimension, type Id, type Project } from '@hestia/model';
import { frameOfWall } from './resolve.ts';
import { pointAt, tangentAt } from './frame.ts';

interface WallRefLine {
  p: Vec2;
  d: Vec2;
  segment?: [Vec2, Vec2];
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
    ...(!f.arc ? { segment: [pointAt(f, 0, s), pointAt(f, f.length, s)] as [Vec2, Vec2] } : {}),
  };
}

const segmentRef = (a: Vec2, b: Vec2): WallRefLine | null => {
  const d = sub(b, a);
  if (Math.hypot(d.x, d.y) < 1e-9) return null;
  return { p: a, d: norm(d), segment: [a, b] };
};

/**
 * Intervalo de raios em que a semirreta a partir do centro encontra o trecho finito da referência; null se não encontra.
 * O trecho está sobre a reta que passa pelo centro, então a distância ao longo da semirreta é a projeção dos extremos.
 */
export function rayRadiusRange(center: Vec2, dir: Vec2, seg: [Vec2, Vec2]): [number, number] | null {
  const t0 = dot(sub(seg[0], center), dir);
  const t1 = dot(sub(seg[1], center), dir);
  const hi = Math.max(t0, t1);
  if (hi <= 1e-6) return null;
  return [Math.max(0, Math.min(t0, t1)), hi];
}

/** Raios em que o arco toca as duas referências ao mesmo tempo; null se nenhum raio serve às duas. */
export function commonRadiusRange(center: Vec2, from: Vec2, to: Vec2, segA?: [Vec2, Vec2], segB?: [Vec2, Vec2]): [number, number] | null {
  const ia: [number, number] | null = segA ? rayRadiusRange(center, from, segA) : [0, Infinity];
  const ib: [number, number] | null = segB ? rayRadiusRange(center, to, segB) : [0, Infinity];
  if (!ia || !ib) return null;
  const lo = Math.max(ia[0], ib[0]);
  const hi = Math.min(ia[1], ib[1]);
  return hi >= lo ? [lo, hi] : null;
}

/** Usa a semirreta oposta quando a escolhida não encontra o trecho da referência (o trecho fica do outro lado do encontro). */
export function orientTowardReference(center: Vec2, dir: Vec2, seg?: [Vec2, Vec2]): Vec2 {
  if (!seg || rayRadiusRange(center, dir, seg)) return dir;
  const flipped = { x: -dir.x, y: -dir.y };
  return rayRadiusRange(center, flipped, seg) ? flipped : dir;
}

/** Raio do arco limitado ao intervalo comum: as duas pontas caem sempre dentro dos trechos selecionados. */
function clampToReferences(center: Vec2, from: Vec2, to: Vec2, a: WallRefLine, b: WallRefLine, radius: number): number {
  const range = commonRadiusRange(center, from, to, a.segment, b.segment);
  if (!range) return radius;
  return Math.min(Math.max(radius, range[0]), range[1]);
}

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

const orient = (line: WallRefLine, preferred: Vec2): Vec2 => {
  return dot(line.d, preferred) >= 0 ? line.d : { x: -line.d.x, y: -line.d.y };
};

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
  const from = orientTowardReference(center, orient(ra, a.from), ra.segment);
  const to = orientTowardReference(center, orient(rb, a.to), rb.segment);
  const radius = clampToReferences(center, from, to, ra, rb, a.radius);
  const data = angularDimensionData(center, from, to, radius, a.side, a.refA, a.refB, a.base);
  return { ...d, a: center, b: add(center, mul(data.to, radius)), angular: { ...a, ...data } };
}
