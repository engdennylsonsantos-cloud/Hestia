import type { Vec2 } from '@hestia/geom';
import type { FillOp, StrokeOp } from './types.ts';

/**
 * Marcadores em pixels de tela (alças, anéis, cruzes, setas): o ponto de ancoragem fica em metros e o desenho, em pixels
 * a partir dele (`deslocamentoPx`). O tamanho na tela é o mesmo para qualquer zoom, e a geometria do nível não guarda
 * coordenada que dependa do zoom (ver `resolverZoom`).
 */

/** Meio lado das alças quadradas de seleção, em pixels. */
export const ALCA_PX = 4.5;

const P = (x: number, y: number): Vec2 => ({ x, y });

/** Forma de marcador: o traço (ou anel) com a âncora repetida em cada vértice e os deslocamentos em pixels. */
export interface FormaPx {
  pts: Vec2[];
  closed: boolean;
  deslocamentoPx: Vec2[];
}

/** Forma ancorada em `c`, com os vértices `offs` (pixels, eixos do mundo: y para cima). */
export function formaEm(c: Vec2, offs: readonly Vec2[], closed: boolean): FormaPx {
  return { pts: offs.map(() => c), closed, deslocamentoPx: [...offs] };
}

/** Os quatro cantos de um quadrado de meio lado `meio` (px), na ordem de sempre: (−,−), (+,−), (+,+), (−,+). */
export const cantosDoQuadrado = (meio: number): Vec2[] => [P(-meio, -meio), P(meio, -meio), P(meio, meio), P(-meio, meio)];

/** Quadrado de meio lado `meio` px ancorado em `c`: o traço do contorno e o polígono do preenchimento. */
export function quadradoEm(c: Vec2, meio: number): { traco: FormaPx; fill: Pick<FillOp, 'polygons' | 'deslocamentoPx'> } {
  const forma = formaEm(c, cantosDoQuadrado(meio), true);
  return { traco: forma, fill: { polygons: [[forma.pts]], deslocamentoPx: [[forma.deslocamentoPx]] } };
}

/** Preenchimento de um polígono-marcador ancorado em `c` com os vértices `offs` (px). */
export function poligonoEm(c: Vec2, offs: readonly Vec2[]): Pick<FillOp, 'polygons' | 'deslocamentoPx'> {
  const f = formaEm(c, offs, true);
  return { polygons: [[f.pts]], deslocamentoPx: [[f.deslocamentoPx]] };
}

/** Traço-marcador (sem estilo) ancorado em `c`: o resto do `StrokeOp` o chamador completa. */
export function tracoEm(c: Vec2, offs: readonly Vec2[], closed: boolean): Pick<StrokeOp, 'pts' | 'closed' | 'deslocamentoPx'> {
  return formaEm(c, offs, closed);
}
