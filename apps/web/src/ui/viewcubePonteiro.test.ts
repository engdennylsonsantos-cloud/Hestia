import { describe, expect, it } from 'vitest';
import { zoneAtPoint } from './viewcube.ts';

/** Metade do palco (132 px de lado, `.vc-stage`); além disso o ponteiro nem chega ao ViewCube. */
const STAGE_HALF_PX = 66;

/** Vistas de referência: padrão do app, de lado, alta e baixa. */
const VIEWS: [number, number][] = [
  [-Math.PI / 4, 0.5],
  [0.3, 0.9],
  [2.1, 0.15],
  [0, -0.04],
];

describe('vão transparente do ViewCube', () => {
  it('dentro do palco mas fora da silhueta do cubo não há zona (o clique segue para o canvas)', () => {
    // A silhueta do cubo cabe em um raio de 32·√3 ≈ 55,4 px; 60 px fica no vão, ainda dentro do palco.
    for (const [az, el] of VIEWS) {
      for (const [x, y] of [[60, 0], [0, -60], [-60, 0], [0, 60]] as const) {
        expect(zoneAtPoint(az, el, x, y), `az ${az} el ${el} em (${x}, ${y})`).toBeNull();
      }
    }
  });

  it('fora do palco não há zona', () => {
    const fora = STAGE_HALF_PX + 4;
    for (const [az, el] of VIEWS) {
      expect(zoneAtPoint(az, el, fora, fora)).toBeNull();
      expect(zoneAtPoint(az, el, -fora, fora)).toBeNull();
    }
  });
});
