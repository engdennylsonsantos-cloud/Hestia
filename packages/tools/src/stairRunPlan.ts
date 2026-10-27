import { dist, len, sub, type Vec2 } from '@hestia/geom';
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
import { stairBaseZ, stairTopZ, type Id, type Project, type Stair, type StairGenerator, type StairLanding, type StairRun } from '@hestia/model';
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
  /**
   * Reta: comprimento do lance, do 1º ao último espelho (m), dado pelo 2º clique. Ausente = o piso vem da altura (`treadFor`).
   */
  length?: number;
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
/**
 * Nº de espelhos do lance reto com comprimento `length` (início ao fim, nos centros dos espelhos). Para cada N a partir do
 * mínimo da altura, o piso é L ÷ (N−1); escolhe o N cujo piso fica mais perto do piso calculado para h = H ÷ N (`treadFor`).
 * Sem espelho a mais de 200 acima do mínimo (a busca é curta: o piso decresce com N).
 */
export function straightRiserCount(H: number, maxRiser: number, minTread: number, length: number): number {
  const min = riserCountFor(H, maxRiser);
  // Altura de menos de dois espelhos: devolve o mínimo, para `planStairRun` recusar o lance como antes.
  if (min < 2) return min;
  let best = min;
  let bestErr = Infinity;
  for (let N = min; N <= min + 200; N++) {
    const err = Math.abs(length / (N - 1) - treadFor(H / N, minTread));
    if (err < bestErr - 1e-12) {
      best = N;
      bestErr = err;
    }
  }
  return best;
}

export function planStairRun(i: StairRunPlanInput): StairRunPlanResult {
  const { shape, width, turn } = i.options;
  if (shape === 'spiral') return { error: 'O caracol é planejado por planSpiralRun (3 cliques).' };
  const landingDepth = i.options.landingDepth ?? width;
  if (!(width > 0)) return { error: 'A largura do lance deve ser positiva.' };
  if (shape === 'lshape' && !(landingDepth >= width)) return { error: 'O patamar da escada em L deve ter profundidade ≥ largura do lance.' };
  if (shape === 'ushape' && !(landingDepth > 0)) return { error: 'O patamar da escada em U deve ter profundidade positiva.' };
  const byLength = shape === 'straight' && i.length !== undefined;
  let N: number;
  try {
    N = byLength ? straightRiserCount(i.H, i.maxRiser, i.minTread, i.length!) : riserCountFor(i.H, i.maxRiser);
  } catch (e) {
    return { error: e instanceof RangeError ? e.message : 'Altura ou espelho máximo inválido.' };
  }
  if (N < 2) return { error: 'A altura é menor que um espelho: nada a gerar.' };
  if (N < MIN_RISERS[shape]) return { error: `Esta forma precisa de ao menos ${MIN_RISERS[shape]} espelhos; a altura dá ${N}.` };
  const riserHeight = i.H / N;
  // Lance reto com comprimento: o piso é o do clique (L ÷ (N−1)); não pode ficar abaixo do mínimo do tipo.
  const tread = byLength ? i.length! / (N - 1) : treadFor(riserHeight, i.minTread);
  if (byLength && tread < i.minTread - 1e-9) {
    return { error: `Lance curto demais: o piso (${cmText(tread)} cm) ficaria abaixo do mínimo do tipo (${cmText(i.minTread)} cm).` };
  }
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

const cmText = (m: number): string => (m * 100).toFixed(1).replace('.', ',');

/**
 * Regenera o lance reto de uma escada com `n` espelhos (campo "Nº de espelhos" das Propriedades). Mantém o 1º espelho, a
 * direção, a largura e o piso do lance; a altura do espelho é H ÷ n e o lance se alonga ou encurta. Erro se a escada não é
 * um lance reto gerado (um só lance, origem `straight`).
 */
export function regenStraightComponents(p: Project, stair: Stair, n: number): { components: Array<StairRun | StairLanding> } | { error: string } {
  const c = stair.components[0];
  if (stair.components.length !== 1 || c?.kind !== 'run' || c.generatedBy !== 'straight' || c.risers.length < 2) {
    return { error: 'O número de espelhos só muda em escada reta gerada.' };
  }
  if (!(Number.isInteger(n) && n >= 2)) return { error: 'O nº de espelhos deve ser um inteiro de 2 para cima.' };
  const mid = (k: { a: Vec2; b: Vec2 }): Vec2 => ({ x: (k.a.x + k.b.x) / 2, y: (k.a.y + k.b.y) / 2 });
  const first = mid(c.risers[0]!);
  const d = sub(mid(c.risers[1]!), first);
  const tread = len(d);
  if (!(tread > 1e-9)) return { error: 'Espelhos sem distância entre si: não há como regenerar.' };
  const width = dist(c.risers[0]!.a, c.risers[0]!.b);
  const H = stairTopZ(p, stair) - stairBaseZ(p, stair);
  if (!(H > 0)) return { error: 'Altura inválida: a escada não tem altura positiva.' };
  const g = generateStraightRun({ start: first, dir: { x: d.x / tread, y: d.y / tread }, width, tread, risers: n });
  const run: StairRun = { id: c.id, kind: 'run', boundaryLeft: g.boundaryLeft, boundaryRight: g.boundaryRight, risers: g.risers, path: g.path, generatedBy: 'straight' };
  return { components: [run] };
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
