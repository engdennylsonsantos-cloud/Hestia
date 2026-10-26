import { computeSection, frameOfWall, openingGeometry, resolveLevel, type OpeningGeometry, type SectionLine, type SectionResult } from '@hestia/engine';
import { buildPlanDrawList, buildSectionDrawList, DARK, LIGHT, sectionBox, type PlanDrawList, type PlanTheme } from '@hestia/render';
import { openingAngle2d, type Opening, type OpeningLineConvention, type OpeningType, type Project } from '@hestia/model';
import { drawListToSvg, expandDrawBox, type DrawBox } from './drawListToSvg.ts';
import { previewOpening, previewProject, previewWall } from './previewProject.ts';

export type PreviewViewKind = 'plan' | 'elevation' | 'section';

export interface PreviewViewOptions {
  flipHand?: boolean;
  flipFacing?: boolean;
  /** Ângulo do controle da prévia (graus); no plano entra como `angle2d` e no 3D como `angle3d`. */
  angle?: number;
  dark?: boolean;
  width?: number;
  height?: number;
  /** Convenção do V do projeto; ausente usa o padrão por leitura (`latch`/`toward`). */
  openingLine?: OpeningLineConvention;
}

export interface PreviewDraw {
  drawList: PlanDrawList;
  /** Enquadramento em metros, com 0,5 m de margem em volta do vão. */
  box: DrawBox;
  svg: string;
}

const MARGIN = 0.5;

const themeOf = (dark: boolean): PlanTheme => (dark ? DARK : LIGHT);
const clampAngle = (angle: number): number => Math.max(0, Math.min(120, angle));

/** Projeto com o tipo de prévia trocado no catálogo (para o plano usar o detalhe e o ângulo do diálogo). */
function withType(p: Project, type: OpeningType): Project {
  return { ...p, openingTypes: { ...p.openingTypes, [type.id]: type } };
}

/** Projeto com a convenção do V do projeto real (as vistas de seção e de 3D a leem de `settings`). */
function withSettings(p: Project, options: PreviewViewOptions): Project {
  if (!options.openingLine) return p;
  return { ...p, settings: { ...p.settings, openingLine: options.openingLine } };
}

function openingOf(p: Project): { opening: Opening; geometry: OpeningGeometry } | null {
  const opening = previewOpening(p);
  if (!opening) return null;
  const frame = frameOfWall(p, opening.hostId);
  if (!frame) return null;
  return { opening, geometry: openingGeometry(p, opening, frame) };
}

/** Caixa do vão no mundo, com a margem de 0,5 m em volta da largura e da espessura. */
function planBox(p: Project, margin = MARGIN): DrawBox {
  const found = openingOf(p);
  if (!found) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  const { geometry: g } = found;
  return {
    minX: g.center.x - g.width / 2 - margin,
    maxX: g.center.x + g.width / 2 + margin,
    minY: g.center.y - g.thickness / 2 - margin,
    maxY: g.center.y + g.thickness / 2 + margin,
  };
}

/** Tipo para o plano: `detail2d` efetivo (em `'scale'` usa o médio) e o `angle2d` do controle. */
function planType(type: OpeningType, angle: number | undefined): OpeningType {
  const detail = type.detail2d && type.detail2d !== 'scale' ? type.detail2d : 'mid';
  return { ...type, detail2d: detail, angle2d: clampAngle(angle ?? openingAngle2d(type)) };
}

/**
 * Lista de desenho da planta pelo pipeline do projeto (`render/plan`), com o detalhe 2D do tipo e o corte padrão da
 * vista. O enquadramento é o vão com 0,5 m de margem.
 */
export function previewPlanDrawList(type: OpeningType, options: PreviewViewOptions = {}): { drawList: PlanDrawList; box: DrawBox } {
  const base = previewProject(type, options.flipHand ?? false, options.flipFacing ?? false);
  const p = withType(withSettings(base, options), planType(type, options.angle));
  const levelId = p.levels[0]!.id;
  const wall = previewWall(p);
  const center = wall ? (wall.a.x + wall.b.x) / 2 : 0;
  const viewport = { cx: center, cy: 0, zoom: 100, width: 800, height: 600 };
  const drawList = buildPlanDrawList({
    project: p,
    levelId,
    resolved: resolveLevel(p, levelId),
    below: null,
    viewport,
    theme: themeOf(options.dark ?? false),
    dark: options.dark ?? false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: false,
  });
  return { drawList, box: planBox(p) };
}

/** Linha de elevação paralela à parede, com o observador do lado `+n` (a tela cresce no sentido de `d`). */
function elevationLine(p: Project): SectionLine {
  const wall = previewWall(p);
  const length = wall ? Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) : 6;
  return { a: { x: length, y: 1 }, b: { x: 0, y: 1 }, depth: 2 };
}

/** Linha de corte perpendicular à parede pelo centro do vão. */
function crossLine(p: Project): SectionLine {
  const found = openingOf(p);
  const x = found?.geometry.center.x ?? 0;
  return { a: { x, y: -1 }, b: { x, y: 1 }, depth: 2 };
}

/** Caixa da vista de seção em (distância ao longo da linha, cota), com a margem de 0,5 m. */
function sectionViewBox(section: SectionResult, cut: boolean): DrawBox {
  const opening = section.openings[0];
  if (!opening) {
    const b = sectionBox(section);
    return expandDrawBox(b, MARGIN);
  }
  const cx = (opening.t0 + opening.t1) / 2;
  const span = cut ? opening.model.thickness : opening.model.width;
  return {
    minX: cx - span / 2 - MARGIN,
    maxX: cx + span / 2 + MARGIN,
    minY: opening.z0 - MARGIN,
    maxY: opening.z1 + MARGIN,
  };
}

function sectionDraw(type: OpeningType, cut: boolean, options: PreviewViewOptions): { drawList: PlanDrawList; box: DrawBox } {
  const p = withSettings(previewProject(type, options.flipHand ?? false, options.flipFacing ?? false), options);
  const section = computeSection(p, cut ? crossLine(p) : elevationLine(p));
  const dark = options.dark ?? false;
  const drawList = buildSectionDrawList({
    project: p,
    section,
    viewport: { cx: 0, cy: 1.5, zoom: 100, width: 800, height: 600 },
    theme: themeOf(dark),
    dark,
    showGrid: false,
  });
  return { drawList, box: sectionViewBox(section, cut) };
}

/** Lista de desenho da elevação pelo pipeline de seção (`engine/section` + `render/section`). */
export function previewElevationDrawList(type: OpeningType, options: PreviewViewOptions = {}): { drawList: PlanDrawList; box: DrawBox } {
  return sectionDraw(type, false, options);
}

/** Lista de desenho do corte transversal pelo pipeline de seção, com a linha passando no centro do vão. */
export function previewSectionDrawList(type: OpeningType, options: PreviewViewOptions = {}): { drawList: PlanDrawList; box: DrawBox } {
  return sectionDraw(type, true, options);
}

function svgOf(drawList: PlanDrawList, box: DrawBox, options: PreviewViewOptions, title: string): string {
  return drawListToSvg(drawList, box, { width: options.width, height: options.height, title });
}

export function previewPlanSvg(type: OpeningType, options: PreviewViewOptions = {}): string {
  const { drawList, box } = previewPlanDrawList(type, options);
  return svgOf(drawList, box, options, 'Planta da esquadria');
}

export function previewElevationSvg(type: OpeningType, options: PreviewViewOptions = {}): string {
  const { drawList, box } = previewElevationDrawList(type, options);
  return svgOf(drawList, box, options, 'Elevação da esquadria');
}

export function previewSectionSvg(type: OpeningType, options: PreviewViewOptions = {}): string {
  const { drawList, box } = previewSectionDrawList(type, options);
  return svgOf(drawList, box, options, 'Corte da esquadria');
}

/**
 * Assinatura visual do tipo: só os campos que mudam o desenho (nome, código, custo e dados BIM ficam de fora). É a
 * chave do cache das miniaturas.
 */
export function previewTypeSignature(type: OpeningType): string {
  return JSON.stringify([
    type.kind,
    type.plan,
    type.leaves,
    type.width,
    type.height,
    type.sill,
    type.frameMaterialId,
    type.glassMaterialId,
    type.closure,
    type.frameWidth,
    type.frameDepth,
    type.leafThickness,
    type.glassThickness,
    type.roughOversize,
    type.casing,
    type.sillBoard,
    type.lintel,
    type.sillBeam,
    type.leafStyle,
    type.handle,
    type.frameStyle,
    type.grid,
    type.transom,
    type.sidelights,
    type.angle2d,
    type.angle3d,
    type.planDisplay,
    type.detail2d,
    type.detail3d,
    type.showSwing,
    type.swingStyle,
    type.leafSide,
  ]);
}

const miniCache = new Map<string, string>();
const MINI_CACHE_MAX = 96;

/** Miniatura (elevação) gerada pelo mesmo caminho da prévia grande, com cache por assinatura visual do tipo. */
export function previewMiniatureSvg(type: OpeningType, width = 96, height = 64): string {
  const key = `${previewTypeSignature(type)}|${width}x${height}`;
  const hit = miniCache.get(key);
  if (hit !== undefined) return hit;
  const svg = previewElevationSvg(type, { width, height });
  if (miniCache.size >= MINI_CACHE_MAX) miniCache.delete(miniCache.keys().next().value as string);
  miniCache.set(key, svg);
  return svg;
}

/** Esvazia o cache das miniaturas (testes). */
export function clearMiniatureCache(): void {
  miniCache.clear();
}
