import type { Vec2 } from '@hestia/geom';
import type { Command, Id, LocationLine, Project, RoofShape } from '@hestia/model';
import type { StairToolOptions, StairTone } from './stairSketchState.ts';
import type { StairRunToolOptions } from './stairRunPlan.ts';

export type SnapKind = 'endpoint' | 'face' | 'core' | 'midpoint' | 'intersection' | 'perpendicular' | 'nearest' | 'alignment' | 'ortho' | 'grid' | 'none';

export interface Guide {
  from: Vec2;
  to: Vec2;
  kind: 'alignment' | 'ortho' | 'perpendicular';
}

export interface Inference {
  point: Vec2;
  kind: SnapKind;
  guides: Guide[];
  /** Parede sobre a qual o cursor está (para portas e janelas). */
  hostId?: Id;
}

/** O que a ferramenta mostra antes do clique (docs/03 §5: pré-visualização sempre). */
export type PreviewItem =
  | { kind: 'line'; a: Vec2; b: Vec2; dashed?: boolean; tone?: StairTone }
  | { kind: 'polygon'; ring: Vec2[]; dashed?: boolean; tone?: StairTone }
  | { kind: 'wallBand'; a: Vec2; b: Vec2; thickness: number; sMid: number; sag?: number }
  | { kind: 'label'; at: Vec2; text: string }
  | { kind: 'point'; at: Vec2 }
  | { kind: 'highlight'; ids: Id[] }
  /** Linha de corte ou elevação com a seta do lado de visão (a pré-visualização usa `dashed`). */
  | { kind: 'sectionLine'; a: Vec2; b: Vec2; dashed?: boolean; label?: string; elevation?: boolean };

export interface ToolEnv {
  project(): Project;
  levelId(): Id;
  selection(): Id[];
  setSelection(ids: Id[]): void;
  exec(cmd: Command): void;
  /** `session`: chave da sessão da ferramenta; transações da mesma sessão viram um só passo de desfazer. */
  transaction(label: string, fn: () => void, session?: object): void;
  /** Metros por pixel na vista atual; usado para tolerâncias de clique. */
  metersPerPixel(): number;
  gridStep(): number;
  /** Mensagem da barra de status. */
  say(msg: string): void;
  /** Pede à interface para voltar à ferramenta de seleção. */
  done(): void;
  /** Opções vindas da barra de opções. */
  options(): ToolOptions;
  /** Aresta de telhado escolhida na planta (painel "Aresta N"), ou null. Ausente = a interface não guarda a escolha. */
  roofEdge?(): RoofEdgeSel | null;
  setRoofEdge?(sel: RoofEdgeSel | null): void;
}

/** Aresta do contorno de um telhado selecionado: `index` é a aresta de boundary[index] a boundary[index+1]. */
export interface RoofEdgeSel {
  roofId: Id;
  index: number;
}

/** Modo da ferramenta Piso: contorno por cliques, retângulo, área fechada por paredes, furo num piso selecionado, ou perímetro externo da edificação. */
export type FloorMode = 'poly' | 'rect' | 'walls' | 'hole' | 'perimetro';

/** Modo da ferramenta Laje: contorno por cliques, retângulo, perímetro externo das paredes, ou furo numa laje selecionada. */
export type SlabMode = 'poly' | 'rect' | 'perimetro' | 'hole';

/** Tipo da ferramenta Matriz: linear (repete pelo espaçamento) ou radial (gira em torno de um centro). */
export type ArrayKind = 'linear' | 'radial';

/** "Mover para" da Matriz: Segundo (o valor vai do 1º ao 2º item) ou Último (vai do 1º ao último, dividido entre os itens). */
export type ArrayAnchor = 'second' | 'last';

/** Modo da ferramenta Forro (decisão 0021): contorno por cliques, retângulo, ou "Forro no ambiente" (clique num ambiente). */
export type CeilingMode = 'poly' | 'rect' | 'room' | 'hole';

/** Modo da ferramenta Telhado: contorno do beiral por cliques, retângulo, pelo perímetro externo das paredes (com balanço), ou abertura (furo) no telhado selecionado. 'extrusao' troca para a ferramenta própria de telhado por extrusão. */
export type RoofMode = 'poly' | 'rect' | 'paredes' | 'hole' | 'extrusao';

/** Quais capturas estão ligadas (AutoCAD / Revit Snaps). */
export interface SnapOptions {
  /** Chave mestre: se falso, desativa todas as capturas temporariamente (AutoCAD F3 / Revit SO). */
  enabled?: boolean;
  grid: boolean;
  /** Eixo das paredes e arestas estruturais. */
  axis: boolean;
  /** Cantos, arestas e pontos médios das faces de acabamento (por dentro e por fora dos cômodos). */
  faces: boolean;
  /** Cantos e arestas das faces do núcleo. */
  core: boolean;
  intersections: boolean;
  perpendicular: boolean;
  /** Alinhamento dinâmico e ortogonal com outros pontos e eixos (AutoCAD F11 / Revit). */
  alignment: boolean;
  /** Captura de extremidades/vértices (AutoCAD Endpoint - quadrado). */
  endpoint?: boolean;
  /** Captura de pontos médios (AutoCAD Midpoint - triângulo). */
  midpoint?: boolean;
}

export const DEFAULT_SNAP: SnapOptions = {
  enabled: true,
  grid: true,
  axis: true,
  faces: true,
  core: false,
  intersections: true,
  perpendicular: true,
  alignment: true,
  endpoint: true,
  midpoint: true,
};

export interface ToolOptions {
  /** Capturas ligadas; ausente = padrão. */
  snap?: SnapOptions;
  wallTypeId: Id;
  locationLine: LocationLine;
  wallHeight: number;
  chain: boolean;
  /** Forma da parede ao desenhar: reta, arco por três pontos ou retângulo por dois cantos opostos. */
  wallShape: 'line' | 'arc' | 'rect';
  doorTypeId: Id;
  windowTypeId: Id;
  orthoLock: boolean;
  arrayCount: number;
  /** Matriz: linear (repete pelo espaçamento) ou radial (gira em torno de um centro). Ausente = linear. */
  arrayKind?: ArrayKind;
  /** Matriz radial: ângulo total em graus (positivo = anti-horário). Ausente = 360. */
  arrayAngle?: number;
  /** Matriz: "Mover para". Segundo = o espaçamento/ângulo é o do 1º ao 2º item; Último = o do 1º ao último. Ausente = Segundo. */
  arrayAnchor?: ArrayAnchor;
  offsetDistance: number;
  rotateCopy: boolean;
  mirrorCopy: boolean;
  offsetCopy: boolean;
  floorTypeId: Id;
  /** Deslocamento do topo do piso em relação ao nível (m). */
  floorOffset: number;
  floorMode: FloorMode;
  /** Modo paredes: o piso avança por baixo do reboco até a face do núcleo. Ausente = falso. */
  floorCore?: boolean;
  /** Parede paralela: distância medida entre faces (padrão) ou entre eixos. */
  offsetFrom?: 'axis' | 'face';
  /** Tipo, deslocamento do topo (m), modo e inclinação (%) da ferramenta Laje e de "Definir inclinação". */
  slabTypeId: Id;
  slabOffset: number;
  slabMode: SlabMode;
  slabSlopePercent: number;
  /** Forro: tipo, cota do topo (m, relativa ao nível) e modo. Ausentes = padrão (primeiro tipo, 2,60 m, contorno). */
  ceilingTypeId?: Id;
  ceilingOffset?: number;
  ceilingMode?: CeilingMode;
  /** Telhado: tipo, modo, forma, inclinação (%), balanço do beiral (m) e cota do beiral (m, relativa ao nível). Ausentes = padrão. */
  roofTypeId?: Id;
  roofMode?: RoofMode;
  roofShape?: RoofShape;
  roofSlope?: number;
  roofOverhang?: number;
  /** Deslocamento do beiral (m). `null` = automático: altura da parede mais alta do nível, ou 2,8 m sem paredes. */
  roofOffset?: number | null;
  /** Escada por croqui: tipo, sub-modo, primitiva, N para distribuir e cotas da criação. Ausente = padrão. */
  stair?: StairToolOptions;
  /** Escada reta, em L, em U ou com leque, criada pronta por cliques (ferramenta `stairrun`). Ausente = reta, 1,20 m, giro à esquerda. */
  stairRun?: StairRunToolOptions;
}

export interface PointerInfo {
  /** Posição crua do cursor em metros. */
  raw: Vec2;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  /**
   * Vista 3D: elemento sob o cursor, o mesmo que a 3D destaca (`pickElement`); null no vazio. Ausente na planta, onde a
   * ferramenta acha o elemento pelo ponto (`raw`).
   */
  hit3d?: Id | null;
}

/** Contrato único de ferramenta (docs/01 §7). A ferramenta nunca altera o modelo: ela emite comandos. */
export interface Tool {
  readonly id: string;
  readonly label: string;
  /** Texto de ajuda para a barra de status. */
  readonly hint: string;
  /** Aceita clique na vista 3D: o ponto entregue é o (x, y) da superfície sob o cursor (`pickModelPoint`). */
  readonly pick3d?: boolean;
  /** Campo de valor aceita texto livre (letras e espaços), não só números. */
  readonly freeText?: boolean;
  start(): void;
  /** Atualiza a pré-visualização. */
  move(p: PointerInfo): void;
  click(p: PointerInfo): void;
  /** Valor digitado (medida em metros, ângulo em graus ou contagem), confirmado com Enter. */
  type(text: string): boolean;
  /** Tab alterna uma opção da ferramenta. */
  tab(): void;
  /** Espaço alterna uma opção secundária quando a ferramenta declara suporte. */
  space?(): void;
  /** Esc: cancela o passo; segundo Esc sai da ferramenta. */
  cancel(): void;
  confirm(): void;
  /** Arrastar com o botão pressionado (só ferramentas que usam arrasto). */
  down?(p: PointerInfo): void;
  drag?(p: PointerInfo): void;
  up?(p: PointerInfo): void;
  preview(): PreviewItem[];
  /** Inferência corrente, para o desenho de guias e marcadores. */
  inference(): Inference | null;
  /** Delete com um vértice de piso em foco: remove o vértice e devolve true; false deixa o Delete excluir a seleção. */
  deleteKey?(): boolean;
  /** Rótulo do campo numérico pendente (ex.: "Comprimento"), ou null se a ferramenta não espera valor. */
  inputPrompt(): string | null;
}
