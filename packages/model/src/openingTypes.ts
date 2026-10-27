import type { Id, WrapMode } from './types.ts';

/**
 * Família do símbolo de planta. Portas: arco com folha (swing), dupla, correr, pivotante.
 * Janelas: fixa, basculante, maxim-ar (arco tracejado) e correr.
 */
export type PlanSymbol =
  | 'swing' | 'double' | 'sliding' | 'pivot' | 'fixed' | 'tilt' | 'casement'
  // Esquadrias v2 (decisão 0034): famílias novas. `hinged` = janela de abrir com giro lateral (`casement` segue sendo a maxim-ar).
  | 'dblact' | 'pocket' | 'bifold' | 'accordion' | 'garage' | 'hinged' | 'hung' | 'pivotwin' | 'louver';

/** Contagem de folhas de uma abertura. 0 = vão livre (sem folha nem caixilho). As famílias aceitas estão em `opening.ts`. */
export type OpeningLeaves = 0 | 1 | 2 | 3 | 4;

export interface OpeningType {
  id: Id;
  kind: 'door' | 'window';
  name: string;
  /** Código do tipo (Revit: Type Mark), como "P-01" ou "J-02"; vazio quando não informado. */
  code?: string;
  /** Descrição livre do tipo; vazio quando não informada. */
  description?: string;
  width: number;
  height: number;
  /** Peitoril padrão (0 para porta). */
  sill: number;
  /** Folhas. 0 = vão livre: só o recorte e a soleira, sem folha nem caixilho. */
  leaves: OpeningLeaves;
  /** Símbolo de planta da família. */
  plan: PlanSymbol;
  frameMaterialId: Id;
  glassMaterialId: Id;
  /** Fechamento do vão (Revit: Wall Closure): substitui o retorno do tipo de parede quando não é 'inherit'. */
  closure: 'inherit' | WrapMode;
  /*
   * Esquadria (m). Opcionais: arquivos antigos não os têm e a leitura usa o padrão (`openingFrame`, em defaults.ts).
   * Largura do perfil do batente e do caixilho; profundidade do batente na parede (limitada à espessura da parede);
   * espessura da folha; espessura do vidro.
   */
  frameWidth?: number;
  frameDepth?: number;
  leafThickness?: number;
  glassThickness?: number;
  /*
   * Acabamento e vão bruto (m), todos opcionais: ausente vale o padrão por leitura (`openingExtras.ts`), sem migração.
   * `roughOversize`: folga total do vão bruto em relação à largura e à altura do tipo (o furo cresce, a esquadria não).
   * `casing`: alizar em volta do vão nas duas faces da parede (largura vista e espessura saliente).
   * `sillBoard`: peitoril saliente de janela (projeção além de cada face e espessura).
   * `lintel`/`sillBeam`: verga e contraverga (transpasse para cada lado e altura; padrão do transpasse 0,30 m).
   */
  roughOversize?: { w: number; h: number };
  casing?: { width: number; thickness: number };
  sillBoard?: { projection: number; thickness: number };
  lintel?: { over?: number; height?: number };
  sillBeam?: { over?: number; height?: number };
  /*
   * Esquadria v2 (docs/aberturas/E-spec-modelo-unico.md). Todos opcionais: ausente vale o padrão por leitura
   * (`openingStyle.ts`), sem migração e sem mudar a aparência de arquivos antigos.
   */
  /** Estilo da folha (miniatura no diálogo). Porta: padrão 'flush'. Janela: 'glass'. */
  leafStyle?: OpeningLeafStyle;
  /** Maçaneta da porta. Padrão 'lever' na porta de giro e 'none' nas demais. */
  handle?: OpeningHandle;
  /** Estilo do batente: com rebaixo (padrão), simples, aduela (pré-marco) ou bloco (sem perfil visível). */
  frameStyle?: OpeningFrameStyle;
  /** Divisões do caixilho/vidro (colunas × linhas de vidro). Padrão 1 × 1. */
  grid?: { cols: number; rows: number };
  /** Bandeira superior (vidro acima da folha) e bandeiras laterais. Ausente = sem. */
  transom?: { height: number; fixed?: boolean };
  sidelights?: { left?: boolean; right?: boolean; width: number };
  /** Ângulo de abertura em planta e no 3D, em graus (porta de giro padrão 90; maxim-ar e basculante no 3D, 30). */
  angle2d?: number;
  angle3d?: number;
  /** Exibição em planta: simbólica (padrão) ou projetada (folha fechada com espessura + o que está acima do corte). */
  planDisplay?: 'symbolic' | 'projected';
  /** Nível de detalhe da planta: 'scale' (padrão, depende da escala), 'low' | 'mid' | 'high' fixos ou 'off'. */
  detail2d?: 'scale' | 'low' | 'mid' | 'high' | 'off';
  /** Nível de detalhe do 3D: 'view' (padrão, segue a vista), 'schematic' | 'simple' | 'full' ou 'off' (só o vão). */
  detail3d?: 'view' | 'schematic' | 'simple' | 'full' | 'off';
  /** Arco de giro em planta: mostrar (padrão sim) e estilo. */
  showSwing?: boolean;
  swingStyle?: 'arc' | 'dash' | 'line';
  /** Posição da folha na profundidade do batente: do lado em que ela abre (padrão) ou do lado oposto. */
  leafSide?: 'swing' | 'opposite';
  /** Dados BIM do tipo (quadro e IFC). */
  fireRating?: string;
  acousticRw?: number;
  uValue?: number;
  solarFactor?: number;
  cost?: number;
  manufacturer?: string;
}

export type OpeningLeafStyle = 'flush' | 'panel' | 'glass' | 'louver' | 'grille';
export type OpeningHandle = 'none' | 'lever' | 'knob' | 'pull';
export type OpeningFrameStyle = 'rebate' | 'simple' | 'aduela' | 'block';

/**
 * Convenção da linha de abertura nas elevações e cortes (decisão do dono, 2026-10-26): o vértice do V fica no lado
 * OPOSTO ao da dobradiça ('latch', padrão) ou no lado da dobradiça ('hinge'). `dashed`: tracejado quando a folha abre
 * 'toward' o observador (padrão) ou 'away' dele.
 */
export interface OpeningLineConvention {
  apex: 'latch' | 'hinge';
  dashed: 'toward' | 'away';
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
