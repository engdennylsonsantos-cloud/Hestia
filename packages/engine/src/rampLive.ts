import { rampMaxSlope, type RampType } from '@hestia/model';
import { maxRiseFor } from './rampPlan.ts';

/**
 * Cálculo numérico do modo "livre" da rampa (prévia em tempo real e otimizador). Tudo puro e O(nº de lances):
 * nada de `resolveRamps`, validação de projeto nem operações booleanas.
 */

/** Tolerância de desnível ao decidir "nível alcançado" (m). */
export const LIVE_RISE_TOL = 0.005;

const EPS = 1e-9;

/** Um pedaço do layout: lance (sobe) ou patamar (plano). `at` = distância do início do trecho. */
export interface LayoutPiece {
  kind: 'flight' | 'landing';
  at: number;
  length: number;
  /** Desnível vencido (0 no patamar). */
  rise: number;
}

export interface SegmentLayout {
  pieces: LayoutPiece[];
  /** Desnível acumulado no lance corrente ao fim do trecho (zera no patamar). */
  carry: number;
  /** Desnível total vencido no trecho. */
  rise: number;
  /** Distância horizontal coberta pelos pedaços. */
  length: number;
}

function core(limit: number, riseLimit: number, c: number, s: number, maxRise: number, P: number): SegmentLayout {
  const pieces: LayoutPiece[] = [];
  let rem = limit;
  let need = riseLimit;
  let cur = c;
  let pos = 0;
  let rise = 0;
  const cap = maxRise > 0 ? maxRise : Infinity;
  if (!(s > 0)) {
    if (limit > EPS && Number.isFinite(limit)) pieces.push({ kind: 'flight', at: 0, length: limit, rise: 0 });
    return { pieces, carry: cur, rise: 0, length: Number.isFinite(limit) ? limit : 0 };
  }
  for (let guard = 0; guard < 2000 && rem > EPS && need > EPS; guard++) {
    const room = cap - cur;
    if (room <= EPS) {
      // Esgotou o desnível máximo do lance: patamar (consome distância, não sobe).
      const l = Math.min(P > 0 ? P : 0, rem);
      if (l > EPS) {
        pieces.push({ kind: 'landing', at: pos, length: l, rise: 0 });
        pos += l;
        rem -= l;
      }
      cur = 0;
      continue;
    }
    const fl = Math.min(rem, room / s, need / s);
    if (!(fl > EPS)) break;
    const r = fl * s;
    pieces.push({ kind: 'flight', at: pos, length: fl, rise: r });
    pos += fl;
    rem -= fl;
    cur += r;
    rise += r;
    need -= r;
  }
  return { pieces, carry: cur, rise, length: pos };
}

/**
 * Layout de `d` metros de trecho à inclinação `s` (fração): lance até `maxRise` de desnível acumulado (`c` = já
 * acumulado no lance corrente), depois patamar de `P` m, e repete. Não emite patamar sem distância sobrando.
 */
export function layoutSegment(d: number, c: number, s: number, maxRise: number, P: number): SegmentLayout {
  return core(Math.max(0, d), Infinity, c, s, maxRise, P);
}

/** Como `layoutSegment`, mas pára exatamente quando vencer `riseNeeded` de desnível (sem patamar no fim). */
export function layoutUntilRise(riseNeeded: number, c: number, s: number, maxRise: number, P: number): SegmentLayout {
  return core(Infinity, Math.max(0, riseNeeded), c, s, maxRise, P);
}

// ---------------------------------------------------------------------------------------------------------------
// Falta/sobra em tempo real
// ---------------------------------------------------------------------------------------------------------------

export interface LiveInput {
  /** Desnível total da rampa (m). */
  H: number;
  mode: 'slope' | 'length';
  type: RampType;
  /** Modo 'slope': inclinação de trabalho; modo 'length': meta (ausente = máximo da norma do tipo). Ausente = padrão do tipo. */
  slope?: number;
  /** Distância horizontal do percurso até o cursor (lances + patamares). */
  pathLength: number;
  /** Desnível já vencido por trechos anteriores (m). */
  riseDone?: number;
  /** Desnível acumulado no lance corrente ao início do trecho vivo (m). */
  carry?: number;
  /** Modo 'length': soma dos patamares já contidos em `pathLength` (m). Padrão 0. */
  landingsLength?: number;
}

export type LiveRemaining =
  | {
      mode: 'slope';
      status: 'falta' | 'alcancado' | 'passou';
      slope: number;
      /** Desnível vencido até o cursor (limitado ao topo) ou, em `passou`, até o ponto de fechamento. */
      rise: number;
      /** `falta`: desnível que falta (m); senão 0. */
      falta: number;
      /** `falta`: rampa que falta, falta/s (m); senão 0. */
      faltaLength: number;
      /** `passou`: desnível a mais que o cursor subiria (m); senão 0. */
      excess: number;
      /** `passou`: percurso que sobra além do fechamento (m); senão 0. */
      excessLength: number;
      /** Distância (do início do trecho vivo) em que o desnível fecha; null se ainda não fecha. */
      closeAt: number | null;
    }
  | {
      mode: 'length';
      /** Inclinação resultante H / comprimento de lances. */
      slope: number;
      /** Meta de inclinação. */
      target: number;
      withinNorm: boolean;
      /** Comprimento de rampa que falta para atingir a meta (m); 0 se já está dentro. */
      faltaLength: number;
    };

/** Falta/sobra de desnível (modo 'slope') ou de comprimento (modo 'length') para o cursor atual. */
export function liveRemaining(i: LiveInput): LiveRemaining {
  const { H, type } = i;
  const P = type.landingMinLength;
  if (i.mode === 'length') {
    const lf = Math.max(1e-9, i.pathLength - (i.landingsLength ?? 0));
    const slope = H / lf;
    const target = i.slope ?? rampMaxSlope(type) ?? type.defaultSlope;
    const withinNorm = slope <= target + 1e-6;
    return { mode: 'length', slope, target, withinNorm, faltaLength: withinNorm ? 0 : Math.max(0, H / target - lf) };
  }
  const s = i.slope ?? type.defaultSlope;
  const total = H - (i.riseDone ?? 0);
  const maxRise = maxRiseFor(type, s) ?? 0;
  const lay = layoutSegment(i.pathLength, i.carry ?? 0, s, maxRise, P);
  const falta = total - lay.rise;
  if (Math.abs(falta) <= LIVE_RISE_TOL) {
    return { mode: 'slope', status: 'alcancado', slope: s, rise: lay.rise, falta: 0, faltaLength: 0, excess: 0, excessLength: 0, closeAt: closeAt(total, i.carry ?? 0, s, maxRise, P) };
  }
  if (falta > 0) {
    return { mode: 'slope', status: 'falta', slope: s, rise: lay.rise, falta, faltaLength: falta / s, excess: 0, excessLength: 0, closeAt: null };
  }
  const at = closeAt(total, i.carry ?? 0, s, maxRise, P);
  const excessLength = Math.max(0, i.pathLength - at);
  return { mode: 'slope', status: 'passou', slope: s, rise: total, falta: 0, faltaLength: 0, excess: excessLength * s, excessLength, closeAt: at };
}

/** Distância (do início do trecho) em que o desnível `total` fecha. */
function closeAt(total: number, c: number, s: number, maxRise: number, P: number): number {
  return layoutUntilRise(total, c, s, maxRise, P).length;
}
