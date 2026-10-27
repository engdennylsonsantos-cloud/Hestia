import {
  OPENING_FRAME_DEFAULTS,
  openingCasing,
  openingHandle,
  openingLeafStyle,
  openingTiltAxis,
  type Id,
  type OpeningFrameDepthMode,
  type OpeningGlassKind,
  type OpeningLeafStyle,
  type OpeningType,
} from '@hestia/model';

/**
 * Campos do tipo que o diálogo edita com padrão por leitura. O valor mostrado é sempre o efetivo; ao gravar um valor
 * igual ao padrão o campo sai do tipo e volta à leitura (schema fechado, sem repetir o padrão).
 */
export type ReadDefaultField =
  | 'leafStyle'
  | 'handle'
  | 'frameStyle'
  | 'frameDepthMode'
  | 'angle2d'
  | 'angle3d'
  | 'grid'
  | 'detail2d'
  | 'detail3d'
  | 'planDisplay'
  | 'swingStyle'
  | 'glassRatio'
  | 'hinges'
  | 'glassKind'
  | 'tiltAxis'
  | 'leafMaterialId'
  | 'reveal'
  | 'casing'
  | 'threshold'
  | 'transom'
  | 'sidelights'
  | 'sillBoard'
  | 'lintel'
  | 'sillBeam'
  | 'roughOversize';

/** Padrões de leitura dos campos novos (os que ainda não têm leitor em `openingStyle.ts`). */
export const OPENING_FORM_DEFAULTS = {
  frameDepthMode: 'wall',
  revealDepth: 0,
  revealAnchor: 'face',
  casingSides: 'both',
  glassRatio: 0.5,
  hinges: 3,
  thresholdThickness: 0.03,
  glassKind: 'clear',
  tiltAxis: 0.5,
} as const;

/** Tipo de vidro efetivo: ausente/inválido vale vidro liso. */
export function openingFormGlassKind(t: Pick<OpeningType, 'glassKind'>): OpeningGlassKind {
  const v = t.glassKind;
  const valid: readonly OpeningGlassKind[] = ['clear', 'ribbed', 'smoke', 'green', 'bronze', 'frosted', 'wired', 'laminated', 'tempered'];
  return typeof v === 'string' && (valid as readonly string[]).includes(v) ? v : OPENING_FORM_DEFAULTS.glassKind;
}

/** Modo da profundidade do batente efetivo. */
export function openingFormFrameDepthMode(t: Pick<OpeningType, 'frameDepthMode'>): OpeningFrameDepthMode {
  const v = t.frameDepthMode;
  return v === 'core' || v === 'fixed' ? v : OPENING_FORM_DEFAULTS.frameDepthMode;
}

/** Recuo do batente efetivo (metros e âncora). */
export function openingFormReveal(t: Pick<OpeningType, 'reveal'>): { depth: number; anchor: 'face' | 'core' } {
  const r = t.reveal;
  const depth = typeof r?.depth === 'number' && Number.isFinite(r.depth) ? Math.min(0.15, Math.max(0, r.depth)) : OPENING_FORM_DEFAULTS.revealDepth;
  return { depth, anchor: r?.anchor === 'core' ? 'core' : OPENING_FORM_DEFAULTS.revealAnchor };
}

/** Lados do alizar efetivos ('both' quando ausente). */
export function openingFormCasingSides(t: Pick<OpeningType, 'casing'>): 'both' | 'swing' | 'opposite' {
  const v = t.casing?.sides;
  return v === 'swing' || v === 'opposite' ? v : OPENING_FORM_DEFAULTS.casingSides;
}

/** Fração de vidro da folha efetiva (0,1 a 0,9; padrão 0,5). */
export function openingFormGlassRatio(t: Pick<OpeningType, 'glassRatio'>): number {
  const v = t.glassRatio;
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(0.9, Math.max(0.1, v)) : OPENING_FORM_DEFAULTS.glassRatio;
}

/** Dobradiças efetivas (inteiro de 2 a 4; padrão 3). */
export function openingFormHinges(t: Pick<OpeningType, 'hinges'>): number {
  const v = t.hinges;
  return typeof v === 'number' && Number.isInteger(v) && v >= 2 && v <= 4 ? v : OPENING_FORM_DEFAULTS.hinges;
}

/** Soleira efetiva (espessura e material), ou null quando ausente/inválida. */
export function openingFormThreshold(t: Pick<OpeningType, 'threshold'>): { thickness: number; materialId?: Id } | null {
  const x = t.threshold;
  if (!x || typeof x.thickness !== 'number' || !Number.isFinite(x.thickness) || x.thickness <= 0) return null;
  return { thickness: x.thickness, ...(x.materialId ? { materialId: x.materialId } : {}) };
}

/** Material da folha efetivo: o próprio ou o do batente. */
export function openingFormLeafMaterial(t: Pick<OpeningType, 'leafMaterialId' | 'frameMaterialId'>): Id {
  return t.leafMaterialId ?? t.frameMaterialId;
}

/** Eixo da basculante efetivo (fração 0,2 a 0,8; padrão 0,5). */
export function openingFormTiltAxis(t: Pick<OpeningType, 'tiltAxis'>): number {
  return openingTiltAxis(t);
}

const sameReveal = (r: { depth: number; anchor: 'face' | 'core' }): boolean =>
  r.depth === OPENING_FORM_DEFAULTS.revealDepth && r.anchor === OPENING_FORM_DEFAULTS.revealAnchor;

/** Grava o recuo; igual ao padrão remove o campo inteiro. */
export function setOpeningReveal(t: OpeningType, reveal: { depth: number; anchor: 'face' | 'core' }): OpeningType {
  const next = { ...t };
  if (sameReveal(reveal)) delete next.reveal;
  else next.reveal = reveal;
  return next;
}

/** Liga/desliga a soleira; ligar grava espessura e material padrão. */
export function setOpeningThreshold(t: OpeningType, ligado: boolean, materialId?: Id): OpeningType {
  const next = { ...t };
  if (!ligado) {
    delete next.threshold;
    return next;
  }
  next.threshold = { thickness: OPENING_FORM_DEFAULTS.thresholdThickness, ...(materialId ? { materialId } : {}) };
  return next;
}

/** Espessura da soleira; sem soleira não cria o campo. */
export function setOpeningThresholdThickness(t: OpeningType, thickness: number): OpeningType {
  const cur = openingFormThreshold(t);
  if (!cur) return t;
  return { ...t, threshold: { ...cur, thickness } };
}

/** Material da soleira; sem soleira não cria o campo. */
export function setOpeningThresholdMaterial(t: OpeningType, materialId: Id): OpeningType {
  const cur = openingFormThreshold(t);
  if (!cur) return t;
  return { ...t, threshold: { ...cur, materialId } };
}

/** Lados do alizar: no padrão ('both') remove só a escolha, mantendo o alizar ligado. */
export function setOpeningCasingSides(t: OpeningType, sides: 'both' | 'swing' | 'opposite'): OpeningType {
  if (!t.casing) return t;
  const casing = { ...t.casing };
  if (sides === OPENING_FORM_DEFAULTS.casingSides) delete casing.sides;
  else casing.sides = sides;
  return { ...t, casing };
}

/** Liga a bandeira maxim-ar (fixed = false) ou fixa (padrão, campo removido). */
export function setOpeningTransomFixed(t: OpeningType, fixed: boolean): OpeningType {
  if (!t.transom) return t;
  const transom = { ...t.transom };
  if (fixed) delete transom.fixed;
  else transom.fixed = false;
  return { ...t, transom };
}

/** Estilo da folha efetivo; aceita também os estilos novos (`boards`, `fullglass`). */
export function openingFormLeafStyle(t: Pick<OpeningType, 'kind' | 'leafStyle'>): OpeningLeafStyle {
  const v = t.leafStyle;
  const valid: readonly OpeningLeafStyle[] = ['flush', 'panel', 'glass', 'louver', 'grille', 'boards', 'fullglass'];
  return typeof v === 'string' && (valid as readonly string[]).includes(v) ? v : openingLeafStyle(t);
}

/** Profundidade fixa do batente efetiva (o valor do tipo ou o padrão). */
export function openingFormFixedDepth(t: Pick<OpeningType, 'frameDepth'>): number {
  return typeof t.frameDepth === 'number' && Number.isFinite(t.frameDepth) && t.frameDepth > 0 ? t.frameDepth : OPENING_FRAME_DEFAULTS.frameDepth;
}

/** Alizar efetivo (largura/espessura), ou null quando ausente/zerado. */
export function openingFormCasing(t: Pick<OpeningType, 'casing'>): { width: number; thickness: number } | null {
  return openingCasing(t);
}

/** Maçaneta efetiva (leitor do modelo). */
export function openingFormHandle(t: Pick<OpeningType, 'kind' | 'plan' | 'leaves' | 'handle'>): string {
  return openingHandle(t);
}

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Grava `value` no campo só quando ele difere do padrão (`fallback`). Igual ao padrão remove o campo, de modo que o
 * seletor continue mostrando o valor efetivo sem engordar o schema fechado com repetições do padrão.
 */
export function withOpeningField(
  type: OpeningType,
  field: ReadDefaultField,
  value: unknown,
  fallback: unknown,
): OpeningType {
  const next = { ...type } as Record<string, unknown>;
  if (sameValue(value, fallback)) delete next[field];
  else next[field] = value;
  return next as unknown as OpeningType;
}
