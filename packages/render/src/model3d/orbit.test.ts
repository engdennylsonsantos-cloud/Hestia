import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OrbitCamera } from './orbit.ts';

const DEG = Math.PI / 180;

/** Projeta um ponto do mundo para pixels de tela (CSS, origem no canto superior esquerdo). */
function toScreen(cam: OrbitCamera, w: number, h: number, p: THREE.Vector3): { x: number; y: number } {
  const v = p.clone().project(cam.camera);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
}

function setup(az: number, el: number, dist: number, w = 800, h = 600): OrbitCamera {
  const o = new OrbitCamera();
  o.setAspect(w, h);
  o.target.set(3, -2, 1);
  o.azimuth = az;
  o.elevation = el;
  o.distance = dist;
  o.apply();
  return o;
}

const AZIMUTHS = [0, 45, 90, 135, 180, 225, 270, 315];
// -30° não é alcançável pela órbita (clamp em -0.05 rad), mas o pan não depende do clamp.
const ELEVATIONS = [-30, -2, 0, 10, 30, 60, 85];
const DISTANCES = [2, 40];
const DRAGS: [number, number][] = [
  [60, 0],
  [0, 60],
  [-80, 35],
  [40, -50],
];

describe('OrbitCamera.pan: a cena acompanha o cursor em qualquer ângulo', () => {
  for (const az of AZIMUTHS) {
    for (const el of ELEVATIONS) {
      for (const dist of DISTANCES) {
        it(`azimute ${az}°, elevação ${el}°, distância ${dist} m`, () => {
          for (const [dx, dy] of DRAGS) {
            const o = setup(az * DEG, el * DEG, dist);
            const anchor = o.target.clone();
            const c0 = toScreen(o, 800, 600, anchor);
            expect(c0.x).toBeCloseTo(400, 0);
            expect(c0.y).toBeCloseTo(300, 0);

            o.pan(dx, dy);

            const c1 = toScreen(o, 800, 600, anchor);
            expect(Math.abs(c1.x - (400 + dx))).toBeLessThanOrEqual(1);
            expect(Math.abs(c1.y - (300 + dy))).toBeLessThanOrEqual(1);
          }
        });
      }
    }
  }
});

describe('OrbitCamera.pan: escala depende da altura da tela', () => {
  it('o mesmo arrasto em px move o ponto âncora pela mesma quantidade em tela, qualquer resolução', () => {
    for (const [w, h] of [
      [800, 600],
      [1280, 900],
      [400, 1000],
    ] as const) {
      for (const az of AZIMUTHS) {
        const o = setup(az * DEG, 30 * DEG, 14, w, h);
        const anchor = o.target.clone();
        o.pan(50, -20);
        const c = toScreen(o, w, h, anchor);
        expect(Math.abs(c.x - (w / 2 + 50))).toBeLessThanOrEqual(1);
        expect(Math.abs(c.y - (h / 2 - 20))).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('OrbitCamera.pan: arrastos sucessivos e órbita não quebram o acompanhamento', () => {
  it('após órbita e vários pans, o ponto âncora continua acompanhando o cursor', () => {
    const o = setup(-Math.PI / 4, 0.5, 14);
    o.orbit(120, -40);
    o.pan(30, 10);
    o.orbit(-200, 90);
    const anchor = o.target.clone();
    o.pan(-45, 25);
    const c = toScreen(o, 800, 600, anchor);
    expect(Math.abs(c.x - (400 - 45))).toBeLessThanOrEqual(1);
    expect(Math.abs(c.y - (300 + 25))).toBeLessThanOrEqual(1);
  });
});
