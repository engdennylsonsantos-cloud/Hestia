import type { MultiPolygon } from '@hestia/geom';

/**
 * Lista de desenho de uma prancha (decisão 0022), em mm de papel: origem no canto inferior esquerdo da folha e y para
 * cima, como o PDF. Cada grupo é pintado em ordem; grupo com `clip` só aparece dentro do retângulo (a caixa da vista).
 */
export interface SheetPoint {
  x: number;
  y: number;
}

export interface SheetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetFill {
  polygons: MultiPolygon;
  /** Cor já misturada com o branco do papel (a transparência não sai no papel). */
  color: string;
}

export interface SheetPath {
  pts: SheetPoint[];
  closed: boolean;
  widthMm: number;
  color: string;
  /** [traço, vão] em mm. */
  dashMm?: [number, number];
}

export interface SheetText {
  at: SheetPoint;
  text: string;
  sizeMm: number;
  /** Graus, anti-horário (como o PDF). */
  rotation: number;
  center: boolean;
  color: string;
}

export interface SheetGroup {
  clip: SheetRect | null;
  fills: SheetFill[];
  paths: SheetPath[];
  texts: SheetText[];
}

export interface SheetDrawList {
  widthMm: number;
  heightMm: number;
  groups: SheetGroup[];
}

/** Partes de uma vista já na coordenada da folha (mm), antes de entrarem num grupo com recorte. */
export type ViewportParts = Pick<SheetGroup, 'fills' | 'paths' | 'texts'>;

export const emptyParts = (): ViewportParts => ({ fills: [], paths: [], texts: [] });

