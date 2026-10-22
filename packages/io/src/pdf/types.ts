/**
 * Lista de desenho de uma prancha para o PDF (decisão 0022), em mm de papel com origem no canto inferior esquerdo e y
 * para cima. Mesma forma que a composição do render produz (`SheetDrawList`); o io não depende do render.
 */
export interface PdfPoint {
  x: number;
  y: number;
}

export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Anéis de cada polígono, polígonos de um multipolígono (anel externo primeiro, furos depois). */
export type PdfPolygons = PdfPoint[][][];

export interface PdfFill {
  polygons: PdfPolygons;
  /** Cor #rrggbb, já opaca. */
  color: string;
}

export interface PdfPath {
  pts: PdfPoint[];
  closed: boolean;
  widthMm: number;
  color: string;
  dashMm?: [number, number];
}

export interface PdfText {
  at: PdfPoint;
  text: string;
  sizeMm: number;
  /** Graus, anti-horário. */
  rotation: number;
  center: boolean;
  color: string;
}

export interface PdfGroup {
  clip: PdfRect | null;
  fills: PdfFill[];
  paths: PdfPath[];
  texts: PdfText[];
}

export interface PdfSheet {
  widthMm: number;
  heightMm: number;
  groups: PdfGroup[];
}
