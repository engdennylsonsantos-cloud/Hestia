import { difference, dist, dot, intersection, mid, multiArea, orientedRect, pointInMulti, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { boundaryDistance, collinearOverlaps, WATER_MIN_AREA } from './roofGeom.ts';
import { sharedKind } from './roofLines.ts';
import type { ResolvedRoofPlane, RoofLine } from './roofs.ts';

/**
 * Telhado durante a resolução de um nível: águas (sem furos), flag de junção e área em planta cortada pela junção.
 * `joinedArea` sai da planta e do volume do telhado; a camada continua com a espessura dele.
 */
export interface JoinItem {
  joinOthers: boolean;
  planes: ResolvedRoofPlane[];
  joinedArea: number;
}

/** Maior coordenada (em módulo) dos polígonos, para dimensionar os semiplanos. */
function extentOf(planes: ResolvedRoofPlane[]): number {
  let m = 0;
  for (const pl of planes) for (const poly of pl.polygon) for (const ring of poly) for (const p of ring) m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
  return m;
}

/** Semiplano {p : C + G·p ≥ 0} como quadrado grande o bastante para cobrir a região de `scale`. Sem inclinação relativa, tudo ou nada. */
function aboveHalfPlane(G: Vec2, C: number, scale: number): MultiPolygon {
  const g2 = G.x * G.x + G.y * G.y;
  if (g2 < 1e-24) return C >= 0 ? [[orientedRect(0, 0, 1, 0, 2 * scale + 10, 2 * scale + 10)]] : [];
  const g = Math.sqrt(g2);
  const nu = { x: G.x / g, y: G.y / g };
  // p0: ponto da reta C + G·p = 0 mais próximo da origem; a reta é ortogonal a nu.
  const p0 = { x: (-C * G.x) / g2, y: (-C * G.y) / g2 };
  const big = 2 * (scale + Math.hypot(p0.x, p0.y)) + 10;
  return [[orientedRect(p0.x + nu.x * big, p0.y + nu.y * big, -nu.y, nu.x, big, big)]];
}

interface Cut {
  a: MultiPolygon;
  b: MultiPolygon;
  region: MultiPolygon;
}

/**
 * Corta duas águas que se sobrepõem: na região comum, a diferença de cota f = z_a − z_b é linear, então a divisa é uma
 * reta. A água A fica onde f ≥ 0 e a B onde f ≤ 0. Sem sobreposição, null.
 */
function cutPair(a: ResolvedRoofPlane, b: ResolvedRoofPlane, scale: number): Cut | null {
  const region = intersection(a.polygon, b.polygon);
  if (multiArea(region) <= WATER_MIN_AREA) return null;
  const sa = a.percent / 100;
  const sb = b.percent / 100;
  // z_a(p) = z0_a − s_a·(o_a·u_a) + s_a·(u_a·p), e o análogo para B: f(p) = C + G·p.
  const G = { x: sa * a.up.x - sb * b.up.x, y: sa * a.up.y - sb * b.up.y };
  const C = a.z0 - sa * dot(a.origin, a.up) - (b.z0 - sb * dot(b.origin, b.up));
  const high = aboveHalfPlane(G, C, scale);
  return {
    a: difference(a.polygon, difference(region, high)),
    b: difference(b.polygon, intersection(region, high)),
    region,
  };
}

/** Divisas entre as águas finais de dois telhados unidos: só dentro da região que foi cortada (a divisa do corte). */
function creases(A: ResolvedRoofPlane[], B: ResolvedRoofPlane[], region: MultiPolygon): RoofLine[] {
  const out: RoofLine[] = [];
  for (const a of A) {
    for (const b of B) {
      for (const [p, q] of collinearOverlaps(a.polygon, b.polygon)) {
        if (dist(p, q) < 1e-7) continue;
        const m = mid(p, q);
        if (!pointInMulti(m, region) || boundaryDistance(region, m) <= 1e-6) continue;
        const kind = sharedKind(a, b, p, q);
        if (kind) out.push({ kind, a: p, b: q });
      }
    }
  }
  return out;
}

/**
 * Junção de telhados do mesmo nível (decisão 0008, item 10; Revit: Join Roof). Dois telhados se unem quando os dois têm
 * `joinOthers`. Onde as águas se sobrepõem, vale a maior cota: cada par corta o outro onde é mais baixo. Muda `items`
 * (planes e joinedArea). Devolve, por telhado, as linhas das divisas que ele recebe: cada divisa vai para o telhado de
 * maior índice (o que se une ao outro).
 */
export function joinRoofs(items: JoinItem[]): RoofLine[][] {
  const scale = items.reduce((m, it) => Math.max(m, extentOf(it.planes)), 0);
  const pairs: Array<{ i: number; j: number; region: MultiPolygon }> = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i]!;
      const B = items[j]!;
      if (!A.joinOthers || !B.joinOthers) continue;
      let region: MultiPolygon = [];
      for (let x = 0; x < A.planes.length; x++) {
        for (let y = 0; y < B.planes.length; y++) {
          const a = A.planes[x]!;
          const b = B.planes[y]!;
          const cut = cutPair(a, b, scale);
          if (!cut) continue;
          region = union(region, cut.region);
          A.joinedArea += multiArea(a.polygon) - multiArea(cut.a);
          B.joinedArea += multiArea(b.polygon) - multiArea(cut.b);
          A.planes[x] = { ...a, polygon: cut.a };
          B.planes[y] = { ...b, polygon: cut.b };
        }
      }
      if (multiArea(region) > WATER_MIN_AREA) pairs.push({ i, j, region });
    }
  }
  for (const it of items) it.planes = it.planes.filter((pl) => multiArea(pl.polygon) > WATER_MIN_AREA);
  const extra: RoofLine[][] = items.map(() => []);
  for (const { i, j, region } of pairs) extra[j]!.push(...creases(items[i]!.planes, items[j]!.planes, region));
  return extra;
}
