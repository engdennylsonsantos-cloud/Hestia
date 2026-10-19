import type { Vec2 } from '@hestia/geom';
import type { Command, Id, LocationLine, Project } from '@hestia/model';

export type SnapKind = 'endpoint' | 'midpoint' | 'intersection' | 'perpendicular' | 'nearest' | 'alignment' | 'ortho' | 'grid' | 'none';

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
  | { kind: 'line'; a: Vec2; b: Vec2; dashed?: boolean }
  | { kind: 'polygon'; ring: Vec2[]; dashed?: boolean }
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
  transaction(label: string, fn: () => void): void;
  /** Metros por pixel na vista atual; usado para tolerâncias de clique. */
  metersPerPixel(): number;
  gridStep(): number;
  /** Mensagem da barra de status. */
  say(msg: string): void;
  /** Pede à interface para voltar à ferramenta de seleção. */
  done(): void;
  /** Opções vindas da barra de opções. */
  options(): ToolOptions;
}

export interface ToolOptions {
  wallTypeId: Id;
  locationLine: LocationLine;
  wallHeight: number;
  chain: boolean;
  /** Forma da parede ao desenhar: reta ou arco por três pontos. */
  wallShape: 'line' | 'arc';
  doorTypeId: Id;
  windowTypeId: Id;
  orthoLock: boolean;
  arrayCount: number;
  offsetDistance: number;
  rotateCopy: boolean;
  mirrorCopy: boolean;
  offsetCopy: boolean;
}

export interface PointerInfo {
  /** Posição crua do cursor em metros. */
  raw: Vec2;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

/** Contrato único de ferramenta (docs/01 §7). A ferramenta nunca altera o modelo: ela emite comandos. */
export interface Tool {
  readonly id: string;
  readonly label: string;
  /** Texto de ajuda para a barra de status. */
  readonly hint: string;
  start(): void;
  /** Atualiza a pré-visualização. */
  move(p: PointerInfo): void;
  click(p: PointerInfo): void;
  /** Valor digitado (medida em metros, ângulo em graus ou contagem), confirmado com Enter. */
  type(text: string): boolean;
  /** Tab alterna uma opção da ferramenta. */
  tab(): void;
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
  /** Rótulo do campo numérico pendente (ex.: "Comprimento"), ou null se a ferramenta não espera valor. */
  inputPrompt(): string | null;
}
