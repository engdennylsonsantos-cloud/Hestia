import type { MultiPolygon, Vec2 } from '@hestia/geom';
import type { HatchKind } from '@hestia/model';

export interface FillOp {
  polygons: MultiPolygon;
  color: string;
  alpha: number;
  hatch?: { kind: HatchKind; color: string };
}

export interface StrokeOp {
  pts: Vec2[];
  closed: boolean;
  /** Espessura em pixels de tela. */
  widthPx: number;
  color: string;
  alpha: number;
  /** [traço, vão] em pixels. */
  dash?: [number, number];
}

export interface LabelOp {
  at: Vec2;
  text: string;
  /** Deslocamento em pixels a partir do ponto. */
  dx?: number;
  dy?: number;
  tone?: 'info' | 'accent';
}

/** Lista de desenho neutra: tanto o renderizador de GPU quanto o de CPU a consomem. */
export interface PlanDrawList {
  background: string;
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
}

export interface PlanTheme {
  bg: string;
  gridMinor: string;
  gridMajor: string;
  ink: string;
  inkSoft: string;
  accent: string;
  guide: string;
  select: string;
  underlay: string;
}

export const LIGHT: PlanTheme = {
  bg: '#fbfbfa',
  gridMinor: '#e9ebee',
  gridMajor: '#d6dae0',
  ink: '#16181c',
  inkSoft: '#7a828c',
  accent: '#0f766e',
  guide: '#c2410c',
  select: '#1d6fe0',
  underlay: '#b7bec7',
};

export const DARK: PlanTheme = {
  bg: '#16191d',
  gridMinor: '#23282e',
  gridMajor: '#2f363e',
  ink: '#e8eaee',
  inkSoft: '#7d8691',
  accent: '#2dd4bf',
  guide: '#fb923c',
  select: '#5aa2ff',
  underlay: '#4b5560',
};
