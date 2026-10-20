import type { Vec2 } from '@hestia/geom';
import type { WallFrame } from './frame.ts';

/** Dados do vizinho necessários para esquadrejar uma camada contra ele (tudo em números → cache estável). */
export interface MiterSide {
  /** Ponto onde o eixo desta parede termina na junção. */
  o: Vec2;
  u: Vec2;
  n: Vec2;
  sHi: number;
  sLo: number;
  /** +1 se a face externa (afastada do vizinho) é a de s maior. */
  sigma: 1 | -1;
  /** Espessura dos acabamentos entre a face externa do canto e o núcleo (pareia núcleo com núcleo). */
  outerToCore: number;
  /** Profundidade (da face externa do canto) em que o núcleo termina; o acabamento do ambiente fica além dela. */
  coreEnd: number;
  /** Profundidades (da face externa do canto) dos limites entre camadas do tipo, de 0 até a espessura total. */
  bounds: number[];
}

/**
 * Faixa de espessura com o seu próprio corte: a faixa vai de `s` (borda de `s` menor) até `s1`, e o corte vai
 * linearmente de `t` em `s` até `t1` em `s1`. Sem `t1` (ou `s1`) o corte é reto, na posição `t` (perpendicular ao
 * eixo quando o pareamento é a 90°). Oblíquo quando o corte acompanha a face da outra parede (docs/08 §5.4 passo 3).
 */
export interface StepRun {
  s: number;
  s1?: number;
  t: number;
  t1?: number;
}

/**
 * Corte de UMA face da extremidade: reto na posição `t` do eixo, em esquadria contra o vizinho `other`, ou em
 * degraus (pareamento por face, docs/08 §5.4): cada faixa de espessura para na face da camada correspondente.
 */
export type SideSpec =
  | { kind: 'flat'; t: number }
  | { kind: 'miter'; self: MiterSide; other: MiterSide }
  | { kind: 'steps'; runs: StepRun[] };

/**
 * Como cada face de uma extremidade é cortada (docs/08 §5.4). `hi` vale para a metade de s maior, `lo` para a de s
 * menor; hoje as duas são o mesmo objeto. `clip` recorta cada camada num setor (nós de 3+ paredes).
 */
export interface EndSpec {
  hi: SideSpec;
  lo: SideSpec;
  clip?: Vec2[];
}

export interface WallEnds {
  a: EndSpec;
  b: EndSpec;
}

/** Extremidade de uma parede dentro de um nó: o ponto, a direção saindo do nó para dentro da parede. */
export interface EndRef {
  f: WallFrame;
  which: 'a' | 'b';
  o: Vec2;
  /** Direção unitária saindo do nó para dentro da parede. */
  dir: Vec2;
}
