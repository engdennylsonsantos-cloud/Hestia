import type { Vec2 } from '@hestia/geom';
import {
  generateLShape,
  generateStraightRun,
  generateUShape,
  generateWinderL,
  riserCountFor,
  treadFor,
  type StairComponentSketch,
  type StairRunSketch,
  type TreadRule,
} from '@hestia/engine';
import { DEFAULT_STAIR_CALC_RULE, type Id, type StairGenerator } from '@hestia/model';
import type { StairPart } from './stairSketchState.ts';

/**
 * Formas da ferramenta Escada por cliques (decisão 0011 §5; caracol, decisão 0014 §1 item 12). Os valores de reta, L, U e
 * leque são os nomes dos geradores do modelo; `spiral` é o caracol (gerador `generateSpiralRun`, `stairSpiralRun.ts`).
 */
export const STAIR_RUN_SHAPES = ['straight', 'lshape', 'ushape', 'winder', 'spiral'] as const;
export type StairRunShape = (typeof STAIR_RUN_SHAPES)[number];

export const STAIR_RUN_SHAPE_LABEL: Record<StairRunShape, string> = {
  straight: 'Reta',
  lshape: 'Em L',
  ushape: 'Em U',
  winder: 'Com leque',
  spiral: 'Caracol',
};

/** Opções da ferramenta Escada reta/L/U/leque/caracol (`ToolOptions.stairRun`). */
export interface StairRunToolOptions {
  /** Tipo de escada; ausente ou inexistente = o padrão do projeto. */
  typeId?: Id;
  shape: StairRunShape;
  /** Reta: comprimento do lance, do 1º ao último espelho (m), dado pelo 2º clique. Ausente = nº de espelhos pela altura. */
  length?: number;
  /** Largura de cada lance (m). */
  width: number;
  /** Lado do giro, visto de quem sobe o 1º lance (L, U e leque). */
  turn: 'left' | 'right';
  /** Profundidade do patamar (L e U), a partir do último espelho do 1º lance. Padrão = largura. */
  landingDepth?: number;
  /** Caracol: raio interno (m). Ausente = 0,10 m. */
  spiralInner?: number;
  /** Caracol: raio externo digitado (m). Ausente = o 2º clique define o raio (campo vazio; sugestão 1,00 m). */
  spiralOuter?: number;
  /** Caracol: varredura digitada (graus, em módulo; o sentido vem de `spiralSense`). Ausente = o 3º clique define. */
  spiralSweep?: number;
  /** Caracol: sentido da varredura digitada. Ausente = anti-horário. */
  spiralSense?: 'ccw' | 'cw';
}

export const DEFAULT_STAIR_RUN_OPTIONS: StairRunToolOptions = { shape: 'straight', width: 1.2, turn: 'left' };

/**
 * Espelhos mínimos por forma: L e U têm dois lances de 2; o leque precisa de 5 (ver `planStairRun`); o caracol, 2 (um
 * degrau; a forma é validada pelo gerador de caracol).
 */
export const MIN_RISERS: Record<StairRunShape, number> = { straight: 2, lshape: 4, ushape: 4, winder: 5, spiral: 2 };

/** Winder: espelhos do 1º lance reto; espelhos radiais do leque (padrão do gerador); o resto vai ao último lance. */
export const WINDER_FIRST_RISERS = 2;
export const WINDER_FAN_RISERS = 3;

/** Regra padrão quando o tipo ainda não é conhecido (mesmos números de `DEFAULT_STAIR_CALC_RULE`). */
export function defaultTreadRule(minTread: number): TreadRule {
  return {
    minTread,
    maxTread: DEFAULT_STAIR_CALC_RULE.maxTread,
    a: DEFAULT_STAIR_CALC_RULE.calcRiserFactor,
    b: DEFAULT_STAIR_CALC_RULE.calcTreadFactor,
    target: DEFAULT_STAIR_CALC_RULE.calcTarget,
  };
}

/**
 * Piso de um lance reto de comprimento `length` (m, do 1º ao último espelho). A altura manda: N = ceil(H ÷ espelho máximo)
 * e o piso ideal é `treadFor` (regra do tipo), como no Revit. O comprimento só limita: mais longo que (N − 1) × ideal, a
 * escada termina antes do clique; mais curto, o piso encolhe até o mínimo do tipo. Erro se nem o piso mínimo cabe.
 */
export function fitRunToLength(
  H: number,
  maxRiser: number,
  minTread: number,
  length: number,
  rule: TreadRule = defaultTreadRule(minTread),
): { risers: number; tread: number } | { error: string } {
  const N = Math.max(2, riserCountFor(H, maxRiser));
  const tread = Math.min(treadFor(H / N, rule), length / (N - 1));
  if (tread < rule.minTread - 1e-9) return { error: `O comprimento (${(length * 100).toFixed(0)} cm) é curto para ${N} espelhos: o piso ficaria abaixo do mínimo (${(rule.minTread * 100).toFixed(0)} cm).` };
  return { risers: N, tread };
}

export interface StairRunPlanInput {
  /** Centro do 1º espelho (1º clique). */
  start: Vec2;
  /** Direção de subida (não precisa ser unitária). */
  dir: Vec2;
  /** H = cota do topo − cota da base (m). */
  H: number;
  /** Espelho máximo do tipo (m). */
  maxRiser: number;
  /** Piso mínimo do tipo (m). */
  minTread: number;
  /** Regra de cálculo do tipo; ausente = a padrão (Blondel 0,63 − 2h, piso máximo 0,32). */
  rule?: TreadRule;
  options: StairRunToolOptions;
}

/** Plano calculado: componentes em ordem (como croqui), nº de espelhos N, altura real h e piso. */
export interface StairRunPlan {
  parts: StairPart[];
  risers: number;
  riserHeight: number;
  tread: number;
  /** Reta com clique além do fim da escada: a explicação em pt-BR (ausente se o comprimento é usado inteiro). */
  note?: string;
}

/** Aviso de uma reta cujo comprimento clicado passa do que a altura pede: a escada termina antes do clique. */
function lengthNote(length: number, N: number, tread: number): string {
  const m = (v: number): string => v.toFixed(2).replace('.', ',');
  return `(a altura pede ${N} espelhos: a escada termina a ${m((N - 1) * tread)} m, antes do clique de ${m(length)} m).`;
}

export type StairRunPlanResult = StairRunPlan | { error: string };

/**
 * Calcula a escada pronta: N = ceil(H ÷ espelho máximo), h = H ÷ N, piso = treadFor(h, regra do tipo) e os componentes do
 * gerador da forma. L e U dividem N com `risersFirst = ceil(N/2)`. O winder é fundido em um lance só (ver `mergeWinder`).
 * Sem efeito no modelo: só devolve o plano ou a mensagem de status em pt-BR.
 */
export function planStairRun(i: StairRunPlanInput): StairRunPlanResult {
  const { shape, width, turn } = i.options;
  if (shape === 'spiral') return { error: 'O caracol é planejado por planSpiralRun (3 cliques).' };
  const landingDepth = i.options.landingDepth ?? width;
  if (!(width > 0)) return { error: 'A largura do lance deve ser positiva.' };
  if (shape === 'lshape' && !(landingDepth >= width)) return { error: 'O patamar da escada em L deve ter profundidade ≥ largura do lance.' };
  if (shape === 'ushape' && !(landingDepth > 0)) return { error: 'O patamar da escada em U deve ter profundidade positiva.' };
  let N: number;
  try {
    N = riserCountFor(i.H, i.maxRiser);
  } catch (e) {
    return { error: e instanceof RangeError ? e.message : 'Altura ou espelho máximo inválido.' };
  }
  if (N < 2) return { error: 'A altura é menor que um espelho: nada a gerar.' };
  if (N < MIN_RISERS[shape]) return { error: `Esta forma precisa de ao menos ${MIN_RISERS[shape]} espelhos; a altura dá ${N}.` };
  const rule = i.rule ?? defaultTreadRule(i.minTread);
  // Reta com comprimento (2º clique): N vem só da altura; o comprimento limita o piso (a escada termina antes do clique).
  const byLength = shape === 'straight' && i.options.length !== undefined;
  let sizedTread: number | undefined;
  if (byLength) {
    const sized = fitRunToLength(i.H, i.maxRiser, i.minTread, i.options.length!, rule);
    if ('error' in sized) return sized;
    N = sized.risers;
    sizedTread = sized.tread;
  }
  const riserHeight = i.H / N;
  const tread = sizedTread ?? treadFor(riserHeight, rule);
  const note = byLength && i.options.length! > (N - 1) * tread + 0.005 ? lengthNote(i.options.length!, N, tread) : undefined;
  const base = { start: i.start, dir: i.dir, width, tread };
  let parts: StairPart[];
  try {
    if (shape === 'straight') parts = fromSketches([{ kind: 'run', run: generateStraightRun({ ...base, risers: N }) }], shape);
    else if (shape === 'winder') parts = mergeWinder(generateWinderL({ ...base, turn, risersFirst: WINDER_FIRST_RISERS, risersSecond: N - WINDER_FIRST_RISERS - WINDER_FAN_RISERS + 2, winderRisers: WINDER_FAN_RISERS }), shape);
    else {
      const first = Math.ceil(N / 2);
      const two = { ...base, turn, risersFirst: first, risersSecond: N - first };
      const cs = shape === 'lshape' ? generateLShape({ ...two, landingDepth }) : generateUShape({ ...two, landingDepth });
      parts = fromSketches(cs, shape);
    }
  } catch (e) {
    return { error: e instanceof RangeError ? e.message : 'Não foi possível gerar a escada.' };
  }
  return { parts, risers: N, riserHeight, tread, note };
}

/** Componentes do gerador para o croqui (cada lance recebe a origem `generatedBy`). */
function fromSketches(cs: StairComponentSketch[], generatedBy: StairGenerator): StairPart[] {
  return cs.map((c): StairPart => (c.kind === 'run' ? { kind: 'run', run: { ...c.run, generatedBy } } : { kind: 'landing', landing: { boundary: c.landing.boundary } }));
}

/**
 * Winder: o gerador devolve três lances, e cada junção compartilha uma linha de espelho (o último espelho de um é o
 * primeiro do seguinte). O motor soma os espelhos por componente, então manter as três peças contaria a linha duas vezes
 * e deslocaria a cota do 2º lance. Aqui os dois espelhos duplicados saem das peças seguintes e as três viram UM lance:
 * cada linha fica uma vez, os pisos de junção continuam no mesmo lance e N bate com a contagem.
 */
function mergeWinder(cs: StairComponentSketch[], generatedBy: StairGenerator): StairPart[] {
  const runs = cs.flatMap((c): StairRunSketch[] => (c.kind === 'run' ? [c.run] : []));
  const [first, fan, last] = runs;
  if (runs.length !== 3 || !first || !fan || !last) throw new RangeError('o winder deve gerar três lances');
  const run: StairRunSketch & { generatedBy: StairGenerator } = {
    boundaryLeft: [...first.boundaryLeft, ...fan.boundaryLeft, ...last.boundaryLeft],
    boundaryRight: [...first.boundaryRight, ...fan.boundaryRight, ...last.boundaryRight],
    risers: [...first.risers, ...fan.risers.slice(1), ...last.risers.slice(1)],
    path: [],
    generatedBy,
  };
  return [{ kind: 'run', run }];
}
