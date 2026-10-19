import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon, Ring } from './polygon.ts';

type Pair = [number, number];
type PcRing = Pair[];
type PcPolygon = PcRing[];
type PcMulti = PcPolygon[];

/** Resolução de arredondamento: 1e-7 m (0,1 µm) estabiliza coordenadas quase coincidentes. */
const SNAP = 1e7;
const snap = (n: number): number => Math.round(n * SNAP) / SNAP;

function toPc(m: MultiPolygon): PcMulti {
  return m
    .map((p) => p.filter((r) => r.length >= 3).map((r): PcRing => r.map((v): Pair => [snap(v.x), snap(v.y)])))
    .filter((p) => p.length > 0);
}

function fromPc(m: PcMulti): MultiPolygon {
  return m.map(
    (p): Polygon =>
      p.map((r): Ring => {
        const pts = r.map(([x, y]) => ({ x, y }));
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (first && last && first.x === last.x && first.y === last.y) pts.pop();
        return pts;
      }),
  );
}

export const asMulti = (r: Ring): MultiPolygon => [[r]];

export function union(...ms: MultiPolygon[]): MultiPolygon {
  const parts = ms.filter((m) => m.length > 0).map(toPc);
  if (parts.length === 0) return [];
  const [first, ...rest] = parts;
  return fromPc(polygonClipping.union(first!, ...rest));
}

export function difference(a: MultiPolygon, ...bs: MultiPolygon[]): MultiPolygon {
  if (a.length === 0) return [];
  const subs = bs.filter((m) => m.length > 0).map(toPc);
  if (subs.length === 0) return a;
  return fromPc(polygonClipping.difference(toPc(a), ...subs));
}

export function intersection(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  if (a.length === 0 || b.length === 0) return [];
  return fromPc(polygonClipping.intersection(toPc(a), toPc(b)));
}
