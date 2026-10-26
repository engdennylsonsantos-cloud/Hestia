import type { Id, Project } from '@hestia/model';
import type { ResolvedLevel } from '@hestia/engine';
import type { Inference, PreviewItem } from '@hestia/tools';
import type { Viewport } from '../viewport.ts';
import { gridCovers, gridLayer, type GridLayer } from './grid.ts';
import type { PlanSlot, PlanScene } from './gpuPlan.ts';
import { buildPlanGeometry, buildPlanScreenOverlay, planBelowOf, planGeometrySelection } from './build.ts';
import type { FillOp, LabelOp, PlanDrawList, PlanOps, PlanTheme, StrokeOp } from './types.ts';

/** Estado da planta que o quadro lê: o projeto, o nível, a vista e as opções; `version` é a versão do projeto. */
export interface PlanViewState {
  project: Project;
  version: number;
  levelId: Id;
  v: Viewport;
  theme: PlanTheme;
  dark: boolean;
  gpu: boolean;
  showGrid: boolean;
  showUnderlay: boolean;
  showRoofProjection: boolean;
  thinLines: boolean;
  selection: Id[];
  hover: Id | null;
  preview: PreviewItem[];
  inference: Inference | null;
  /** Resolução do nível (o app a guarda em cache). */
  resolve: (id: Id) => ResolvedLevel;
}

/** Resolução vazia do nível atual: a planta normal não a lê (ver `planFrameUpdateOf`). */
export function resolucaoVazia(levelId: Id): ResolvedLevel {
  return { levelId, walls: {}, clusters: [] };
}

/**
 * Atualização do quadro a partir do estado da planta: as chaves (a geometria só depende do que ela lê; a sobreposição, do
 * que aparece sobre ela) e as funções que refazem cada camada, chamadas só quando a chave muda.
 */
export function planFrameUpdateOf(s: PlanViewState): PlanFrameUpdate {
  const { project: p, levelId, v, theme, dark } = s;
  const geoSel = planGeometrySelection(p, levelId, s.selection);
  // A planta normal não usa a resolução do nível atual: `planViewOf` refaz a geometria com o corte (ver `planContext`).
  // Só a planta de cobertura (`roofPlanMode`) lê `resolved`, e este quadro não a liga. Por isso não se resolve o nível
  // atual aqui: resolvê-lo seria o dobro de trabalho na abertura. O nível de baixo continua resolvido (ver `planBelowOf`).
  const base = { project: p, levelId, resolved: resolucaoVazia(levelId), viewport: v, theme, dark, showGrid: s.showGrid, thinLines: s.thinLines, showRoofProjection: s.showRoofProjection };
  return {
    v,
    theme,
    gpu: s.gpu,
    showGrid: s.showGrid,
    geometryKey: `${s.version}|${levelId}|${dark}|${v.zoom}|${s.showUnderlay}|${s.showRoofProjection}|${geoSel.join(',')}`,
    overlayKey: `${s.version}|${levelId}|${dark}|${v.zoom}|${s.selection.join(',')}|${s.hover}|${JSON.stringify(s.preview)}|${JSON.stringify(s.inference)}`,
    // Só a geometria lê o nível de baixo: as referências são resolvidas apenas quando ela é refeita.
    geometry: () => buildPlanGeometry({ ...base, ...planBelowOf(p, levelId, s.resolve, s.showUnderlay), selection: geoSel, hover: null, preview: [], inference: null }),
    overlay: () => buildPlanScreenOverlay({ ...base, below: null, selection: s.selection, hover: s.hover, preview: s.preview, inference: s.inference }),
  };
}

/** O que a cena da planta precisa de uma vez: as chaves dizem quando cada camada muda; as funções a refazem. */
export interface PlanFrameUpdate {
  v: Viewport;
  theme: PlanTheme;
  /** Desenha na cena da GPU. Sem ela (modo CPU) as chaves e as camadas em memória continuam valendo. */
  gpu: boolean;
  showGrid: boolean;
  /**
   * Chave da geometria do nível: projeto, nível, tema, zoom, opções de vista e o que a geometria lê da seleção (só as
   * cotas). Pan, cursor, ferramenta e a maior parte da seleção ficam fora dela.
   */
  geometryKey: string;
  /** Chave da sobreposição: projeto, nível, tema, zoom, seleção, cursor, pré-visualização e ferramenta. */
  overlayKey: string;
  geometry: () => PlanOps;
  overlay: () => PlanOps;
}

/** Cena que recebe as camadas (a GPU da planta). */
export type PlanSceneSink = Pick<PlanScene, 'setSlot' | 'setBackground'>;

const EMPTY: PlanOps = { fills: [], strokes: [], labels: [] };

/** Mesma vista (centro, zoom e tamanho); `null` só é igual a `null`. */
export function sameView(a: Viewport | null, b: Viewport | null): boolean {
  if (a === null || b === null) return a === b;
  return a.cx === b.cx && a.cy === b.cy && a.zoom === b.zoom && a.width === b.width && a.height === b.height;
}

/** Dois conjuntos de rótulos com o mesmo conteúdo (texto, posição e estilo), na mesma ordem. */
export function sameLabels(a: readonly LabelOp[], b: readonly LabelOp[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.at.x !== y.at.x || x.at.y !== y.at.y || x.text !== y.text || x.dx !== y.dx || x.dy !== y.dy) return false;
    if (x.tone !== y.tone || x.fontPx !== y.fontPx || x.rotation !== y.rotation || x.center !== y.center) return false;
    if (x.widthPx !== y.widthPx || x.bold !== y.bold || x.italic !== y.italic || x.underline !== y.underline || x.align !== y.align) return false;
    if (x.maskColor !== y.maskColor || x.maskBorderColor !== y.maskBorderColor || x.maskBoundary?.length !== y.maskBoundary?.length) return false;
    if (x.maskBoundary && y.maskBoundary && x.maskBoundary.some((p, j) => p.x !== y.maskBoundary![j]!.x || p.y !== y.maskBoundary![j]!.y)) return false;
  }
  return true;
}

/**
 * Quadro da planta: decide, a cada atualização, quais camadas da cena refazer. A geometria do nível só é refeita quando
 * a sua chave muda; a sobreposição, quando a dela muda; a grade, quando o zoom, o tema ou a vista saem da área que ela
 * cobre. Pan dentro da área coberta não refaz nenhuma camada: só a câmera (feita por quem chama).
 */
export class PlanFrame {
  private geomKey: string | null = null;
  private ovKey: string | null = null;
  private gridKey: string | null = null;
  private grid: GridLayer | null = null;
  private gridOn = false;
  private geom: PlanOps = EMPTY;
  private ov: PlanOps = EMPTY;
  private bg: string | null = null;
  /** Rótulos da planta (geometria e sobreposição). Trocam de referência só quando o conteúdo muda. */
  private labelsValue: LabelOp[] = [];

  constructor(private readonly scene: PlanSceneSink) {}

  /** Rótulos atuais. Mesma referência enquanto o conteúdo não muda: quem exibe compara por ela. */
  get labels(): LabelOp[] {
    return this.labelsValue;
  }

  /** Esquece o que está na cena (por exemplo ao sair da vista de corte): o próximo quadro refaz tudo. */
  reset(): void {
    this.geomKey = null;
    this.ovKey = null;
    this.gridKey = null;
    this.grid = null;
    this.gridOn = false;
    this.geom = EMPTY;
    this.ov = EMPTY;
    this.bg = null;
    this.labelsValue = [];
  }

  update(u: PlanFrameUpdate): void {
    const { v, theme } = u;
    const sink = u.gpu ? this.scene : null;
    if (this.bg !== theme.bg) {
      this.bg = theme.bg;
      sink?.setBackground(theme.bg);
    }

    // Grade: só as linhas e a largura (que sai pelo zoom) dependem da vista; o pan dentro da área coberta não a refaz.
    this.gridOn = u.showGrid;
    if (!u.showGrid) {
      if (this.gridKey !== null) this.setSlot(sink, 'grid', [], [], v);
      this.gridKey = null;
      this.grid = null;
    } else {
      const gk = `${v.zoom}|${theme.gridMinor}|${theme.gridMajor}|${theme.inkSoft}`;
      if (this.grid === null || this.gridKey !== gk || !gridCovers(this.grid, v)) {
        this.grid = gridLayer(v, theme);
        this.gridKey = gk;
        this.setSlot(sink, 'grid', [], this.grid.strokes, v);
      }
    }

    let labelsChanged = false;
    if (u.geometryKey !== this.geomKey) {
      this.geomKey = u.geometryKey;
      this.geom = u.geometry();
      this.setSlot(sink, 'fillsBase', this.geom.fills, [], v);
      this.setSlot(sink, 'strokesBase', [], this.geom.strokes, v);
      labelsChanged = true;
    }
    if (u.overlayKey !== this.ovKey) {
      this.ovKey = u.overlayKey;
      const next = u.overlay();
      this.setSlot(sink, 'fillsOver', next.fills, [], v);
      this.setSlot(sink, 'strokesOver', [], next.strokes, v);
      // Rótulos iguais aos de antes mantêm a referência: a sobreposição muda a cada movimento sem mudar as etiquetas.
      const same = sameLabels(this.ov.labels, next.labels);
      if (!same) labelsChanged = true;
      this.ov = { fills: next.fills, strokes: next.strokes, labels: same ? this.ov.labels : next.labels };
    }
    if (labelsChanged) this.labelsValue = [...this.geom.labels, ...this.ov.labels];
  }

  /** Lista de desenho completa (para o modo CPU e para a conferência): mesma ordem de desenho da cena. */
  drawList(theme: PlanTheme): PlanDrawList {
    return {
      background: theme.bg,
      fills: [...this.geom.fills, ...this.ov.fills],
      strokes: [...(this.gridOn && this.grid ? this.grid.strokes : []), ...this.geom.strokes, ...this.ov.strokes],
      labels: this.labelsValue,
    };
  }

  private setSlot(sink: PlanSceneSink | null, slot: PlanSlot, fills: FillOp[], strokes: StrokeOp[], v: Viewport): void {
    sink?.setSlot(slot, fills, strokes, v);
  }
}
