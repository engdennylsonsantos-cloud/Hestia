import type { Id } from '@hestia/model';

/** Ponto em planta, em metros (x para a direita, y para cima). */
export interface IfcPoint {
  x: number;
  y: number;
}

/** Anel sem o vértice de fechamento repetido. */
export type IfcRing = IfcPoint[];

/** Polígono: [contorno, ...furos]. */
export type IfcPolygon = IfcRing[];

/** Plano de cota absoluta: z = a·x + b·y + c (a = b = 0 é cota constante). */
export interface IfcPlane {
  a: number;
  b: number;
  c: number;
}

/** Sólido prismático entre duas faces planas (topo e fundo, cotas absolutas): piso, laje, água de telhado, degrau. */
export interface IfcPrism {
  polygon: IfcPolygon;
  top: IfcPlane;
  bottom: IfcPlane;
}

/** Parede resolvida: contorno em planta (união das camadas, sem vãos) e cotas absolutas da base e da altura. */
export interface IfcWallGeo {
  wallId: Id;
  footprint: IfcPolygon;
  baseZ: number;
  height: number;
}

/**
 * Vão resolvido: eixo `u` ao longo da parede, centro em planta, esquadria (`width` × `height`), vão bruto (`roughWidth` ×
 * `roughHeight`, com `roughBottomZ` na cota absoluta) e cota absoluta do peitoril (`sillZ`). `thickness` é a espessura da parede.
 */
export interface IfcOpeningGeo {
  openingId: Id;
  center: IfcPoint;
  u: IfcPoint;
  width: number;
  height: number;
  roughWidth: number;
  roughHeight: number;
  roughBottomZ: number;
  sillZ: number;
  thickness: number;
}

/** Lance de escada resolvido: peças do corpo (degraus, chegada, poste) e contagens. */
export interface IfcFlightGeo {
  componentIndex: number;
  pieces: IfcPrism[];
  treads: number;
  risers: number;
}

/** Escada resolvida: lances (IfcStairFlight), patamares (IfcSlab LANDING) e altura real do espelho. */
export interface IfcStairGeo {
  stairId: Id;
  levelId: Id;
  spiral: boolean;
  riserHeight: number;
  flights: IfcFlightGeo[];
  landings: IfcPrism[];
}

/**
 * Geometria RESOLVIDA do projeto, montada por quem pode importar o engine (apps/web): o io não importa o engine
 * (docs/01 §1). Pisos, lajes e águas de telhado vêm como prismas; as cotas são absolutas e o io as põe na cota do nível.
 */
export interface IfcGeometry {
  walls: IfcWallGeo[];
  openings: IfcOpeningGeo[];
  floors: Array<{ floorId: Id; prism: IfcPrism }>;
  slabs: Array<{ slabId: Id; prism: IfcPrism }>;
  roofs: Array<{ roofId: Id; planes: IfcPrism[] }>;
  stairs: IfcStairGeo[];
}
