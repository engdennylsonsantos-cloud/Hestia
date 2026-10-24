import type { Vec2 } from '@hestia/geom';
import type { SplitRing } from './ringEdge.ts';

/** Distância (m) abaixo da qual um vértice é considerado sobre a reta: o caso é recusado (devolve null). */
const EPS = 1e-9;

const copy = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });

/**
 * Divide um anel simples (sem furos) pela reta `a → b`.
 *
 * - Devolve `[anelEsquerda, anelDireita]` quando a reta cruza o contorno em exatamente dois pontos, em duas arestas
 *   distintas. `anelEsquerda` é o lado à esquerda do sentido `a → b`. Cada parte inclui os dois pontos de corte.
 * - Devolve `null` quando a reta não cruza, cruza mais de duas vezes (anel côncavo), passa por algum vértice ou
 *   sobre uma aresta (caso limite, não resolvido de forma limpa), ou quando `a === b` / o anel tem menos de 3 vértices.
 * - Não muda a entrada. Cada parte percorre o contorno no mesmo sentido do anel de entrada, então a orientação
 *   (horária ou anti-horária) é preservada.
 */
export const splitRingByLine: SplitRing = (input, a, b) => {
  // Aceita o fechamento repetido (último ponto igual ao primeiro) sem alterar a entrada.
  const first = input[0];
  const last = input[input.length - 1];
  const closed = input.length > 1 && first !== undefined && last !== undefined && first.x === last.x && first.y === last.y;
  const ring = closed ? input.slice(0, -1) : input.slice();
  const n = ring.length;
  if (n < 3) return null;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;

  // Distância com sinal da reta: positiva à esquerda do sentido a → b.
  const side = (p: Vec2): number => (dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
  const s = ring.map(side);
  if (s.some((v) => Math.abs(v) <= EPS)) return null;

  // Arestas em que o sinal muda: pontos de cruzamento (com a aresta de índice i e o ponto p).
  const cuts: Array<{ i: number; p: Vec2 }> = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (s[i]! > 0 === s[j]! > 0) continue;
    const from = ring[i]!;
    const to = ring[j]!;
    const t = s[i]! / (s[i]! - s[j]!);
    cuts.push({ i, p: { x: from.x + t * (to.x - from.x), y: from.y + t * (to.y - from.y) } });
    if (cuts.length > 2) return null;
  }
  if (cuts.length !== 2) return null;

  const [c1, c2] = cuts as [(typeof cuts)[number], (typeof cuts)[number]];
  const i1 = c1.i;
  const i2 = c2.i;

  // Vértices de `from` até `to` (inclusive), andando pelo anel no sentido da entrada.
  const chain = (from: number, to: number): Vec2[] => {
    const out: Vec2[] = [];
    for (let k = from; ; k = (k + 1) % n) {
      out.push(copy(ring[k]!));
      if (k === to) break;
    }
    return out;
  };

  // Parte X: P1, vértices i1+1 … i2, P2. Parte Y: P2, vértices i2+1 … i1, P1.
  const partX: Vec2[] = [copy(c1.p), ...chain((i1 + 1) % n, i2), copy(c2.p)];
  const partY: Vec2[] = [copy(c2.p), ...chain((i2 + 1) % n, i1), copy(c1.p)];

  // A parte X contém o vértice i1+1, que está fora da reta: o sinal dele diz de que lado está a parte X.
  return s[(i1 + 1) % n]! > 0 ? [partX, partY] : [partY, partX];
};
