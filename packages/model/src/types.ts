import type { Vec2 } from '@hestia/geom';

export type Id = string;
export const SCHEMA_VERSION = 7;

/** Funções de camada, no modelo do Revit (docs/05 §1). */
export type LayerFunction = 'structure' | 'substrate' | 'thermal' | 'membrane' | 'finish1' | 'finish2';

export type HatchKind = 'solid' | 'diagonal' | 'cross' | 'dots' | 'none';

export interface Material {
  id: Id;
  name: string;
  /** Cor de aparência (3D e preenchimento de planta), #rrggbb. */
  color: string;
  /** Hachura de corte em planta. */
  hatch: HatchKind;
  /** Rugosidade/brilho simples para o 3D (0 fosco … 1 espelhado). */
  gloss: number;
  /** Opacidade 0..1 (vidro). */
  opacity: number;
  cost: number;
  /** Unidade do custo/quantitativo. */
  unit: 'm2' | 'm3' | 'm';
}

export interface Layer {
  function: LayerFunction;
  materialId: Id;
  /** Espessura em metros. Membrana pode ter 0. */
  thickness: number;
  /** Retorno no vão e nas extremidades (docs/05 §2). */
  wraps: boolean;
  /** Substitui a prioridade padrão da função (avançado). */
  priority?: number;
}

/** Em que lados os acabamentos "envolvem" (retornam) nos vãos e nas extremidades da parede. */
export type WrapMode = 'none' | 'interior' | 'exterior' | 'both';

/**
 * Faixa vertical aplicada sobre uma face da parede (Revit: sweeps/reveals): rodapé, barra de azulejo, friso.
 * Fica FORA da espessura da parede, entre as alturas z0 e z1 acima da base.
 */
export interface WallStrip {
  id: Id;
  name: string;
  side: 'exterior' | 'interior';
  materialId: Id;
  thickness: number;
  z0: number;
  z1: number;
}

export interface WallType {
  id: Id;
  name: string;
  description: string;
  code: string;
  /** Camadas da face EXTERNA para a INTERNA. */
  layers: Layer[];
  /** Retorno dos acabamentos nos vãos (docs/05 §2); a família da abertura pode substituir. */
  wrapInserts: WrapMode;
  /** Retorno dos acabamentos nas extremidades livres. */
  wrapEnds: WrapMode;
  strips: WallStrip[];
  /** Custo por m² de face de parede (R$/m²). 0 quando não informado. */
  cost: number;
  /** Transmitância térmica U (W/m²K). null quando não informada. */
  thermalU: number | null;
  /** Isolamento acústico aéreo Rw (dB). null quando não informado. */
  acousticRw: number | null;
  /** Resistência ao fogo (minutos). null quando não informada. */
  fireRating: number | null;
  /** Fabricante ou sistema construtivo de referência. Texto livre. */
  manufacturer: string;
}

export type LocationLine =
  | 'wallCenter'
  | 'coreCenter'
  | 'finishExterior'
  | 'finishInterior'
  | 'coreExterior'
  | 'coreInterior';

/** Tipos de junção no canto entre duas paredes (docs/05 §9). */
export type JoinKind = 'butt' | 'miter' | 'square';

export interface JoinConfig {
  kind: JoinKind;
  /** Inverte qual parede domina (quem atravessa no encosto). Padrão: a mais antiga domina. */
  flip: boolean;
}

export interface Level {
  id: Id;
  name: string;
  elevation: number;
}

/** Ponto do perfil superior: `t` = distância ao longo de a→b; `h` = altura do topo acima da base da parede. */
export interface ProfilePoint {
  t: number;
  h: number;
}

export interface Wall {
  id: Id;
  kind: 'wall';
  typeId: Id;
  levelId: Id;
  a: Vec2;
  b: Vec2;
  baseOffset: number;
  /** Se definido, o topo é esse nível + topOffset; senão usa `height`. */
  topLevelId: Id | null;
  height: number;
  topOffset: number;
  /**
   * Base anexada ao piso do mesmo nível que cobre o ponto médio da parede: a base sobe até a face superior do piso.
   * Ausente = false (arquivos antigos). A cota é calculada no engine (wallZRange), não aqui.
   */
  attachBottomToFloor?: boolean;
  /** Topo anexado ao piso do nível `topLevelId` que cobre o ponto médio: o topo desce até a face inferior do piso. */
  attachTopToFloor?: boolean;
  locationLine: LocationLine;
  /** Inverte qual lado é o externo (padrão: externo à esquerda de a→b). */
  flipped: boolean;
  noJoinStart: boolean;
  noJoinEnd: boolean;
  /** Configuração da junção na extremidade `a` / `b` (vale quando há outra parede no mesmo ponto). */
  joinStart: JoinConfig;
  joinEnd: JoinConfig;
  /**
   * Flecha do arco em metros: distância do meio do arco à corda, positiva à esquerda de a→b.
   * 0 = parede reta. Limitada a metade da corda (arco de até 180°).
   */
  sag: number;
  /**
   * Perfil superior editado (Revit: Editar perfil, só o contorno de cima): topo poligonal por altura em função de `t`
   * (empena, topo inclinado, degraus — dois pontos com o mesmo `t` fazem um degrau). Fora do intervalo dos pontos o
   * topo se mantém na altura do ponto mais próximo. `null` = topo reto por `height`/nível. Só em parede reta.
   */
  topProfile: ProfilePoint[] | null;
  mark: string;
  comments: string;
  /** Ordem de criação: desempata junções (docs/05 §1, ordem de junção). */
  order: number;
}

/**
 * Família do símbolo de planta. Portas: arco com folha (swing), dupla, correr, pivotante.
 * Janelas: fixa, basculante, maxim-ar (arco tracejado) e correr.
 */
export type PlanSymbol = 'swing' | 'double' | 'sliding' | 'pivot' | 'fixed' | 'tilt' | 'casement';

export interface OpeningType {
  id: Id;
  kind: 'door' | 'window';
  name: string;
  width: number;
  height: number;
  /** Peitoril padrão (0 para porta). */
  sill: number;
  /** Folhas. 0 = vão livre: só o recorte e a soleira, sem folha nem caixilho. */
  leaves: 0 | 1 | 2;
  /** Símbolo de planta da família. */
  plan: PlanSymbol;
  frameMaterialId: Id;
  glassMaterialId: Id;
  /** Fechamento do vão (Revit: Wall Closure): substitui o retorno do tipo de parede quando não é 'inherit'. */
  closure: 'inherit' | WrapMode;
}

export interface Opening {
  id: Id;
  kind: 'door' | 'window';
  typeId: Id;
  hostId: Id;
  /** Distância do centro da abertura ao início (a) da parede, ao longo do eixo. */
  offset: number;
  /** Inverte o lado da dobradiça. */
  flipHand: boolean;
  /** Inverte o sentido de abertura (para qual lado a folha gira). */
  flipFacing: boolean;
  sillOverride: number | null;
  mark: string;
}

/** Tipo de piso: camadas do topo para baixo (acabamento, contrapiso, estrutura). `wraps` não é usado. */
export interface FloorType {
  id: Id;
  name: string;
  code: string;
  description: string;
  layers: Layer[];
  /** Custo por m² (R$), informativo. */
  cost: number;
}

/**
 * Piso (Revit: Floor). Contorno fechado em planta (sentido qualquer) com furos. O topo do piso fica na cota do
 * nível mais `heightOffset`; as camadas descem a partir dele (a primeira camada é a de cima).
 */
export interface Floor {
  id: Id;
  kind: 'floor';
  typeId: Id;
  levelId: Id;
  boundary: Vec2[];
  holes: Vec2[][];
  heightOffset: number;
  mark: string;
  comments: string;
  order: number;
}

export type Element = Wall | Opening | Floor;

export interface ProjectDefaults {
  wallTypeId: Id;
  doorTypeId: Id;
  windowTypeId: Id;
  wallHeight: number;
}

/** Nível de detalhe da planta: grosseiro (um contorno por cluster), médio (atual) e fino (linhas e hachura sempre). */
export type DetailLevel = 'coarse' | 'medium' | 'fine';

export interface ProjectSettings {
  /** Distância (m) em que extremidades de paredes e pontos sobre outra parede contam como unidos. */
  joinTolerance: number;
  /** Mostra o código do tipo de cada parede na planta. */
  showTags: boolean;
  /** Sobreposição de depuração: tipo e ordem de cada junção na planta. */
  debugJoins: boolean;
  detail: DetailLevel;
}

/** Vista de corte ou elevação: linha em planta + profundidade visível; o observador olha para a esquerda de a→b. */
export interface SectionView {
  id: Id;
  name: string;
  kind: 'section' | 'elevation';
  a: Vec2;
  b: Vec2;
  depth: number;
}

export interface Project {
  schemaVersion: number;
  name: string;
  levels: Level[];
  materials: Record<Id, Material>;
  wallTypes: Record<Id, WallType>;
  floorTypes: Record<Id, FloorType>;
  openingTypes: Record<Id, OpeningType>;
  elements: Record<Id, Element>;
  nextOrder: number;
  defaults: ProjectDefaults;
  settings: ProjectSettings;
  /** Cortes e elevações do projeto (aparecem na árvore de vistas). */
  views: SectionView[];
}

export const isFloor = (e: Element | undefined): e is Floor => e?.kind === 'floor';
export const isWall = (e: Element | undefined): e is Wall => e?.kind === 'wall';
export const isOpening = (e: Element | undefined): e is Opening => e?.kind === 'door' || e?.kind === 'window';
