import type { DetailLevel, GraphicsCategory, PartialStructure, VisualStyle } from '@hestia/model';

/** Rótulos pt-BR dos gráficos de vista (decisão 0015 §3), compartilhados pelas propriedades e pelos diálogos. */

export const CATEGORY_LABEL: Record<GraphicsCategory, string> = {
  wall: 'Parede',
  door: 'Porta',
  window: 'Janela',
  floor: 'Piso',
  slab: 'Laje',
  roof: 'Telhado',
  stair: 'Escada',
  room: 'Ambiente',
  annotation: 'Anotação',
  generic: 'Objeto importado',
};

export const VISUAL_STYLE_LABEL: Record<VisualStyle, string> = {
  wireframe: 'Aramado',
  hiddenLine: 'Linhas ocultas',
  shaded: 'Sombreado',
  consistentColors: 'Cores consistentes',
  realistic: 'Realista',
};

export const PARTIAL_LABEL: Record<PartialStructure, string> = {
  entire: 'Modelo inteiro',
  noFinishes: 'Sem acabamentos',
  coreOnly: 'Só núcleo',
};

export const DETAIL_LABEL: Record<DetailLevel | 'byScale', string> = {
  byScale: 'Por escala',
  coarse: 'Grosso',
  medium: 'Médio',
  fine: 'Fino',
};

/** Escalas oferecidas na planta (denominador). Qualquer outra vem do campo livre. */
export const PLAN_SCALES: readonly number[] = [20, 50, 100, 200, 500];

/** Pesos de linha do Revit (1 a 16) para a lista dos estilos por categoria. */
export const WEIGHTS: readonly number[] = Array.from({ length: 16 }, (_, i) => i + 1);
