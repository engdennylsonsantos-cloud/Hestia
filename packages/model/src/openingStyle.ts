import { openingFamilyOf } from './opening.ts';
import type { OpeningFrameStyle, OpeningHandle, OpeningLeafStyle, OpeningLineConvention, OpeningType, Project } from './types.ts';

/**
 * Leitura dos campos v2 da esquadria (`OpeningType`, bloco "Esquadria v2") com o padrão por leitura. Todos os campos
 * são opcionais e o schema é fechado (decisão 0034 §6): valor ausente, não finito ou fora da faixa cai no padrão, sem
 * migração e sem mudar a aparência de arquivos antigos.
 */

const LEAF_STYLES: readonly OpeningLeafStyle[] = ['flush', 'panel', 'glass', 'louver', 'grille'];
const HANDLES: readonly OpeningHandle[] = ['none', 'lever', 'knob', 'pull'];
const FRAME_STYLES: readonly OpeningFrameStyle[] = ['rebate', 'simple', 'aduela', 'block'];
const PLAN_DISPLAYS = ['symbolic', 'projected'] as const;
const DETAIL_2D = ['scale', 'low', 'mid', 'high', 'off'] as const;
const DETAIL_3D = ['view', 'schematic', 'simple', 'full', 'off'] as const;
const SWING_STYLES = ['arc', 'dash', 'line'] as const;
const LEAF_SIDES = ['swing', 'opposite'] as const;

/** Ângulos de abertura do tipo (graus): limitados a 0..120. */
export const OPENING_ANGLE_LIMITS = { min: 0, max: 120 } as const;
/** Fração da altura útil do eixo da basculante: limitada a 0,2..0,8 (padrão 0,5, eixo central). */
export const OPENING_TILT_AXIS_LIMITS = { min: 0.2, max: 0.8 } as const;
/** Divisões do caixilho (colunas × linhas): limitadas a 1..8. */
export const OPENING_GRID_LIMITS = { min: 1, max: 8 } as const;

function oneOf<T extends string>(v: unknown, valid: readonly T[], fallback: T): T {
  return typeof v === 'string' && (valid as readonly string[]).includes(v) ? (v as T) : fallback;
}

const boolOr = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Ângulo em graus do tipo, limitado a 0..120; inválido cai no padrão. */
function angleOr(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(OPENING_ANGLE_LIMITS.max, Math.max(OPENING_ANGLE_LIMITS.min, v));
}

function gridAxis(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return OPENING_GRID_LIMITS.min;
  return Math.min(OPENING_GRID_LIMITS.max, Math.max(OPENING_GRID_LIMITS.min, Math.round(v)));
}

/** Estilo da folha: porta 'flush' e janela 'glass' por padrão. */
export function openingLeafStyle(t: Pick<OpeningType, 'kind' | 'leafStyle'>): OpeningLeafStyle {
  return oneOf(t.leafStyle, LEAF_STYLES, t.kind === 'door' ? 'flush' : 'glass');
}

/** Maçaneta: 'lever' só na porta de giro e na porta dupla; 'none' nas demais famílias. */
export function openingHandle(t: Pick<OpeningType, 'kind' | 'plan' | 'leaves' | 'handle'>): OpeningHandle {
  const family = openingFamilyOf(t)?.id;
  const fallback: OpeningHandle = family === 'door_swing' || family === 'door_double' ? 'lever' : 'none';
  return oneOf(t.handle, HANDLES, fallback);
}

/** Estilo do batente: 'rebate' (com rebaixo) por padrão. */
export function openingFrameStyle(t: Pick<OpeningType, 'frameStyle'>): OpeningFrameStyle {
  return oneOf(t.frameStyle, FRAME_STYLES, 'rebate');
}

/** Divisões do caixilho/vidro (colunas × linhas de vidro), 1..8; padrão 1 × 1. */
export function openingGrid(t: Pick<OpeningType, 'grid'>): { cols: number; rows: number } {
  return { cols: gridAxis(t.grid?.cols), rows: gridAxis(t.grid?.rows) };
}

export interface OpeningTransom {
  /** Altura da bandeira (vidro fixo acima da folha) em metros. */
  height: number;
  /** Bandeira fixa (padrão); `false` desenha a travessa mas não a trata como fixa. */
  fixed: boolean;
}

/**
 * Bandeira superior do tipo, ou null quando ausente/inválida. A altura é limitada a 40% da altura do vão (spec E3 §7),
 * para a bandeira não engolir a folha.
 */
export function openingTransom(t: Pick<OpeningType, 'height' | 'transom'>): OpeningTransom | null {
  const x = t.transom;
  if (!x || typeof x.height !== 'number' || !Number.isFinite(x.height) || x.height <= 0) return null;
  return { height: Math.min(t.height * 0.4, x.height), fixed: x.fixed !== false };
}

export interface OpeningSidelights {
  left: boolean;
  right: boolean;
  width: number;
}

/** Bandeiras laterais (vidro fixo em cada lado marcado), ou null quando nenhum lado está ligado. */
export function openingSidelights(t: Pick<OpeningType, 'width' | 'sidelights'>): OpeningSidelights | null {
  const x = t.sidelights;
  if (!x) return null;
  const left = x.left === true;
  const right = x.right === true;
  if (typeof x.width !== 'number' || !Number.isFinite(x.width) || x.width <= 0) return null;
  if (!left && !right) return null;
  return { left, right, width: Math.min(x.width, t.width / 2) };
}

/** Ângulo de abertura em planta (graus) por símbolo: 90 no giro comum, 55 no dobrável e 60 na janela de abrir. */
function angle2dPadrao(plan: OpeningType['plan']): number {
  switch (plan) {
    case 'bifold':
      return 55;
    case 'accordion':
      return 75;
    case 'hinged':
      return 60;
    default:
      return 90;
  }
}

/** Ângulo de abertura em planta (graus): padrão por família (90, 55 no dobrável, 60 na janela de abrir), limitado a 0..120. */
export function openingAngle2d(t: Pick<OpeningType, 'plan' | 'angle2d'>): number {
  return angleOr(t.angle2d, angle2dPadrao(t.plan));
}

/**
 * Ângulo de abertura no 3D (graus) por símbolo: maxim-ar/basculante 30; veneziana 45; dobrável 70; sanfonada 75; os
 * demais 90. As famílias sem giro (embutir, seccionada, guilhotina e correr) devolvem 90 sem efeito, como manda a spec.
 * Limitado a 0..120.
 */
function angle3dPadrao(plan: OpeningType['plan']): number {
  switch (plan) {
    case 'casement':
    case 'tilt':
      return 30;
    case 'louver':
      return 45;
    case 'bifold':
      return 70;
    case 'accordion':
      return 75;
    default:
      return 90;
  }
}

/** Ângulo de abertura no 3D (graus): padrão por família, limitado a 0..120 (70 na veneziana, 60 na basculante). */
export function openingAngle3d(t: Pick<OpeningType, 'kind' | 'plan' | 'angle3d'>): number {
  const graus = angleOr(t.angle3d, angle3dPadrao(t.plan));
  if (t.plan === 'louver') return Math.min(70, graus);
  if (t.plan === 'tilt') return Math.min(60, graus);
  return graus;
}

/** Eixo horizontal da basculante como fração da altura útil (0,2 a 0,8; padrão 0,5, eixo central). */
export function openingTiltAxis(t: Pick<OpeningType, 'tiltAxis'>): number {
  const v = t.tiltAxis;
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0.5;
  return Math.min(OPENING_TILT_AXIS_LIMITS.max, Math.max(OPENING_TILT_AXIS_LIMITS.min, v));
}

/** Exibição em planta: 'symbolic' (padrão) ou 'projected'. */
export function openingPlanDisplay(t: Pick<OpeningType, 'planDisplay'>): 'symbolic' | 'projected' {
  return oneOf(t.planDisplay, PLAN_DISPLAYS, 'symbolic');
}

/** Nível de detalhe da planta: 'scale' (padrão), 'low' | 'mid' | 'high' | 'off'. */
export function openingDetail2d(t: Pick<OpeningType, 'detail2d'>): 'scale' | 'low' | 'mid' | 'high' | 'off' {
  return oneOf(t.detail2d, DETAIL_2D, 'scale');
}

/** Nível de detalhe do 3D: 'view' (padrão), 'schematic' | 'simple' | 'full' | 'off'. */
export function openingDetail3d(t: Pick<OpeningType, 'detail3d'>): 'view' | 'schematic' | 'simple' | 'full' | 'off' {
  return oneOf(t.detail3d, DETAIL_3D, 'view');
}

/** Arco de giro em planta: mostrar (padrão sim). */
export function openingShowSwing(t: Pick<OpeningType, 'showSwing'>): boolean {
  return boolOr(t.showSwing, true);
}

/** Estilo do arco de giro em planta: 'arc' (padrão), 'dash' ou 'line'. */
export function openingSwingStyle(t: Pick<OpeningType, 'swingStyle'>): 'arc' | 'dash' | 'line' {
  return oneOf(t.swingStyle, SWING_STYLES, 'arc');
}

/** Posição da folha na profundidade do batente: do lado em que abre ('swing', padrão) ou o oposto. */
export function openingLeafSide(t: Pick<OpeningType, 'leafSide'>): 'swing' | 'opposite' {
  return oneOf(t.leafSide, LEAF_SIDES, 'swing');
}

/**
 * Convenção da linha de abertura (V) do projeto: vértice no lado do trinco ('latch', padrão) e tracejada quando a
 * folha abre para o observador ('toward', padrão). Campos ausentes ou inválidos caem no padrão.
 */
export function openingLineConvention(p: Pick<Project, 'settings'>): OpeningLineConvention {
  const c = p.settings?.openingLine;
  return {
    apex: oneOf(c?.apex, ['latch', 'hinge'] as const, 'latch'),
    dashed: oneOf(c?.dashed, ['toward', 'away'] as const, 'toward'),
  };
}
