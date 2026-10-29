import type { Id, RampInputMode, RampShape } from '@hestia/model';

/** Opções da ferramenta Rampa. Campos ausentes usam o padrão do tipo (largura, inclinação, patamar). */
export interface RampToolOptions {
  typeId?: Id;
  shape: RampShape;
  width?: number;
  turn: 'left' | 'right';
  landingDepth?: number;
  mode: RampInputMode;
  /** Fração, modo 'slope'; ausente = type.defaultSlope. */
  slope?: number;
  topLevelId?: Id | null;
  baseOffset?: number;
  topOffset?: number;
  height?: number;
}

export const DEFAULT_RAMP_OPTIONS: RampToolOptions = { shape: 'straight', turn: 'left', mode: 'length' };
