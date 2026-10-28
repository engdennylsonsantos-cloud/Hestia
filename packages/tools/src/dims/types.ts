import type { Vec2 } from '@hestia/geom';
import type { Command, Element, Id, OpeningDimRef, Project, ResolvedDimensionSettings, WallDimRef } from '@hestia/model';

/** Tipo de elemento ao qual um provedor de cotas se liga (o campo `kind` do elemento). */
export type ElementKind = Element['kind'];

/** Uma referência de cota de qualquer vocabulário (parede ou esquadria). */
export type DimRef = WallDimRef | OpeningDimRef;

/** Uma ponta da cota: o ponto medido, qual vocabulário vale e a referência em uso. */
export interface DimEnd {
  /** Ponto medido (mundo). */
  at: Vec2;
  /** Identifica a ponta dentro do provedor ('wallLeft', 'openLeft'...); compõe a chave de `overrides`. */
  slot: string;
  kind: 'wall' | 'opening';
  current: DimRef;
  /** As referências que esta ponta aceita, na ordem em que a alça as percorre. */
  options: ReadonlyArray<DimRef>;
}

/** Resultado puro de uma edição: comandos para executar (num único passo) ou a mensagem que explica a recusa. */
export type DimEditResult = { commands: Command[]; note?: string } | { error: string };

export interface TempDim {
  /** Estável entre quadros: `${provider}:${subjectId}:${slot}`. */
  key: string;
  a: Vec2;
  b: Vec2;
  /** Afastamento da linha de cota (m): positivo = lado esquerdo de a→b, negativo = direito. */
  offset: number;
  /** Medida em metros. */
  value: number;
  /** Pontas na ordem de `a` e `b`. */
  ends: [DimEnd, DimEnd];
  tone?: 'valid' | 'invalid';
  /** Ausente = só leitura. Pura: devolve comandos, nunca os executa. */
  edit?: (valueSI: number) => DimEditResult;
}

export interface DimContext {
  project: Project;
  levelId: Id;
  settings: ResolvedDimensionSettings;
  /** `${providerId}:${slot}` (ou chave global do provedor) → referência escolhida na sessão. */
  overrides: Readonly<Record<string, DimRef>>;
}

/**
 * Provedor de cotas de um tipo de sujeito. Para entrar no sistema basta o tipo do sujeito, `compute` (com `edit`
 * opcional em cada cota) e uma linha de registro; `selectionSubject` só é preciso para cotar o elemento selecionado.
 */
export interface DimProvider<S> {
  id: string;
  compute(ctx: DimContext, subject: S): TempDim[];
  /** Sujeito do elemento selecionado; null se o elemento não pode ser cotado. */
  selectionSubject?(project: Project, elementId: Id): S | null;
}
