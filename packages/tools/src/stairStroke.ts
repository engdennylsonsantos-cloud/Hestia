import { dist, sagFromThreePoints, sub, len, type Vec2 } from '@hestia/geom';
import type { StairCurve } from '@hestia/model';
import type { StairPrimitive } from './stairSketchState.ts';

/** Tolerância para "o arco começa no fim da cadeia" (m): o snap entrega o ponto exato, então é folga de cópia. */
export const CONNECT_TOL = 1e-4;

/**
 * Progresso de um traçado (uma linha ou um arco) em curso. `chain` guarda os segmentos já fechados de uma cadeia
 * (limites, caminhada, patamar); no espelho (linha solta) cada segmento sai direto e `chain` fica vazio.
 * Arco: `arcStage` 0 = espera início, 1 = espera fim (`last` é o início), 2 = espera a flecha (`arcEnd`).
 */
export interface Stroke {
  prim: StairPrimitive;
  /** Início do próximo segmento de linha, ou início do arco em curso; null = nada em curso. */
  last: Vec2 | null;
  arcStage: 0 | 1 | 2;
  arcEnd: Vec2 | null;
  chain: StairCurve[];
}

export const emptyStroke = (prim: StairPrimitive): Stroke => ({ prim, last: null, arcStage: 0, arcEnd: null, chain: [] });

/** Há algo em curso que o primeiro Esc deve cancelar? */
export const strokeBusy = (s: Stroke): boolean => s.last !== null || s.arcStage > 0 || s.chain.length > 0;

/** Fim da cadeia fechada (ou null): onde a próxima linha ou arco começa. */
export function chainEnd(s: Stroke): Vec2 | null {
  const c = s.chain[s.chain.length - 1];
  return c ? c.b : null;
}

export type StrokeEvent = { kind: 'progress' } | { kind: 'segment'; curve: StairCurve } | { kind: 'reject'; message: string };

/**
 * Um clique. `chained` diz se o segmento entra na cadeia (limites, caminhada, patamar) ou sai sozinho (espelho).
 * Linha: o primeiro clique fixa o início; cada clique seguinte fecha um segmento. Arco: início, fim, flecha.
 */
export function strokeClick(s: Stroke, p: Vec2, chained: boolean): { next: Stroke; event: StrokeEvent } {
  if (s.prim === 'line') {
    if (!s.last) return { next: { ...s, last: p }, event: { kind: 'progress' } };
    if (dist(s.last, p) < 1e-9) return { next: s, event: { kind: 'reject', message: 'Clique num ponto diferente do anterior.' } };
    const curve: StairCurve = { a: s.last, b: p, sag: 0 };
    return { next: chained ? { ...s, last: p, chain: [...s.chain, curve] } : { ...s, last: null }, event: { kind: 'segment', curve } };
  }
  if (s.arcStage === 0) {
    if (chained && s.last && dist(s.last, p) > CONNECT_TOL) {
      return { next: s, event: { kind: 'reject', message: 'O arco deve começar no fim da cadeia.' } };
    }
    return { next: { ...s, last: s.last ?? p, arcStage: 1 }, event: { kind: 'progress' } };
  }
  if (s.arcStage === 1) {
    if (dist(s.last!, p) < 1e-9) return { next: s, event: { kind: 'reject', message: 'O fim do arco deve ser outro ponto.' } };
    return { next: { ...s, arcEnd: p, arcStage: 2 }, event: { kind: 'progress' } };
  }
  const sag = sagFromThreePoints(s.last!, p, s.arcEnd!);
  if (Math.abs(sag) < 1e-6) return { next: s, event: { kind: 'reject', message: 'A flecha do arco fica sobre a corda: afaste o ponto.' } };
  const curve: StairCurve = { a: s.last!, b: s.arcEnd!, sag };
  if (chained) return { next: { ...s, last: s.arcEnd, arcEnd: null, arcStage: 0, chain: [...s.chain, curve] }, event: { kind: 'segment', curve } };
  return { next: { ...s, last: null, arcEnd: null, arcStage: 0 }, event: { kind: 'segment', curve } };
}

/** Desfaz o último passo em curso: a flecha, o fim do arco, o início, ou o último segmento da cadeia. */
export function strokeUndo(s: Stroke): Stroke {
  if (s.arcStage === 2) return { ...s, arcEnd: null, arcStage: 1 };
  if (s.arcStage === 1) return { ...s, last: chainEnd(s), arcStage: 0 };
  if (s.last && s.chain.length === 0) return { ...s, last: null };
  const popped = s.chain[s.chain.length - 1];
  if (popped) return { ...s, chain: s.chain.slice(0, -1), last: popped.a };
  return { ...s, last: null };
}

/** Prévia do que o cursor está desenhando agora (linha de borracha ou arco até o cursor). */
export function strokePreview(s: Stroke, cursor: Vec2): StairCurve[] {
  if (s.prim === 'line') return s.last && dist(s.last, cursor) > 1e-9 ? [{ a: s.last, b: cursor, sag: 0 }] : [];
  if (s.arcStage === 1 && s.last) return dist(s.last, cursor) > 1e-9 ? [{ a: s.last, b: cursor, sag: 0 }] : [];
  if (s.arcStage === 2 && s.last && s.arcEnd) {
    const sag = sagFromThreePoints(s.last, cursor, s.arcEnd);
    return [{ a: s.last, b: s.arcEnd, sag }];
  }
  return [];
}

/**
 * Ponto para a entrada numérica: a partir do início da linha, na direção do cursor, à distância `v`. Sem direção
 * (cursor sobre o início), usa o eixo +x.
 */
export function typedPoint(from: Vec2, cursor: Vec2, v: number): Vec2 {
  const d = sub(cursor, from);
  const l = len(d);
  const u = l < 1e-9 ? { x: 1, y: 0 } : { x: d.x / l, y: d.y / l };
  return { x: from.x + u.x * v, y: from.y + u.y * v };
}
