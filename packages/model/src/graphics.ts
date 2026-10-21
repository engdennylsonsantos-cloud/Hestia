import type { DetailLevel, Id, Project } from './types.ts';

/**
 * Gráficos de vista (decisão 0015): pesos de linha por escala, estilo por categoria, estilo visual, visibilidade e
 * exibição parcial de estrutura. Tudo opcional no projeto: sem o campo vale o padrão deste módulo (sem migração).
 */

/** Categorias com estilo gráfico próprio (Revit: Object Styles; ArchiCAD: regras de substituição). */
export type GraphicsCategory = 'wall' | 'door' | 'window' | 'floor' | 'slab' | 'roof' | 'stair';
export const GRAPHICS_CATEGORIES: readonly GraphicsCategory[] = ['wall', 'door', 'window', 'floor', 'slab', 'roof', 'stair'];

/** Estilo visual (Revit: Visual Styles). Planta aceita wireframe, hiddenLine e shaded; o 3D aceita todos. */
export type VisualStyle = 'wireframe' | 'hiddenLine' | 'shaded' | 'consistentColors' | 'realistic';
export const PLAN_VISUAL_STYLES: readonly VisualStyle[] = ['wireframe', 'hiddenLine', 'shaded'];

/** Exibição parcial de estrutura (ArchiCAD: Partial Structure Display). */
export type PartialStructure = 'entire' | 'noFinishes' | 'coreOnly';

/** Estilo de linha por categoria: índices de peso de 1 a 16 (Revit), um para o corte e um para a projeção. */
export interface CategoryLineStyle {
  cutWeight: number;
  projectionWeight: number;
}

/** Substituição por categoria em uma vista (Revit: Visibility/Graphics Overrides). */
export interface CategoryOverride {
  visible: boolean;
  /** 0 = opaco, 1 = invisível (só 3D e preenchimentos). */
  transparency: number;
  /** Meio-tom: mistura as cores com o papel (planta) ou clareia (3D). */
  halftone: boolean;
  /** Substitui o peso (1–16) ou a cor (#rrggbb) só nesta vista; ausente = vale o do projeto. */
  cutWeight?: number;
  projectionWeight?: number;
  color?: string;
}

export interface ProjectGraphics {
  /**
   * Tabela de pesos de linha (Revit: Line Weights): 16 linhas (peso 1..16), 3 colunas em mm de papel para as escalas
   * 1:50, 1:100 e 1:200. Escala mais fechada que 1:50 usa a coluna de 1:50; entre faixas vale a coluna da escala igual
   * ou mais larga (ver `lineWeightMm`).
   */
  lineWeights: ReadonlyArray<readonly [number, number, number]>;
  categories: Record<GraphicsCategory, CategoryLineStyle>;
  /** Escalas (denominador) até onde cada nível de detalhe vale: fino até `fineMax`, médio até `mediumMax`, depois grosso. */
  detailByScale: { fineMax: number; mediumMax: number };
}

/** Gráficos de uma planta (um por nível). */
export interface ViewGraphics {
  /** Denominador da escala (100 = 1:100). */
  scale: number;
  /** 'byScale' = pelo `detailByScale` do projeto. */
  detail: DetailLevel | 'byScale';
  style: VisualStyle;
  partialStructure: PartialStructure;
  overrides: Record<GraphicsCategory, CategoryOverride>;
}

/** Gráficos do modelo 3D (o app tem uma vista 3D). */
export interface View3DSettings {
  style: VisualStyle;
  partialStructure: PartialStructure;
  overrides: Record<GraphicsCategory, CategoryOverride>;
  shadows: boolean;
  /** Arestas e silhuetas. */
  edges: boolean;
  /** Direção do sol: azimute (graus, 0 = leste, anti-horário) e elevação (graus acima do horizonte). */
  sunAzimuth: number;
  sunElevation: number;
  /** Cor de fundo (#rrggbb); null = pelo tema. */
  background: string | null;
}

/** Tabela do template padrão do Revit (mm de papel, 1:50 | 1:100 | 1:200). Fonte: docs/visualizacao/C-relatorio-pesquisa.md (c) [SECUNDÁRIO]. */
export const DEFAULT_LINE_WEIGHTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.18, 0.1, 0.1],
  [0.25, 0.18, 0.1],
  [0.35, 0.25, 0.18],
  [0.5, 0.35, 0.25],
  [0.7, 0.5, 0.35],
  [1.0, 0.7, 0.5],
  [1.4, 1.0, 0.7],
  [2.0, 1.4, 1.0],
  [2.8, 2.0, 1.4],
  [4.0, 2.8, 2.0],
  [5.0, 4.0, 2.8],
  [6.0, 5.0, 4.0],
  [7.0, 6.0, 5.0],
  [8.0, 7.0, 6.0],
  [9.0, 8.0, 7.0],
  [9.0, 9.0, 8.0],
];

/**
 * Pesos padrão por categoria, na escolha do Hestia (NBR 6492 A.1: corte com hachura = larga; projeção, janela/porta e
 * escada simplificadas = larga/estreita; escolha dependente da escala, ver 0015 §2).
 */
export const DEFAULT_CATEGORY_STYLES: Record<GraphicsCategory, CategoryLineStyle> = {
  wall: { cutWeight: 5, projectionWeight: 2 },
  door: { cutWeight: 3, projectionWeight: 2 },
  window: { cutWeight: 3, projectionWeight: 2 },
  floor: { cutWeight: 4, projectionWeight: 1 },
  slab: { cutWeight: 5, projectionWeight: 1 },
  roof: { cutWeight: 5, projectionWeight: 2 },
  stair: { cutWeight: 3, projectionWeight: 2 },
};

export const DEFAULT_PROJECT_GRAPHICS: ProjectGraphics = {
  lineWeights: DEFAULT_LINE_WEIGHTS,
  categories: DEFAULT_CATEGORY_STYLES,
  detailByScale: { fineMax: 50, mediumMax: 200 },
};

export const defaultOverride = (): CategoryOverride => ({ visible: true, transparency: 0, halftone: false });
export const defaultOverrides = (): Record<GraphicsCategory, CategoryOverride> => ({
  wall: defaultOverride(),
  door: defaultOverride(),
  window: defaultOverride(),
  floor: defaultOverride(),
  slab: defaultOverride(),
  roof: defaultOverride(),
  stair: defaultOverride(),
});

export const DEFAULT_VIEW_GRAPHICS: ViewGraphics = {
  scale: 100,
  detail: 'byScale',
  style: 'hiddenLine',
  partialStructure: 'entire',
  overrides: defaultOverrides(),
};

export const DEFAULT_VIEW_3D: View3DSettings = {
  style: 'realistic',
  partialStructure: 'entire',
  overrides: defaultOverrides(),
  shadows: true,
  edges: true,
  sunAzimuth: 315,
  sunElevation: 55,
  background: null,
};

/** Largura da linha em mm de papel: peso (1–16, fora disso é limitado) na escala 1:`scale`. */
export function lineWeightMm(table: ProjectGraphics['lineWeights'], weight: number, scale: number): number {
  const row = table[Math.min(Math.max(Math.round(weight), 1), table.length) - 1] ?? table[0]!;
  return scale <= 50 ? row[0] : scale <= 100 ? row[1] : row[2];
}

/** Nível de detalhe efetivo da vista (Revit: Detail Level by view scale). */
export function detailOf(g: Pick<ViewGraphics, 'detail' | 'scale'>, pg: ProjectGraphics = DEFAULT_PROJECT_GRAPHICS): DetailLevel {
  if (g.detail !== 'byScale') return g.detail;
  return g.scale <= pg.detailByScale.fineMax ? 'fine' : g.scale <= pg.detailByScale.mediumMax ? 'medium' : 'coarse';
}

/** Largura em pixels de tela de uma linha de `mm` de papel numa vista de `zoom` px/m na escala 1:`scale` (mínimo 1 px). */
export function paperMmToPx(mm: number, zoom: number, scale: number): number {
  return Math.max(1, (mm * zoom * scale) / 1000);
}

const mergeOverrides = (saved: Partial<Record<GraphicsCategory, Partial<CategoryOverride>>> | undefined): Record<GraphicsCategory, CategoryOverride> => {
  const out = defaultOverrides();
  for (const c of GRAPHICS_CATEGORIES) out[c] = { ...out[c], ...(saved?.[c] ?? {}) };
  return out;
};

/** Gráficos do projeto com os padrões aplicados (qualquer subconjunto salvo vale). */
export function graphicsOf(p: Pick<Project, 'graphics'>): ProjectGraphics {
  const g = p.graphics;
  const categories = { ...DEFAULT_CATEGORY_STYLES };
  for (const c of GRAPHICS_CATEGORIES) categories[c] = { ...categories[c], ...(g?.categories?.[c] ?? {}) };
  return {
    lineWeights: g?.lineWeights?.length ? g.lineWeights : DEFAULT_LINE_WEIGHTS,
    categories,
    detailByScale: { ...DEFAULT_PROJECT_GRAPHICS.detailByScale, ...(g?.detailByScale ?? {}) },
  };
}

/** Gráficos da planta de um nível com os padrões aplicados. Nível inexistente: o padrão. */
export function levelGraphicsOf(p: Pick<Project, 'levels'>, levelId: Id): ViewGraphics {
  const g = p.levels.find((l) => l.id === levelId)?.graphics;
  return { ...DEFAULT_VIEW_GRAPHICS, ...(g ?? {}), overrides: mergeOverrides(g?.overrides) };
}

/** Gráficos do 3D com os padrões aplicados. */
export function view3dOf(p: Pick<Project, 'view3d'>): View3DSettings {
  const g = p.view3d;
  return { ...DEFAULT_VIEW_3D, ...(g ?? {}), overrides: mergeOverrides(g?.overrides) };
}
