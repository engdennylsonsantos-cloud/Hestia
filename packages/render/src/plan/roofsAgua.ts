import type { Vec2 } from '@hestia/geom';
import { mix } from './color.ts';

/**
 * Luz fixa de noroeste na planta (y para cima = norte): a água que desce para ela fica mais clara e a que desce para o
 * sudeste, mais escura.
 */
export const LIGHT_NW: Vec2 = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };

/** Variação de luminosidade de uma água a 45° com a queda voltada para a luz (o outro extremo é o simétrico). */
export const TONE_45 = 0.14;

/**
 * Tom de uma água na planta: a cor base do material (já misturada com o papel) clareia ou escurece conforme a direção
 * da queda e a inclinação. A normal horizontal da água (a componente horizontal da normal do plano) aponta para a
 * descida e cresce com a inclinação; o fator `0,5 + 0,5 · dot(normal, luz)` dá 0,5 na água plana. O contraste é
 * calibrado para ±14 % de luminosidade numa água de 45° com a queda na direção da luz; numa água de 45° voltada para
 * norte, sul, leste ou oeste a variação fica em cerca de ±10 % (o `dot` cai por √2/2).
 */
export function tomDaAgua(color: string, up: Vec2, percent: number): string {
  const n = Math.hypot(up.x, up.y);
  if (n < 1e-12) return color;
  // tanθ = percent/100; a normal horizontal tem módulo sinθ = tanθ/√(1+tan²θ).
  const tan = Math.abs(percent) / 100;
  const sin = tan / Math.sqrt(1 + tan * tan);
  const down = { x: -up.x / n, y: -up.y / n };
  const factor = 0.5 + 0.5 * sin * (down.x * LIGHT_NW.x + down.y * LIGHT_NW.y);
  // Calibra (fator − 0,5) para ±TONE_45 quando sinθ = √2/2 (45°).
  const tone = (factor - 0.5) * (TONE_45 / (0.5 * Math.SQRT1_2));
  return tone >= 0 ? mix(color, '#ffffff', tone) : mix(color, '#000000', -tone);
}

/**
 * Cor das arestas internas (cumeeira, espigão e rincão): um pouco mais escura que o preenchimento das águas. No tema
 * escuro a mistura com preto continua legível porque a base já vem misturada com o fundo (`surfaceColor`).
 */
export const corDaAresta = (fill: string): string => mix(fill, '#000000', 0.38);
