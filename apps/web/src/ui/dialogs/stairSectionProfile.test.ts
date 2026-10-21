import { describe, expect, it } from 'vitest';
import { DEFAULT_STAIR_TYPES, type StairType } from '@hestia/model';
import { stairSectionProfile } from './stairSectionProfile.ts';

const mono = (over: Partial<StairType> = {}): StairType => ({ ...DEFAULT_STAIR_TYPES[0]!, ...over });
/** Distância perpendicular de um ponto à reta que passa por a e b. */
const perp = (p: [number, number], a: [number, number], b: [number, number]): number =>
  Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);

describe('perfil de corte da prévia', () => {
  it('face lisa: fundo em linha reta, a espessura perpendicular à rampa é a estrutural', () => {
    const t = mono({ minTread: 0.28, maxRiser: 0.175, structuralDepth: 0.15, undersideStyle: 'smooth' });
    const pts = stairSectionProfile(t);
    const bottom = pts.slice(-2) as Array<[number, number]>;
    // Os dois últimos pontos são o fundo: (n·p, n·h − T) e (0, −T); a reta do fundo é paralela à rampa dos narizes.
    const nose: [number, number] = [0, 0];
    const noseEnd: [number, number] = [3 * 0.28, 3 * 0.175];
    expect(perp(bottom[0]!, nose, noseEnd)).toBeCloseTo(0.15, 9);
    expect(perp(bottom[1]!, nose, noseEnd)).toBeCloseTo(0.15, 9);
    expect(bottom[0]![0] - bottom[1]![0]).toBeCloseTo(3 * 0.28, 9);
    expect(bottom[0]![1] - bottom[1]![1]).toBeCloseTo(3 * 0.175, 9);
  });

  it('face escalonada: fundo com um trecho horizontal por degrau, em dente de serra', () => {
    const t = mono({ minTread: 0.28, maxRiser: 0.175, structuralDepth: 0.15, undersideStyle: 'stepped' });
    const pts = stairSectionProfile(t);
    const top = 1 + 3 * 2;
    const bottom = pts.slice(top);
    expect(bottom).toHaveLength(6);
    // Cada par do fundo é horizontal e está a (h + T) abaixo do topo do degrau correspondente.
    const T = 0.15 / (0.28 / Math.hypot(0.28, 0.175));
    for (let i = 0; i < 3; i++) {
      const [a, b] = [bottom[2 * (2 - i)]!, bottom[2 * (2 - i) + 1]!];
      expect(a[1]).toBeCloseTo(i * 0.175 - T, 9);
      expect(b[1]).toBeCloseTo(i * 0.175 - T, 9);
      expect(a[0] - b[0]).toBeCloseTo(0.28, 9);
    }
  });

  it('lisa e escalonada começam e terminam no mesmo degrau, e a escalonada tem fundo mais alto nos pontos internos', () => {
    const base = mono({ structuralDepth: 0.15 });
    const smooth = stairSectionProfile({ ...base, undersideStyle: 'smooth' });
    const stepped = stairSectionProfile({ ...base, undersideStyle: 'stepped' });
    expect(smooth.slice(0, 7)).toEqual(stepped.slice(0, 7));
    expect(stepped.at(-1)).toEqual([0, -(0.15 / (0.28 / Math.hypot(0.28, 0.18)))]);
  });

  it('piso e espelho não muda: fecha no piso base, sem face inferior', () => {
    const pts = stairSectionProfile(DEFAULT_STAIR_TYPES[1]!);
    expect(pts.at(-1)).toEqual([3 * 0.28, 0]);
    expect(pts).toHaveLength(8);
  });
});
