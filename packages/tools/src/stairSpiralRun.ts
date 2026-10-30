import { generateSpiralRun, riserCountFor, SPIRAL_MAX_SWEEP, SPIRAL_MIN_INNER, type SpiralParams, type SpiralRunSketch } from '@hestia/engine';
import { defaultUnits, formatQuantity, unitsOf, type Id, type Project, type ResolvedUnits, type Stair, type StairLanding, type StairRun, type StairSpiralParams } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';
import { stairLimits } from './stairCommands.ts';

/**
 * Caracol como lance editável (decisão 0014): plano da criação (3 cliques), regeneração pelas alças e pelas propriedades,
 * e os números da linha informativa (espelhos por volta e folga entre voltas). Tudo puro: o comando grava depois.
 */

export type StairComponent = StairRun | StairLanding;

const DEG = Math.PI / 180;
/** Varredura mínima do caracol (30°), na criação e nas alças. */
export const SPIRAL_MIN_SWEEP = 30 * DEG;
/** Raio interno padrão da ferramenta (m). */
export const SPIRAL_DEFAULT_INNER = 0.1;

export interface SpiralPlanInput extends SpiralParams {
  /** H = cota do topo − cota da base (m). */
  H: number;
  /** Espelho máximo do tipo (m). */
  maxRiser: number;
  /** Unidades do projeto para as mensagens (ausente usa o padrão, para testes e chamadas antigas). */
  units?: ResolvedUnits;
}

export interface SpiralPlan {
  run: SpiralRunSketch;
  /** Nº de espelhos N = ceil(H ÷ espelho máximo). */
  risers: number;
  /** Altura real do espelho h = H ÷ N. */
  riserHeight: number;
}

/**
 * Plano do caracol para os parâmetros dados: valida os limites da ferramenta (raios, varredura entre 30° e 720°) e gera o
 * croqui com N pela altura. Devolve a mensagem de status em pt-BR quando não dá.
 */
export function planSpiralRun(i: SpiralPlanInput): SpiralPlan | { error: string } {
  const u = i.units ?? defaultUnits();
  if (!(i.rInner >= SPIRAL_MIN_INNER)) return { error: `O raio interno deve ser de ao menos ${formatQuantity(u, 'length', SPIRAL_MIN_INNER)}.` };
  if (!(i.rOuter > i.rInner)) return { error: 'O raio externo deve ser maior que o interno.' };
  const sw = Math.abs(i.sweep);
  if (!(sw >= SPIRAL_MIN_SWEEP - 1e-9)) return { error: `A varredura mínima do caracol é de ${formatQuantity(u, 'angle', SPIRAL_MIN_SWEEP, { trim: true })}.` };
  if (!(sw <= SPIRAL_MAX_SWEEP + 1e-9)) return { error: `A varredura máxima do caracol é de ${formatQuantity(u, 'angle', SPIRAL_MAX_SWEEP, { trim: true })} (duas voltas).` };
  let N: number;
  try {
    N = riserCountFor(i.H, i.maxRiser);
  } catch {
    return { error: 'Altura ou espelho máximo inválido.' };
  }
  if (N < 2) return { error: 'A altura é menor que um espelho: nada a gerar.' };
  try {
    const run = generateSpiralRun({ center: i.center, rInner: i.rInner, rOuter: i.rOuter, startAngle: i.startAngle, sweep: i.sweep, risers: N });
    return { run, risers: N, riserHeight: i.H / N };
  } catch (e) {
    return { error: e instanceof RangeError ? e.message : 'Não foi possível gerar o caracol.' };
  }
}

/** Parâmetros do caracol do lance `part` da escada, ou null se o lance não é caracol. */
export function spiralAt(s: Stair, part: number): StairSpiralParams | null {
  const c = s.components[part];
  return c?.kind === 'run' && c.spiral ? c.spiral : null;
}

/** Primeiro lance caracol da escada: índice e parâmetros. Null se a escada não tem caracol. */
export function spiralOfStair(s: Stair): { part: number; sp: StairSpiralParams } | null {
  for (let part = 0; part < s.components.length; part++) {
    const sp = spiralAt(s, part);
    if (sp) return { part, sp };
  }
  return null;
}

/**
 * Componentes da escada com o caracol do lance `part` regenerado com `next` (N recalculado pela altura, como na criação).
 * O id do lance é mantido; a origem é 'spiral'. Erro em mensagem pt-BR (raio, varredura, altura, tipo).
 */
export function regenSpiralComponents(p: Project, s: Stair, part: number, next: SpiralParams): { components: StairComponent[] } | { error: string } {
  const old = s.components[part];
  if (old?.kind !== 'run') return { error: 'O lance caracol não foi encontrado.' };
  const limits = stairLimits(p, s);
  if (!limits) return { error: 'O tipo da escada não existe no projeto.' };
  if (!(limits.H > 0)) return { error: 'A escada não tem altura positiva.' };
  const plan = planSpiralRun({ ...next, H: limits.H, maxRiser: limits.maxRiser, units: unitsOf(p) });
  if ('error' in plan) return plan;
  const run: StairRun = {
    ...old,
    boundaryLeft: plan.run.boundaryLeft,
    boundaryRight: plan.run.boundaryRight,
    risers: plan.run.risers,
    path: plan.run.path,
    generatedBy: 'spiral',
    spiral: plan.run.spiral,
  };
  return { components: s.components.map((c, i): StairComponent => (i === part ? run : c)) };
}

/** Números da linha informativa do caracol (decisão 0014 §1 item 7); mesma fórmula de `spiralNormIssues`. */
export interface SpiralInfo {
  risers: number;
  riserHeight: number;
  /** Espelhos por volta: 2π ÷ Δ. */
  perTurn: number;
  /** Folga entre voltas (m): (n−1)·h − Tv, no espelho de trás do degrau de cima. */
  headroom: number;
  minHeadroom: number;
}

/** Números do caracol da escada com os parâmetros dados; null sem altura ou sem tipo. */
export function spiralInfo(p: Project, s: Stair, sp: SpiralParams): SpiralInfo | null {
  const limits = stairLimits(p, s);
  const type = p.stairTypes[s.typeId];
  if (!limits || !type || !(limits.H > 0)) return null;
  let N: number;
  try {
    N = riserCountFor(limits.H, limits.maxRiser);
  } catch {
    return null;
  }
  if (N < 2) return null;
  const h = limits.H / N;
  const step = Math.abs(sp.sweep) / (N - 1);
  const perTurn = (2 * Math.PI) / step;
  const rm = (sp.rInner + sp.rOuter) / 2;
  const chord = 2 * rm * Math.sin(step / 2);
  const tv = type.runStyle === 'monolithic' ? (chord > 1e-9 ? (type.structuralDepth * Math.hypot(chord, h)) / chord : type.structuralDepth) : type.treadThickness;
  return { risers: N, riserHeight: h, perTurn, headroom: (perTurn - 1) * h - tv, minHeadroom: type.minHeadroom };
}

/**
 * Edição do croqui à mão descarta `spiral` quando mudam os LIMITES ou os ESPELHOS de um lance caracol (o `generatedBy`
 * fica, como a origem do leque). Mover, girar e espelhar não passam por aqui (mantêm `spiral` em `stairTransform`), e a
 * alteração da caminhada não descarta. Compara por id do lance.
 */
export function discardSpiralOnEdit(before: StairComponent[], after: StairComponent[]): StairComponent[] {
  const prev = new Map<Id, StairRun>();
  for (const c of before) if (c.kind === 'run') prev.set(c.id, c);
  const sameGeometry = (a: StairRun, b: StairRun): boolean =>
    JSON.stringify([a.boundaryLeft, a.boundaryRight, a.risers]) === JSON.stringify([b.boundaryLeft, b.boundaryRight, b.risers]);
  return after.map((c): StairComponent => {
    if (c.kind !== 'run' || !c.spiral) return c;
    const old = prev.get(c.id);
    if (!old || sameGeometry(old, c)) return c;
    const out: StairRun = { ...c };
    delete out.spiral;
    return out;
  });
}

/** Ângulo de um vetor (rad) normalizado para (−π, π]. */
export const wrapAngle = (a: number): number => {
  let x = a % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x <= -Math.PI) x += 2 * Math.PI;
  return x;
};

/** Ponto no raio r, no ângulo th, em torno de c. */
export const polarPoint = (c: Vec2, r: number, th: number): Vec2 => ({ x: c.x + r * Math.cos(th), y: c.y + r * Math.sin(th) });

/** Varredura com o sinal de `sweep`, com módulo em [mín, máx]: a alça não inverte o sentido ao passar de zero. */
export function clampSweepKeepSign(sweep: number, next: number): number {
  const s = sweep < 0 ? -1 : 1;
  const m = Math.min(SPIRAL_MAX_SWEEP, Math.max(SPIRAL_MIN_SWEEP, Math.abs(next)));
  return s * m;
}
