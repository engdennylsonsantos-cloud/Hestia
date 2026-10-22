import type { MultiPolygon, Vec2 } from '@hestia/geom';
import type { HatchKind } from '@hestia/model';

export interface FillOp {
  polygons: MultiPolygon;
  color: string;
  alpha: number;
  /** Hachura por cima do preenchimento; `alpha` (0..1) é a transparência da categoria (decisão 0015 §2.4). */
  hatch?: { kind: HatchKind; color: string; alpha?: number };
  /** Faixa de contorno do elemento (não é superfície): fica no estilo arame e não sofre a transparência da categoria. */
  contour?: boolean;
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
  /** 'soft': rótulo mais claro (degrau acima do corte, decisão 0014 §1 item 9). */
  tone?: 'info' | 'accent' | 'soft';
  /** Texto de anotação (decisão 0019): tamanho da fonte em px de tela, rotação em graus, centrado em `at`. */
  fontPx?: number;
  rotation?: number;
  center?: boolean;
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
  /** Prévia da escada por tom (limites, espelhos, caminhada, patamar e degraus calculados). */
  stairBoundary: string;
  stairRiser: string;
  stairPath: string;
  stairLanding: string;
  stairTread: string;
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
  stairBoundary: '#2563eb',
  stairRiser: '#ea580c',
  stairPath: '#15803d',
  stairLanding: '#7e22ce',
  stairTread: '#64748b',
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
  stairBoundary: '#60a5fa',
  stairRiser: '#fb923c',
  stairPath: '#4ade80',
  stairLanding: '#c084fc',
  stairTread: '#94a3b8',
};
