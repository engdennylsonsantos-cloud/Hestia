import type { MultiPolygon, Ring, Vec2 } from '@hestia/geom';

/**
 * Geometria plana empacotada em arrays tipados, para atravessar o `postMessage` do worker sem cópia profunda (os
 * buffers vão na lista de transferência, ver `colherBuffers`) e para a interface desenhar sem alocar objetos.
 *
 * Um multipolígono vira três arrays: `coords` (x, y de cada vértice, todos os anéis em sequência), `aneis` (índice do
 * primeiro vértice de cada anel, mais o total no fim) e `poligonos` (quantos anéis tem cada polígono; o primeiro anel
 * é o externo e os demais são furos, como em `Polygon` de `@hestia/geom`).
 */
export interface GeometriaEmpacotada {
  coords: Float64Array;
  aneis: Uint32Array;
  poligonos: Uint32Array;
}

/** Caixa envolvente em planta: `[xMin, yMin, xMax, yMax]`. Vazia (sem vértice): `[0, 0, 0, 0]`. */
export type CaixaPlana = Float64Array;

/** Geometria sem vértice nenhum. */
export const geometriaVazia = (): GeometriaEmpacotada => ({ coords: new Float64Array(0), aneis: new Uint32Array([0]), poligonos: new Uint32Array(0) });

/** Quantos vértices a geometria tem. */
export const totalVertices = (g: GeometriaEmpacotada): number => g.coords.length / 2;

/** Empacota vários multipolígonos em um só (a ordem dos polígonos é a da lista). */
export function empacotarMultis(multis: readonly MultiPolygon[]): GeometriaEmpacotada {
  let vertices = 0;
  let aneis = 0;
  let poligonos = 0;
  for (const m of multis) {
    for (const poly of m) {
      poligonos++;
      for (const ring of poly) {
        aneis++;
        vertices += ring.length;
      }
    }
  }
  const coords = new Float64Array(vertices * 2);
  const inicios = new Uint32Array(aneis + 1);
  const porPoligono = new Uint32Array(poligonos);
  let v = 0;
  let a = 0;
  let p = 0;
  for (const m of multis) {
    for (const poly of m) {
      porPoligono[p++] = poly.length;
      for (const ring of poly) {
        inicios[a++] = v;
        for (const pt of ring) {
          coords[v * 2] = pt.x;
          coords[v * 2 + 1] = pt.y;
          v++;
        }
      }
    }
  }
  inicios[a] = v;
  return { coords, aneis: inicios, poligonos: porPoligono };
}

/** Empacota um multipolígono. */
export const empacotarMulti = (m: MultiPolygon): GeometriaEmpacotada => empacotarMultis([m]);

/** Empacota um anel simples (um polígono sem furos). */
export const empacotarAnel = (ring: readonly Vec2[]): GeometriaEmpacotada => empacotarMulti([[[...ring]]]);

/** Volta ao multipolígono de objetos. É o inverso exato de `empacotarMulti`. */
export function desempacotarMulti(g: GeometriaEmpacotada): MultiPolygon {
  const saida: MultiPolygon = [];
  let anel = 0;
  for (let p = 0; p < g.poligonos.length; p++) {
    const poly: Ring[] = [];
    for (let k = 0; k < g.poligonos[p]!; k++, anel++) {
      const ring: Vec2[] = [];
      for (let v = g.aneis[anel]!; v < g.aneis[anel + 1]!; v++) ring.push({ x: g.coords[v * 2]!, y: g.coords[v * 2 + 1]! });
      poly.push(ring);
    }
    saida.push(poly);
  }
  return saida;
}

/** Caixa envolvente de todos os vértices. */
export function caixaDe(g: GeometriaEmpacotada): CaixaPlana {
  const n = totalVertices(g);
  if (n === 0) return new Float64Array(4);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = g.coords[i * 2]!;
    const y = g.coords[i * 2 + 1]!;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return Float64Array.of(x0, y0, x1, y1);
}
