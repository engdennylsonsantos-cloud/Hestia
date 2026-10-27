import { describe, expect, it } from 'vitest';
import { POLE_ELEVATION } from '@hestia/render';
import { COMPASS, RING, floorToPx, ringGeometry, ringHit } from './viewcube-ring.ts';

const DEG = Math.PI / 180;
/** Vistas de referência: a padrão do app, de cima, de lado (chão quase de perfil) e de baixo. */
const VIEWS: [number, number][] = [
  [-45 * DEG, 0.5],
  [30 * DEG, 0.9],
  [120 * DEG, 0.15],
  [-135 * DEG, 1.4],
  [0, -0.04],
];

/** Diferença angular em (−π, π]. */
function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

describe('letras da bússola', () => {
  it('N aponta para +Y e L para +X, com o azimute de cada letra', () => {
    expect(COMPASS.map((c) => c.key)).toEqual(['N', 'L', 'S', 'O']);
    expect(COMPASS.find((c) => c.key === 'N')!.angle).toBeCloseTo(Math.PI / 2, 9);
    expect(COMPASS.find((c) => c.key === 'L')!.angle).toBeCloseTo(0, 9);
  });

  it('o ponto da tela de cada letra é reconhecido como aquela letra, em qualquer vista', () => {
    for (const [az, el] of VIEWS) {
      if (Math.abs(el) < 0.1) continue; // de perfil o anel é uma linha; o caso tem teste próprio
      for (const c of COMPASS) {
        const [px, py] = floorToPx(az, el, RING.letter * Math.cos(c.angle), RING.letter * Math.sin(c.angle));
        const hit = ringHit(az, el, px, py);
        expect(hit?.letter?.key, `${c.key} em az=${az} el=${el}`).toBe(c.key);
      }
    }
  });

  it('clicar na letra devolve o azimute dela (o que a câmera vai usar)', () => {
    for (const [az, el] of VIEWS) {
      if (Math.abs(el) < 0.1) continue;
      for (const c of COMPASS) {
        const [px, py] = floorToPx(az, el, RING.letter * Math.cos(c.angle), RING.letter * Math.sin(c.angle));
        expect(Math.abs(angleDiff(ringHit(az, el, px, py)!.angle, c.angle))).toBeLessThan(1e-6);
      }
    }
  });
});

describe('faixa do anel (ringHit)', () => {
  it('um ponto da faixa sem letra é acerto sem letra, com o ângulo certo', () => {
    const theta = Math.PI / 4; // entre L e N: nenhuma letra por perto
    for (const [az, el] of VIEWS) {
      if (Math.abs(el) < 0.1) continue;
      const [px, py] = floorToPx(az, el, RING.inner * 1.1 * Math.cos(theta), RING.inner * 1.1 * Math.sin(theta));
      const hit = ringHit(az, el, px, py);
      expect(hit).not.toBeNull();
      expect(hit!.letter).toBeNull();
      expect(Math.abs(angleDiff(hit!.angle, theta))).toBeLessThan(1e-6);
    }
  });

  it('fora da faixa, perto demais do centro ou longe demais, não há acerto', () => {
    const [az, el] = VIEWS[0]!;
    const inside = floorToPx(az, el, 1.0 * Math.cos(0.3), 1.0 * Math.sin(0.3)); // dentro do cubo
    const outside = floorToPx(az, el, 2.3 * Math.cos(0.3), 2.3 * Math.sin(0.3)); // longe do anel
    expect(ringHit(az, el, inside[0], inside[1])).toBeNull();
    expect(ringHit(az, el, outside[0], outside[1])).toBeNull();
  });

  it('chão de perfil (elevação 0) não tem área clicável', () => {
    expect(ringHit(0.3, 0, 40, 30)).toBeNull();
  });
});

describe('geometria do anel (ringGeometry)', () => {
  it('na vista padrão, o sul fica do lado da câmera e o norte, atrás do cubo', () => {
    const g = ringGeometry(-45 * DEG, 0.5);
    const side = (k: string) => g.letters.find((l) => l.key === k)!.front;
    expect(side('S')).toBe(true);
    expect(side('N')).toBe(false);
    expect(side('L')).toBe(true);
    expect(side('O')).toBe(false);
  });

  it('de cima, o anel inteiro fica sob o cubo (fora da silhueta, então não há sobreposição)', () => {
    const g = ringGeometry(0.4, POLE_ELEVATION);
    expect(g.letters.every((l) => !l.front)).toBe(true);
    expect(g.front.length).toBeLessThan(g.back.length);
  });

  it('gera caminhos SVG e uma transformação de matriz por letra', () => {
    const g = ringGeometry(-45 * DEG, 0.5);
    expect(g.back.startsWith('M')).toBe(true);
    expect(g.front.startsWith('M')).toBe(true);
    expect(g.shadow.startsWith('M')).toBe(true);
    for (const l of g.letters) expect(l.transform).toMatch(/^matrix\(/);
  });
});
