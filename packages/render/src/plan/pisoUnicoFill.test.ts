import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Layer, type Project } from '@hestia/model';
import { fillRegionOf } from '@hestia/engine';
import { floorFills } from './floors.ts';
import { LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';

/**
 * Preenchimento da planta do piso único (decisão 0025): a camada de topo com regra explícita pinta o piso até a face da
 * parede; sem regra, pinta o contorno inteiro, como antes. A parede é desenhada por cima (não é testada aqui).
 */

const VIEW: Viewport = { cx: 5, cy: 4, zoom: 100, width: 800, height: 600 };
const RECT = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];

/** Piso 10 × 8 m com uma parede interna de 0,184 m atravessando o contorno; as camadas do tipo são as dadas. */
function pisoComParede(layers?: Layer[]): Project {
  const base = createEmptyProject();
  if (layers) base.floorTypes.ft_unico = { ...base.floorTypes.ft_unico!, layers };
  const s = new ProjectStore(base);
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'pu', typeId: 'ft_unico', levelId: 'lv_0', boundary: RECT }) });
  s.exec({
    type: 'addWall',
    wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 5, y: -1 }, b: { x: 5, y: 9 }, height: 2.8, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } }),
  });
  return s.project;
}

/** Área (m²) do preenchimento principal do piso na planta (a primeira operação; a faixa de contorno vem depois). */
const preenchido = (p: Project): number => {
  const [principal] = floorFills(p, 'lv_0', LIGHT, false, 'medium', VIEW).fills;
  return multiArea(principal!.polygons);
};

describe('preenchimento da planta do piso único (decisão 0025, P10)', () => {
  it('a camada de topo até a face pinta o piso parando na parede: bruta menos a pegada (0,184 m × 8 m)', () => {
    const p = pisoComParede();
    expect(preenchido(p)).toBeCloseTo(80 - 0.184 * 8, 6);
  });

  it('sem regra explícita, o preenchimento é o contorno inteiro, como antes', () => {
    const autos = createEmptyProject().floorTypes.ft_unico!.layers.map((l) => {
      const { termino: _t, ...resto } = l;
      return resto as Layer;
    });
    const p = pisoComParede(autos);
    expect(preenchido(p)).toBeCloseTo(80, 6);
  });

  it('fillRegionOf: a camada de topo, com ou sem regra explícita (o elemento só quando há corte; 0023 F7)', () => {
    const contorno = [[[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]]] as never;
    const camada = [[[{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }]]] as never;
    // sem corte: a planta mostra a camada de cima (o término dela vale mesmo sem junção)
    expect(fillRegionOf({ explicit: false, polygon: camada }, contorno)).toBe(camada);
    expect(fillRegionOf({ explicit: true, polygon: camada }, contorno)).toBe(camada);
  });
});
