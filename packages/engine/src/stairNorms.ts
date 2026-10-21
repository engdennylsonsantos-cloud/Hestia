/**
 * Perfil de norma das escadas (decisão 0011 §1 item 10): faixas de espelho, piso e Blondel (interseção NBR 9050 ×
 * NBR 9077), patamar a cada desnível máximo e comprimento mínimo do patamar. Só geram avisos, nunca bloqueiam.
 * A folga de cabeça vem do tipo (`StairType.minHeadroom`); o aviso `stair-headroom` depende da geometria das lajes do
 * nível de topo e fica em `stairChecks.ts`.
 */
export interface StairNorms {
  /** Espelho mínimo e máximo (m). */
  riserMin: number;
  riserMax: number;
  /** Piso médio mínimo e máximo (m). */
  treadMin: number;
  treadMax: number;
  /** Relação 2h + p mínima e máxima (m). */
  blondelMin: number;
  blondelMax: number;
  /** Desnível máximo de um lance sem patamar (m). */
  maxRiseBetweenLandings: number;
  /** Menor dimensão do patamar (m). */
  landingMinLength: number;
}

export const DEFAULT_STAIR_NORMS: StairNorms = {
  riserMin: 0.16,
  riserMax: 0.18,
  treadMin: 0.28,
  treadMax: 0.32,
  blondelMin: 0.63,
  blondelMax: 0.64,
  maxRiseBetweenLandings: 3.2,
  landingMinLength: 1.2,
};
