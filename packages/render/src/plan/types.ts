import type { MultiPolygon, Vec2 } from '@hestia/geom';
import type { HatchKind } from '@hestia/model';

export interface FillOp {
  polygons: MultiPolygon;
  color: string;
  alpha: number;
  /**
   * Hachura por cima do preenchimento; `alpha` (0..1) é a transparência da categoria (decisão 0015 §2.4). `zoomMin`: só
   * aparece a partir deste zoom (px/m): o shader a esconde abaixo dele, e a geometria não muda com o zoom.
   */
  hatch?: { kind: HatchKind; color: string; alpha?: number; zoomMin?: number };
  /** Faixa de contorno do elemento (não é superfície): fica no estilo arame e não sofre a transparência da categoria. */
  contour?: boolean;
  /**
   * Faixa de contorno em papel: `polygons` é a região do elemento, e a faixa (que `contour` marca) é a região menos o
   * recuo dela pela espessura corrente (`larguraEmPx`), calculada com o zoom por quem consome (`resolverZoom`, ou a
   * cena da GPU). Assim a geometria do nível não guarda polígono nenhum que dependa do zoom.
   */
  faixa?: Espessura;
  /**
   * Marcador em pixels de tela: o mesmo formato de `polygons`; cada vértice sai deslocado de `deslocamentoPx / zoom`
   * (em metros) da posição de `polygons`. O tamanho do marcador não muda com o zoom na tela.
   */
  deslocamentoPx?: Vec2[][][];
}

/**
 * Espessura em mm de papel na escala 1:`escala`. A GPU converte com o zoom corrente (piso de 1 px, depois `fator` e
 * `teto`), então o zoom não entra na geometria do traço.
 */
export interface PesoPapel {
  mm: number;
  escala: number;
  /** Fator sobre a largura já com o piso de 1 px (peso do traço dentro de um símbolo, seleção); ausente = 1. */
  fator?: number;
  /** Largura máxima em px (linhas finas da tela: nunca passam de 1 px); ausente = sem teto. */
  teto?: number;
}

/** Espessura de um traço: `widthPx` é a largura em pixels no zoom de construção; `papel`, quando existe, manda na GPU. */
export interface Espessura {
  widthPx: number;
  papel?: PesoPapel;
}

export interface StrokeOp {
  pts: Vec2[];
  closed: boolean;
  /**
   * Espessura em pixels de tela, no zoom em que o traço foi montado. Com `papel`, a espessura real sai do zoom corrente
   * (ver `larguraEmPx`); sem `papel`, vale esta.
   */
  widthPx: number;
  /** Peso de papel do traço (categorias de desenho): a GPU aplica o zoom no shader, sem refazer a geometria. */
  papel?: PesoPapel;
  color: string;
  alpha: number;
  /** [traço, vão] em pixels. */
  dash?: [number, number];
  /** Marcador em pixels de tela: cada ponto sai deslocado de `deslocamentoPx[i] / zoom` (m); mesmo tamanho para qualquer zoom. */
  deslocamentoPx?: Vec2[];
  /** Só aparece a partir deste zoom (px/m): o shader esconde o traço abaixo dele; ausente = sempre. */
  zoomMin?: number;
}

/**
 * Medidas de um rótulo em mm de papel (a conta com o zoom e a escala é feita no quadro, não na geometria): o corpo da
 * fonte e um deslocamento ao longo de (`ux`, `uy`). `ux` e `uy` ausentes não geram `dx` e `dy`.
 */
export interface PapelRotulo {
  escala: number;
  fontMm?: number;
  desvio?: { mm: number; ux?: number; uy?: number };
  /** Largura de quebra do texto em mm de papel: vira `widthPx` com o zoom corrente. */
  widthMm?: number;
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
  widthPx?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Polígono de máscara em coordenadas de modelo, desenhado sobre o canvas na camada sincronizada de anotação. */
  maskBoundary?: Vec2[];
  maskColor?: string;
  maskBorderColor?: string;
  /** Medidas em papel: `resolverZoom` as converte em `fontPx`, `dx` e `dy` com o zoom corrente. */
  papel?: PapelRotulo;
}

/** Lista de desenho neutra: tanto o renderizador de GPU quanto o de CPU a consomem. */
export interface PlanDrawList {
  background: string;
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
}

/**
 * Uma camada da planta (geometria do nível ou sobreposição), sem o fundo. A geometria do nível não guarda medida em
 * pixels resolvida com o zoom: faixas, marcadores e rótulos levam a especificação (`faixa`, `deslocamentoPx`, `papel`),
 * e `resolverZoom` a converte no zoom corrente. As decisões que mudam com o zoom (hachura, detalhe) ficam em `limiares`.
 */
export interface PlanOps {
  fills: FillOp[];
  strokes: StrokeOp[];
  labels: LabelOp[];
  /**
   * Zooms em que alguma decisão da geometria muda de lado (hachura a partir de 40 px/m, espessura equivalente de uma região
   * a 5 px, interface entre materiais a 1,6 px...), em ordem crescente e sem repetição. Entre dois limiares seguidos a
   * geometria é a mesma; só a camada que os guarda precisa saber disso (ver `assinaturaDeZoom`).
   */
  limiares?: number[];
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
  /** Pegada do telhado com balanço: contorno tracejado de 1 px (o desenho que o usuário traçou, sem o beiral). */
  roofFootprint: string;
  /** Seta de caimento do telhado na planta (1 px): verde, para não se confundir com a tinta do desenho. */
  roofSlope: string;
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
  roofFootprint: '#c2185b',
  roofSlope: '#1f6f5c',
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
  roofFootprint: '#ff6fb0',
  roofSlope: '#5cc3a6',
};
