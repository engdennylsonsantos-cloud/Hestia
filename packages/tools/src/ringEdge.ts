import type { Vec2 } from '@hestia/geom';
import type { Id } from '@hestia/model';

/**
 * Anel editável de um elemento com croqui: o contorno externo (`hole === null`) ou um furo (índice em `holes`).
 * Cobre piso, laje, telhado e forro. Ambiente e escada entram depois (ver docs/decisoes).
 */
export interface RingRef {
  elementId: Id;
  hole: number | null;
}

/** Aresta `index` do anel: vai de `ring[index]` até `ring[(index + 1) % ring.length]`. */
export interface EdgeRef extends RingRef {
  index: number;
}

/** Aresta sob o cursor, com o ponto do cursor projetado sobre ela. */
export interface EdgePick {
  ref: EdgeRef;
  a: Vec2;
  b: Vec2;
  /** Ponto da aresta mais próximo do cursor (m). */
  at: Vec2;
}

/**
 * Operações puras sobre um anel (sem estado, sem Project). Todas devolvem um anel NOVO; o anel de entrada não muda.
 * Índices fora do intervalo devolvem o anel igual ao de entrada.
 */
export interface RingOps {
  /** Move os dois vértices da aresta `i` pelo vetor `d` (Mover/Copiar de aresta). */
  moveEdge(ring: Vec2[], i: number, d: Vec2): Vec2[];
  /** Insere um vértice em `at` sobre a aresta `i` (Dividir). */
  insertVertex(ring: Vec2[], i: number, at: Vec2): Vec2[];
  /** Move o vértice `end` da aresta `i` para `to` (Aparar/Estender; `to` já calculado pelo chamador). */
  moveEdgeEnd(ring: Vec2[], i: number, end: 'a' | 'b', to: Vec2): Vec2[];
  /** Interseção da reta da aresta `i` com a reta `p → q`, ou null se paralelas. Usada para Aparar, Junção e Deslocar. */
  intersectEdgeLine(ring: Vec2[], i: number, p: Vec2, q: Vec2): Vec2 | null;
  /** Desloca a aresta `i` em `dist` (m) pela normal `perp` do sentido da aresta (+90°): positivo = à esquerda de `a → b`. Em anel anti-horário, positivo aponta para dentro. A UI escolhe o sinal pelo lado do cursor. */
  offsetEdge(ring: Vec2[], i: number, dist: number): Vec2[];
  /** Encosta a aresta `i` na reta `p → q` (Alinhar): projeta os dois vértices sobre a reta. */
  alignEdgeToLine(ring: Vec2[], i: number, p: Vec2, q: Vec2): Vec2[];
}

/** Divide um anel simples por uma reta `a → b`. Devolve dois anéis, ou null se a reta não cruza o anel em dois pontos. */
export type SplitRing = (ring: Vec2[], a: Vec2, b: Vec2) => [Vec2[], Vec2[]] | null;
