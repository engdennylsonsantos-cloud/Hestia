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
} from '@hestia/engine';
import type { Id, StairGenerator } from '@hestia/model';
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

/**
 * Espelhos e piso de um lance reto de comprimento `length` (m, do 1º ao último espelho). Entre os N que a altura permite
 * (N ≥ ceil(H ÷ espelho máximo)), fica o de piso mais perto do piso ideal do tipo (`treadFor`, 0,63 − 2·h); o piso não
 * pode ficar abaixo do mínimo. Erro se nem o menor N dá piso mínimo: o lance é curto demais.
 */
export function risersForLength(H: number, maxRiser: number, minTread: number, length: number): { risers: number; tread: number } | { error: string } {
  const N0 = riserCountFor(H, maxRiser);
  let best: { risers: number; tread: number; score: number } | null = null;
  for (let N = Math.max(2, N0); N <= N0 + 400; N++) {
    const tread = length / (N - 1);
    // Mais espelhos, piso menor: a partir daqui todo N seguinte também fica abaixo do mínimo.
    if (tread < minTread - 1e-9) break;
    const score = Math.abs(tread - treadFor(H / N, minTread));
    if (!best || score < best.score) best = { risers: N, tread, score };
  }
  if (!best) return { error: `O comprimento (${(length * 100).toFixed(0)} cm) é curto para ${Math.max(2, N0)} espelhos: o piso ficaria abaixo do mínimo (${(minTread * 100).toFixed(0)} cm).` };
  return { risers: best.risers, tread: best.tread };
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
  options: StairRunToolOptions;
}

/** Plano calculado: componentes em ordem (como croqui), nº de espelhos N, altura real h e piso. */
export interface StairRunPlan {
  parts: StairPart[];
  risers: number;
  riserHeight: number;
  tread: number;
}

export type StairRunPlanResult = StairRunPlan | { error: string };

/**
 * Calcula a escada pronta: N = ceil(H ÷ espelho máximo), h = H ÷ N, piso = treadFor(h, piso mínimo) e os componentes do
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
  // Reta com comprimento (2º clique): o comprimento escolhe N e o piso (a altura do espelho é H ÷ N).
  if (shape === 'straight' && i.options.length !== undefined) {
    const sized = risersForLength(i.H, i.maxRiser, i.minTread, i.options.length);
    if ('error' in sized) return sized;
    N = sized.risers;
  }
  const riserHeight = i.H / N;
  const tread = shape === 'straight' && i.options.length !== undefined ? (i.options.length / (N - 1)) : treadFor(riserHeight, i.minTread);
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
  return { parts, risers: N, riserHeight, tread };
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
