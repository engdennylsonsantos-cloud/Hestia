import type { Vec2 } from '@hestia/geom';
import type { Id } from './types.ts';

/** Segmento do croqui: reta (sag = 0) ou arco por flecha, mesma convenção das paredes (arcFromSagitta). */
export interface StairCurve {
  a: Vec2;
  b: Vec2;
  /** Flecha do arco (m), positiva à esquerda de a→b. 0 = reta. */
  sag: number;
}

/** Origem do lance gerado (preenchida pelo gerador; sem vínculo paramétrico depois da edição manual). */
export type StairGenerator = 'straight' | 'lshape' | 'ushape' | 'winder';

/**
 * Lance (Revit: Stair Run por croqui). É o croqui único do lance: limites esquerdo e direito, linhas de espelho e
 * linha de caminhada opcional. Os geradores só produzem este croqui; a geometria dos degraus sai dele no motor.
 */
export interface StairRun {
  id: Id;
  kind: 'run';
  /** Cadeia contínua, lado esquerdo no sentido de subida. */
  boundaryLeft: StairCurve[];
  /** Cadeia contínua, lado direito no sentido de subida. */
  boundaryRight: StairCurve[];
  /** Linhas de espelho. A ordem no vetor não importa (o motor ordena pela caminhada ou pela direção). */
  risers: StairCurve[];
  /** Caminhada (cadeia) do primeiro ao último espelho; vazia = automática. */
  path: StairCurve[];
  generatedBy?: StairGenerator;
}

/** Patamar (Revit: Landing por croqui): laço fechado de retas e arcos, plano, sem vínculo paramétrico com o lance. */
export interface StairLanding {
  id: Id;
  kind: 'landing';
  boundary: StairCurve[];
}

/**
 * Escada (Revit: Stair por componente). `components` guarda a sequência em ordem (lance, patamar, lance...); a cota de
 * cada patamar sai da base e do número de espelhos dos lances anteriores. Base = nível + baseOffset; topo = nível de
 * topo + topOffset (o nível de topo padrão é o imediatamente acima); sem nível acima, o topo é base + height.
 */
export interface Stair {
  id: Id;
  kind: 'stair';
  levelId: Id;
  typeId: Id;
  /** Nível de topo explícito; null = o nível imediatamente acima (levelAbove). */
  topLevelId: Id | null;
  baseOffset: number;
  topOffset: number;
  /** Altura usada só quando não há nível acima e o topo não é explícito. */
  height: number;
  components: Array<StairRun | StairLanding>;
  /** "Abrir laje": a laje do nível de topo recebe furo automático (padrão ligada). */
  openSlab: boolean;
  mark: string;
  comments: string;
  /** Ordem de criação. */
  order: number;
}

export type StairRunStyle = 'monolithic' | 'assembled';

/** Face inferior do lance monolítico (Revit: Underside Surface): lisa (rampa contínua) ou escalonada (dente de serra). */
export type StairUndersideStyle = 'smooth' | 'stepped';

/**
 * Tipo de escada (Revit: Stair Type). Regras de espelho/piso valem para o lance calculado; no croqui livre elas não
 * bloqueiam. Campos de estilo que não se aplicam ao estilo escolhido ficam em 0 (ex.: `treadThickness` no monolítico).
 */
export interface StairType {
  id: Id;
  name: string;
  code: string;
  description: string;
  /** Espelho máximo (m). */
  maxRiser: number;
  /** Piso mínimo (m). */
  minTread: number;
  /** Largura mínima do lance (m). */
  minRunWidth: number;
  runStyle: StairRunStyle;
  /**
   * Face inferior do lance monolítico (só vale para `runStyle: 'monolithic'`): lisa ou escalonada. Não se aplica ao
   * estilo montado, mas o campo existe sempre (o montado guarda 'smooth', sem uso).
   */
  undersideStyle: StairUndersideStyle;
  /** Espessura estrutural do lance monolítico, PERPENDICULAR à rampa (m), medida a partir dos cantos internos dos degraus. */
  structuralDepth: number;
  /** Espessura do piso do lance montado (m). */
  treadThickness: number;
  /** Espessura do espelho do lance montado (m). */
  riserThickness: number;
  /** Nariz (m): só 3D e quantitativo. */
  nosing: number;
  /** Espessura do patamar (m). */
  landingThickness: number;
  /** Pé-direito livre mínimo sob o lance (m). */
  minHeadroom: number;
  materialId: Id;
  /** Custo informativo (R$). 0 quando não informado. */
  cost: number;
}
