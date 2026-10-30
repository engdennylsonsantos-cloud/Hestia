import { STAIR_RUN_SHAPES, STAIR_RUN_SHAPE_LABEL, type StairRunShape } from '@hestia/tools';

/** Uma opção do seletor "Forma" da ferramenta Escada. */
export interface StairShapeOption {
  value: StairRunShape;
  label: string;
}

/**
 * Formas oferecidas pelo seletor da ferramenta Escada, na ordem da ferramenta. Todas as formas aparecem, inclusive a
 * escada livre (`free`), que antes ficava só no motor: sem ela no seletor o usuário não tinha como escolher a livre.
 * O rótulo da livre vem do i18n (`stair_shape_free`); os demais vêm do catálogo das ferramentas.
 */
export function stairShapeOptions(freeLabel: string): StairShapeOption[] {
  return STAIR_RUN_SHAPES.map((shape) => ({
    value: shape,
    label: shape === 'free' ? freeLabel : STAIR_RUN_SHAPE_LABEL[shape],
  }));
}

/** Campos que a forma pede: a livre mostra largura e patamar, sem giro nem caracol (como a rampa livre). */
export interface StairRunFields {
  width: boolean;
  landing: boolean;
  turn: boolean;
  spiral: boolean;
}

export function stairRunFields(shape: StairRunShape): StairRunFields {
  const spiral = shape === 'spiral';
  return {
    width: !spiral,
    landing: shape === 'lshape' || shape === 'ushape' || shape === 'free',
    turn: shape === 'lshape' || shape === 'ushape' || shape === 'winder',
    spiral,
  };
}
