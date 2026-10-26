import type { SketchIssue, Vec2 } from '@hestia/geom';
import type { Command, Id } from '@hestia/model';

/** Opções da barra do modo de perímetro, lidas de um elemento (mesmos campos da barra da interface). */
export interface PerimeterBarOptions {
  /** Balanço padrão do beiral (m). Só telhado. */
  overhang: number;
  /** Inclinação padrão das arestas (%). Só telhado. */
  slopePct: number;
  /** Estender até o núcleo da parede. Piso e laje. */
  extendToCore: boolean;
  /** Deslocamento do nível (m). */
  heightOffset: number;
}

/** Opções de `commitPerimeter`. Ausente = o elemento guarda o seu valor (ao editar) ou o padrão do tipo (ao criar). */
export interface CommitPerimeterOptions {
  /** Criando: tipo do elemento; ausente ou inexistente = o primeiro do projeto para o alvo. Ao editar, o tipo não muda. */
  typeId?: Id;
  /** Criando: nível onde o elemento nasce (obrigatório). Ao editar, o nível não muda. */
  levelId?: Id;
  /** Balanço padrão (m), só telhado. Substitui o padrão do rascunho. */
  overhang?: number;
  /** Inclinação padrão (%), só telhado. Substitui o padrão do rascunho. */
  slopePct?: number;
  /** Estender até o núcleo (piso e laje): marca a origem do contorno como face do núcleo. */
  extendToCore?: boolean;
  /** Deslocamento do nível (m): piso, laje, forro e cota do beiral do telhado. */
  heightOffset?: number;
  /** Só telhado: eixo da cumeeira ou da subida. Ausente = lado maior da pegada ao criar; ao editar, mantém o atual. */
  axis?: Vec2;
  mark?: string;
  comments?: string;
}

/** Resultado de `commitPerimeter`. Quando `ok` é falso, nenhum comando é gerado: o motivo vai em `message`. */
export type CommitPerimeterResult = { ok: true; id: Id; commands: Command[]; message: string } | { ok: false; message: string; issues?: SketchIssue[] };
