import type { Vec2 } from '@hestia/geom';
import type { Id } from './types.ts';
import type { StairLanding, StairOpeningMode, StairRun } from './stairTypes.ts';

/** Forma: reta (n lances em linha, patamares no meio), em L (2 lances, giro de 90°), em U (2 lances, giro de 180°) ou livre (trajeto de vértices, `freePath`). */
export type RampShape = 'straight' | 'lshape' | 'ushape' | 'free';
/** Modo de entrada usado na criação: 'length' = o comprimento manda e a inclinação sai; 'slope' = a inclinação manda e o comprimento sai. */
export type RampInputMode = 'length' | 'slope';
export type RampNormProfile = 'nbr9050' | 'ada' | 'custom';

/** Uma linha da tabela de norma: até `maxSlope` (fração), cada lance vence no máximo `maxRise` (m); no máximo `maxFlights` lances (null = sem limite). */
export interface RampNormRow {
  maxSlope: number;
  maxRise: number;
  maxFlights: number | null;
}

export interface RampType {
  id: Id;
  name: string;
  code: string;
  description: string;
  materialId: Id;
  /** Espessura estrutural do lance, PERPENDICULAR à rampa (m). */
  structuralDepth: number;
  /** Espessura do patamar (m). */
  landingThickness: number;
  /** Largura sugerida pela ferramenta (m). */
  defaultWidth: number;
  /** Largura mínima do lance (m); abaixo dela, aviso. */
  minWidth: number;
  /** Inclinação sugerida no modo 'slope' (fração). */
  defaultSlope: number;
  /** Menor dimensão mínima do patamar (m); abaixo dela, aviso. Também é o comprimento do patamar gerado em linha. */
  landingMinLength: number;
  /** Pé-direito livre mínimo para o furo da laje no modo 'headroom' (m). */
  minHeadroom: number;
  normProfile: RampNormProfile;
  /** false = "a conferir": as mensagens de norma acrescentam "(norma a conferir)". */
  normChecked: boolean;
  /** Tabela de norma, em ordem CRESCENTE de maxSlope. Vazia = sem verificação de norma. */
  normTable: RampNormRow[];
  /** Custo informativo (R$). */
  cost: number;
}

export interface Ramp {
  id: Id;
  kind: 'ramp';
  levelId: Id;
  typeId: Id;
  /** Nível de topo explícito; null = o nível imediatamente acima. */
  topLevelId: Id | null;
  baseOffset: number;
  topOffset: number;
  /** Altura usada só quando não há nível acima e o topo não é explícito. */
  height: number;
  /** Lance, patamar, lance... Cada lance tem EXATAMENTE 2 linhas de espelho (borda de início e de fim). */
  components: Array<StairRun | StairLanding>;
  shape: RampShape;
  /** Forma 'free': vértices do trajeto (centro da rampa), do início ao fim. Ausente nas demais formas e em projetos antigos. */
  freePath?: Vec2[];
  /** Forma 'free': índices dos vértices do `freePath` marcados como patamar manual (mesmo se colineares). */
  manualLandings?: number[];
  /** Lado do giro (L e U), visto de quem sobe. Espelhar a rampa inverte este campo. */
  turn: 'left' | 'right';
  /** Profundidade do patamar de giro (L e U), em m. Em 'straight' é ignorado. */
  landingDepth: number;
  /** Modo de entrada da criação. */
  inputMode: RampInputMode;
  /** Inclinação alvo (fração) quando inputMode === 'slope'; null no modo 'length'. */
  slopeTarget: number | null;
  /** Abertura da laje do nível de topo: mesmos campos e regras da escada. */
  openingMode: StairOpeningMode;
  openingHeadroom: number | null;
  openingMargin: number;
  openingRect: boolean;
  mark: string;
  comments: string;
  order: number;
}
