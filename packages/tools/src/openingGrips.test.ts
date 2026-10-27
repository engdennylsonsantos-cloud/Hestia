import { describe, expect, it } from 'vitest';
import { buildFrame } from '@hestia/engine';
import { createEmptyProject, makeWall, type Opening } from '@hestia/model';
import { nextOpeningFlip, openingGripPlacements, openingHasHinge } from './openingGrips.ts';

function cena(flipFacing = false, flipHand = false) {
  const p = createEmptyProject();
  const wall = { ...makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }), order: 1 };
  const frame = buildFrame(wall, p.wallTypes[wall.typeId]!)!;
  const type = p.openingTypes.ot_p80!;
  const opening: Opening = { id: 'd', kind: 'door', typeId: type.id, hostId: wall.id, offset: 2, flipHand, flipFacing, sillOverride: null, mark: '' };
  return { frame, type, opening };
}

describe('alças de inverter a abertura', () => {
  it('ficam do lado oposto ao da abertura e acompanham flipFacing', () => {
    const direita = cena(false);
    const g1 = openingGripPlacements(direita.frame, direita.opening, direita.type);
    expect(g1.facing.y).toBeLessThan(0);
    expect(g1.hand!.y).toBeLessThan(0);

    const esquerda = cena(true);
    const g2 = openingGripPlacements(esquerda.frame, esquerda.opening, esquerda.type);
    expect(g2.facing.y).toBeGreaterThan(0);
    expect(g2.hand!.y).toBeGreaterThan(0);
  });

  it('a alça da dobradiça fica junto da ombreira do lado de flipHand', () => {
    const esquerda = cena(false, false);
    expect(openingGripPlacements(esquerda.frame, esquerda.opening, esquerda.type).hand!.x).toBeCloseTo(2 - (0.8 / 2 + 0.12), 6);
    const direita = cena(false, true);
    expect(openingGripPlacements(direita.frame, direita.opening, direita.type).hand!.x).toBeCloseTo(2 + (0.8 / 2 + 0.12), 6);
  });

  it('o clique alterna só o campo do controle (sentido × dobradiça)', () => {
    const { opening } = cena();
    expect(nextOpeningFlip(opening, 'facing')).toEqual({ flipHand: false, flipFacing: true });
    expect(nextOpeningFlip(opening, 'hand')).toEqual({ flipHand: true, flipFacing: false });
  });

  it('dobradiça só nas famílias com o controle; correr e janela fixa não têm', () => {
    expect(openingHasHinge({ kind: 'door', plan: 'swing', leaves: 1 })).toBe(true);
    expect(openingHasHinge({ kind: 'door', plan: 'sliding', leaves: 2 })).toBe(false);
    expect(openingHasHinge({ kind: 'window', plan: 'fixed', leaves: 1 })).toBe(false);
    const correr = cena();
    correr.opening = { ...correr.opening, typeId: 'ot_j120', kind: 'window' };
    expect(openingGripPlacements(correr.frame, correr.opening, { ...correr.type, kind: 'window', plan: 'sliding', leaves: 2 }).hand).toBeNull();
  });
});
