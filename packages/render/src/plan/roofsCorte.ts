import { dist, dot, intersection, orientedRect, sub, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { roofTopAt, type ResolvedRoof, type ResolvedRoofPlane, type RoofLine, type ViewClass } from '@hestia/engine';
import type { Id } from '@hestia/model';
import type { FloorOps } from './floors.ts';
import type { EspessurasDoTelhado } from './roofsTracos.ts';
import type { PlanTheme, StrokeOp } from './types.ts';

/** Metade do lado do retângulo que recorta uma água (m): maior que qualquer telhado. */
const GRANDE = 1e4;
/** Tolerância (m) para um vértice contar como estando sobre a linha de corte. */
const EPS = 1e-6;

/** Telhado cortado pelo plano da vista: o que ficou (abaixo do plano) e os trechos onde a superfície cruza o plano. */
export interface TelhadoCortado {
  roof: ResolvedRoof;
  corte: Array<[Vec2, Vec2]>;
}

/** Telhado inteiro de cada telhado cortado (para o que não depende do recorte, como a área real da etiqueta). */
export const telhadoOriginal = new WeakMap<ResolvedRoof, ResolvedRoof>();

/**
 * Parte da água que fica abaixo da cota `cutZ`: a cota é `z0 + inclinação × d`, com d a distância da aresta, então o
 * recorte é o semiplano `d ≤ (cutZ − z0) / inclinação`. Água horizontal: inteira ou nada, conforme a cota dela.
 */
function cortarAgua(pl: ResolvedRoofPlane, cutZ: number): { plane: ResolvedRoofPlane | null; corte: Array<[Vec2, Vec2]> } {
  if (pl.percent <= 0) return { plane: pl.z0 <= cutZ + EPS ? pl : null, corte: [] };
  const dCorte = ((cutZ - pl.z0) * 100) / pl.percent;
  const u = pl.up;
  const c = { x: pl.origin.x + u.x * (dCorte - GRANDE), y: pl.origin.y + u.y * (dCorte - GRANDE) };
  const lado: MultiPolygon = [[orientedRect(c.x, c.y, u.x, u.y, GRANDE, GRANDE) as Ring]];
  const polygon = intersection(pl.polygon, lado);
  if (polygon.length === 0) return { plane: null, corte: [] };
  const corte: Array<[Vec2, Vec2]> = [];
  for (const poly of polygon) {
    for (const ring of poly) {
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length]!;
        const da = dot(sub(a, pl.origin), u);
        const db = dot(sub(b, pl.origin), u);
        if (Math.abs(da - dCorte) < EPS && Math.abs(db - dCorte) < EPS && dist(a, b) > EPS) corte.push([a, b]);
      });
    }
  }
  return { plane: { ...pl, polygon }, corte };
}

/** Cota do telhado inteiro num ponto da linha; um empurrão para dentro do segmento resolve o ponto de borda. */
function cotaEm(r: ResolvedRoof, p: Vec2, para: Vec2): number | null {
  const z = roofTopAt(r, p);
  if (z !== null) return z;
  return roofTopAt(r, { x: p.x + (para.x - p.x) * 1e-3, y: p.y + (para.y - p.y) * 1e-3 });
}

/** Trecho de uma linha do telhado que fica abaixo de `cutZ`; null quando todo o segmento está acima. */
function cortarLinha(r: ResolvedRoof, ln: RoofLine, cutZ: number): RoofLine | null {
  if (ln.kind === 'eave') return ln;
  const za = cotaEm(r, ln.a, ln.b);
  const zb = cotaEm(r, ln.b, ln.a);
  if (za === null || zb === null) return ln;
  if (za <= cutZ + EPS && zb <= cutZ + EPS) return ln;
  if (za > cutZ + EPS && zb > cutZ + EPS) return null;
  // A cota varia linearmente ao longo da linha: fica o lado que está abaixo do plano.
  const t = (cutZ - za) / (zb - za);
  const p = { x: ln.a.x + (ln.b.x - ln.a.x) * t, y: ln.a.y + (ln.b.y - ln.a.y) * t };
  return za < zb ? { ...ln, b: p } : { ...ln, a: p };
}

/**
 * Corta o telhado pelo plano de corte da planta: só a parte da superfície que está abaixo do plano é vista (como no
 * Revit), com a linha de corte onde a superfície cruza o plano. Null quando nada do telhado fica abaixo do plano.
 */
export function cortarTelhado(r: ResolvedRoof, cutZ: number): TelhadoCortado | null {
  const planes: ResolvedRoofPlane[] = [];
  const corte: Array<[Vec2, Vec2]> = [];
  for (const pl of r.planes) {
    const c = cortarAgua(pl, cutZ);
    if (c.plane) planes.push(c.plane);
    corte.push(...c.corte);
  }
  if (planes.length === 0) return null;
  const lines = r.lines.map((ln) => cortarLinha(r, ln, cutZ)).filter((ln): ln is RoofLine => ln !== null);
  const roof: ResolvedRoof = { ...r, planes, lines };
  telhadoOriginal.set(roof, r);
  return { roof, corte };
}

/**
 * Aplica o corte aos telhados classificados como `cut` (o plano atravessa a faixa de cotas do telhado). Os demais, e a
 * planta de cobertura, ficam como estão. Devolve os telhados a desenhar e os trechos da linha de corte.
 */
export function aplicarCorte(
  roofs: ResolvedRoof[],
  classes: ReadonlyMap<Id, ViewClass> | undefined,
  cutZ: number | undefined,
  planMode: boolean,
): { roofs: ResolvedRoof[]; corte: Array<[Vec2, Vec2]> } {
  if (planMode || cutZ === undefined || !classes) return { roofs, corte: [] };
  const corte: Array<[Vec2, Vec2]> = [];
  const out: ResolvedRoof[] = [];
  for (const r of roofs) {
    if (classes.get(r.roofId) !== 'cut') {
      out.push(r);
      continue;
    }
    const c = cortarTelhado(r, cutZ);
    if (!c) continue;
    out.push(c.roof);
    corte.push(...c.corte);
  }
  return { roofs: out, corte };
}

/** A linha de corte: onde a superfície do telhado cruza o plano, no peso de corte da categoria e na tinta do tema. */
export function linhaDeCorteOps(corte: Array<[Vec2, Vec2]>, theme: PlanTheme, esp: EspessurasDoTelhado): FloorOps {
  const strokes: StrokeOp[] = corte.map(([a, b]) => ({ pts: [a, b], closed: false, ...esp.beiral, color: theme.ink, alpha: 1 }));
  return { fills: [], strokes, labels: [] };
}
