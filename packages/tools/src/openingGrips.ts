import { pointAt, type WallFrame } from '@hestia/engine';
import { openingFamilyOf, type Opening, type OpeningType } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';

/** Controle de inversão da abertura selecionada: sentido de abertura ou lado da dobradiça. */
export type OpeningFlipKind = 'hand' | 'facing';

/** Posição dos dois controles redondos, no mundo. `hand` é null quando a família não tem dobradiça. */
export interface OpeningGripPlacements {
  facing: Vec2;
  hand: Vec2 | null;
}

/** Famílias em que `flipHand` muda o desenho (o lado da dobradiça). Correr, vão livre, fixa e maxim-ar não têm. */
const HINGE_FAMILIES = new Set(['door_swing', 'door_double', 'door_pivot']);

/** A família do tipo aceita inverter a dobradiça? */
export function openingHasHinge(type: Pick<OpeningType, 'kind' | 'plan' | 'leaves'>): boolean {
  const family = openingFamilyOf(type);
  return family ? HINGE_FAMILIES.has(family.id) : false;
}

/**
 * Controles estilo Revit: ficam do lado OPOSTO ao da abertura (fora do arco), afastados da face da parede. O de sentido
 * fica no eixo da abertura; o de dobradiça, junto da ombreira correspondente (quando a família tem dobradiça).
 */
export function openingGripPlacements(frame: WallFrame, opening: Opening, type: Pick<OpeningType, 'kind' | 'plan' | 'leaves' | 'width'>, gap = 0.22): OpeningGripPlacements {
  const side = opening.flipFacing ? -1 : 1;
  const s = -side * (frame.thickness / 2 + gap);
  const clampT = (t: number): number => Math.max(0.05, Math.min(frame.length - 0.05, t));
  const handT = opening.offset + (opening.flipHand ? 1 : -1) * (type.width / 2 + 0.12);
  return {
    facing: pointAt(frame, opening.offset, s),
    hand: openingHasHinge(type) ? pointAt(frame, clampT(handT), s) : null,
  };
}

/**
 * Novo estado da abertura ao clicar num controle (função pura). O sentido alterna `flipFacing`; a dobradiça alterna
 * `flipHand`. O outro campo fica como estava (um clique = um passo de desfazer no comando).
 */
export function nextOpeningFlip(opening: Pick<Opening, 'flipHand' | 'flipFacing'>, kind: OpeningFlipKind): Pick<Opening, 'flipHand' | 'flipFacing'> {
  return kind === 'hand'
    ? { flipHand: !opening.flipHand, flipFacing: opening.flipFacing }
    : { flipHand: opening.flipHand, flipFacing: !opening.flipFacing };
}
