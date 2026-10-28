import type { Id } from './types.ts';
import type { OpeningFamilyId } from './opening.ts';
import type { OpeningFrameDepthMode, OpeningFrameStyle, OpeningGlassKind, OpeningLeaves, OpeningType } from './openingTypes.ts';

/*
 * CONTRATO da composição de esquadrias (F1; spec: docs/aberturas/F1-spec-composicao.md). SÓ tipos e constantes puras:
 * nada aqui tem lógica. As fases F3 (modelo/migração), F4 (motor) e F6 (UI) implementam as funções declaradas ao fim.
 * Ainda NÃO exportado por `index.ts`. Unidades: metros e radianos. Coordenadas locais do vão: `t` (largura), `s` (profundidade), `z` (altura).
 */

/** Versão do formato da composição (campo `OpeningComposition.version`). O esquema do projeto sobe de 19 para 20 (spec §7). */
export const COMPOSITION_VERSION = 1;
export const COMPOSITION_PROJECT_SCHEMA = 20;

// ───────────────────────── Perfil paramétrico ─────────────────────────

/** Materiais desta rodada. Aço fica para depois. `glass` = vidro temperado sem perfil (frameless). */
export type ProfileMaterial = 'wood' | 'aluminum' | 'pvc' | 'glass';
/** Seção: retângulo, retângulo com rebaixo/batedor, L, T, com câmaras (PVC) ou nenhuma (vidro sem perfil). */
export type ProfileSection = 'rect' | 'rect_rebate' | 'L' | 'T' | 'chambered' | 'none';
/** Papel do perfil na composição (R2: papel, não tipo de objeto). */
export type ProfileRole = 'frame' | 'divider' | 'sash' | 'sill' | 'bead';

/** Rebaixo do vidro. TODOS os valores são "a validar" (R2: rebaixo/folga/baguete não confirmados) e editáveis. */
export interface GlassRebate {
  /** Profundidade do rebaixo (quanto do vidro entra no perfil, medida no plano da folha). */
  depth: number;
  /** Folga lateral/superior entre o vidro e o fundo do rebaixo. */
  clearance: number;
  /** Largura visível do baguete (peça de fixação); 0 = sem baguete. */
  bead: number;
}

export interface ProfileSpec {
  material: ProfileMaterial;
  section: ProfileSection;
  /** Largura visível na face da parede, vista em elevação (o `J` do motor). */
  visibleWidth: number;
  /** Profundidade na direção da parede (`s`). Só vale com `depthMode 'fixed'`; nos modos 'core' e 'wall' a parede manda (spec §3.3). */
  depth: number;
  /** Largura do batedor (lábio) em seção com rebaixo, L e T. Padrão histórico 0,015. */
  stopWidth?: number;
  /** Rebaixo do vidro (quando o perfil recebe vidro). */
  glassRebate?: GlassRebate;
  /** Número de câmaras (PVC), só informativo. */
  chambers?: number;
}

/** Campos do `ProfileSpec` cujo valor tem fonte confirmada na pesquisa F0 (R2). Os ausentes são "a validar". */
export type ProfileField = 'visibleWidth' | 'depth' | 'stopWidth' | 'glassRebate' | 'section';

/** Preset editável (o usuário pode alterá-lo no projeto; a lista inicial abaixo é só a semente). */
export interface ProfilePreset {
  id: Id;
  name: string;
  roles: readonly ProfileRole[];
  spec: ProfileSpec;
  /** Campos confirmados e sua fonte (R1, R2...); o resto é "a validar". */
  confirmed: readonly ProfileField[];
  source: string;
}

/** Perfil usado por um membro: preset (com ajustes opcionais) ou perfil solto no próprio objeto (tipos migrados). */
export type ProfileRef = { presetId: Id; override?: Partial<ProfileSpec> } | { inline: ProfileSpec };

// Padrões razoáveis, TODOS a validar. Editáveis por projeto.
export const GLASS_REBATE_DEFAULTS: GlassRebate = { depth: 0.012, clearance: 0.003, bead: 0.015 };
/** Vidro temperado sem perfil (frameless): folga ao redor e à parede/ferragem de canto (a validar; R2 só confirma 8 mm). */
export const FRAMELESS_CLEARANCE_DEFAULT = 0.005;
export const STOP_WIDTH_DEFAULT = 0.015;
/** Folga folha × batente (a mesma de `GAP` em openingModelContext.ts). */
export const LEAF_GAP_DEFAULT = 0.004;
/** Largura padrão do divisor interno quando o perfil não a define (igual ao batente padrão do Hestia). */
export const DIVIDER_WIDTH_DEFAULT = 0.05;
/** Larguras do montante lateral e da travessa da bandeira do modelo ANTIGO (migração fiel de tipos antigos). */
export const LEGACY_SIDELIGHT_MULLION = 0.04;
export const LEGACY_TRANSOM_BAR = 0.04;
/** Tolerância (m) do teste de equivalência tipo antigo × composição migrada. */
export const EQUIVALENCE_TOLERANCE = 1e-9;

const preset = (id: string, name: string, roles: ProfileRole[], spec: ProfileSpec, confirmed: ProfileField[], source: string): ProfilePreset => ({
  id,
  name,
  roles,
  spec,
  confirmed,
  source,
});
const GR = GLASS_REBATE_DEFAULTS;

/** 18 presets iniciais. Dimensões marcadas em `confirmed` vêm de R2 (pesquisa F0); rebaixo e seção são sempre a validar. */
export const OPENING_PROFILE_PRESETS: readonly ProfilePreset[] = [
  preset('prf_mad_batente_3x14', 'Madeira batente 3×14', ['frame'], { material: 'wood', section: 'rect_rebate', visibleWidth: 0.03, depth: 0.14, stopWidth: 0.015 }, ['visibleWidth', 'depth'], 'R2/SINAPI 90801 (30×140 mm)'),
  preset('prf_mad_batente_5x9', 'Madeira batente 5×9 (padrão Hestia)', ['frame'], { material: 'wood', section: 'rect_rebate', visibleWidth: 0.05, depth: 0.09, stopWidth: 0.015 }, [], 'defaults.ts (OPENING_FRAME_DEFAULTS); usado na migração'),
  preset('prf_mad_aduela_3', 'Madeira aduela 3', ['frame'], { material: 'wood', section: 'rect_rebate', visibleWidth: 0.03, depth: 0.14, stopWidth: 0.015 }, ['visibleWidth'], 'E3 §2 (aduela J = 0,03)'),
  preset('prf_mad_marco_3x7', 'Madeira marco 3×7', ['frame'], { material: 'wood', section: 'rect_rebate', visibleWidth: 0.03, depth: 0.07, glassRebate: GR }, ['depth'], 'R2/SINAPI (marco 7×3; orientação a validar)'),
  preset('prf_mad_caixilho_35x70', 'Madeira caixilho 3,5×7', ['sash', 'frame'], { material: 'wood', section: 'rect_rebate', visibleWidth: 0.035, depth: 0.07, glassRebate: GR }, ['visibleWidth', 'depth'], 'R2 (caixilho 3,5×7 cm)'),
  preset('prf_mad_folha_35', 'Madeira folha 3,5', ['sash'], { material: 'wood', section: 'rect', visibleWidth: 0.07, depth: 0.035, glassRebate: GR }, ['depth'], 'R2 (folha de porta 3,5 cm, edital Joinville)'),
  preset('prf_mad_montante_4x9', 'Madeira montante 4×9', ['divider'], { material: 'wood', section: 'T', visibleWidth: 0.04, depth: 0.09, stopWidth: 0.015, glassRebate: GR }, [], 'openingModelContext.ts (SIDELIGHT_MULLION 0,04)'),
  preset('prf_mad_divisor_5x9', 'Madeira divisor 5×9', ['divider'], { material: 'wood', section: 'T', visibleWidth: 0.05, depth: 0.09, stopWidth: 0.015, glassRebate: GR }, [], 'derivado do batente 5×9'),
  preset('prf_alu_l25', 'Alumínio linha 25', ['frame', 'sash'], { material: 'aluminum', section: 'L', visibleWidth: 0.03, depth: 0.06, glassRebate: GR }, ['depth'], 'R2 (batente 60–70 mm linha 25; largura visível a validar)'),
  preset('prf_alu_l25_110', 'Alumínio linha 25 moldura 11', ['frame'], { material: 'aluminum', section: 'L', visibleWidth: 0.03, depth: 0.11, glassRebate: GR }, ['depth'], 'R2 (moldura 110 mm, varejo Bergamo)'),
  preset('prf_alu_l20', 'Alumínio linha 20', ['frame', 'sash'], { material: 'aluminum', section: 'L', visibleWidth: 0.025, depth: 0.08, glassRebate: GR }, ['depth'], 'R2 (moldura 80 mm, varejo Bergamo)'),
  preset('prf_alu_suprema', 'Alumínio Suprema', ['frame', 'sash'], { material: 'aluminum', section: 'L', visibleWidth: 0.035, depth: 0.06, glassRebate: GR }, [], 'R2 (só contramarco 60 mm; resto a validar)'),
  preset('prf_alu_divisor_25', 'Alumínio divisor 25', ['divider'], { material: 'aluminum', section: 'T', visibleWidth: 0.025, depth: 0.06, glassRebate: GR }, [], 'derivado da linha 25'),
  preset('prf_pvc_60', 'PVC 60 (3 câmaras)', ['frame', 'sash'], { material: 'pvc', section: 'chambered', visibleWidth: 0.06, depth: 0.06, chambers: 3, glassRebate: GR }, ['depth'], 'R2 (Euro-Design 60, BauPlaza 60)'),
  preset('prf_pvc_70', 'PVC 70 (5 câmaras)', ['frame', 'sash'], { material: 'pvc', section: 'chambered', visibleWidth: 0.07, depth: 0.07, chambers: 5, glassRebate: GR }, ['depth'], 'R2 (Aluplast Ideal 4000, 70 mm)'),
  preset('prf_pvc_divisor_60', 'PVC divisor 60', ['divider'], { material: 'pvc', section: 'chambered', visibleWidth: 0.08, depth: 0.06, chambers: 3, glassRebate: GR }, [], 'derivado do PVC 60'),
  preset('prf_vid_temp_8', 'Vidro temperado 8 mm sem perfil', ['frame', 'sash'], { material: 'glass', section: 'none', visibleWidth: 0, depth: 0.008 }, ['depth'], 'R2 (8 mm em box e esquadria)'),
  preset('prf_vid_temp_10', 'Vidro temperado 10 mm sem perfil', ['frame', 'sash'], { material: 'glass', section: 'none', visibleWidth: 0, depth: 0.01 }, [], 'catálogo atual (blindex 8/10 mm)'),
];

/** Material lógico do projeto para cada material de perfil (ids de `defaults.ts`). */
export const PROFILE_MATERIAL_IDS: Readonly<Record<ProfileMaterial, Id>> = {
  wood: 'mat_madeira',
  aluminum: 'mat_aluminio',
  pvc: 'mat_pvc',
  glass: 'mat_vidro',
};

// ───────────────────────── Layout e células ─────────────────────────

/** Tamanho de um filho de divisão: `fixed` = LUZ do módulo (entre faces de membros); `fill` divide o que sobra por peso. */
export type CellSize = { mode: 'fixed'; value: number } | { mode: 'fill'; weight?: number };

/** Opções de folha reaproveitadas do tipo atual (mesmos nomes, mesmos padrões por leitura). */
export type LeafOptions = Pick<
  OpeningType,
  | 'leafStyle' | 'handle' | 'glassRatio' | 'hinges' | 'leafThickness' | 'leafMaterialId' | 'glassKind' | 'glassThickness' | 'grid'
  | 'tiltAxis' | 'leafSide' | 'leafUndercut' | 'handleHeight' | 'handleInset' | 'angle2d' | 'angle3d' | 'showSwing' | 'swingStyle' | 'leafPlan'
>;

export interface GlassSpec {
  kind: OpeningGlassKind;
  thickness: number;
  /** 'rebate' = no rebaixo do perfil vizinho; 'frameless' = vidro temperado sem perfil (folga, sem rebaixo). */
  mounting: 'rebate' | 'frameless';
  /** Divisões decorativas (colunas × linhas), como `grid` do tipo atual. */
  grid?: { cols: number; rows: number };
}

export type CellContent =
  /** Folha(s) de uma família existente. `plan` é o símbolo de planta (`PlanSymbol` do tipo). */
  | { kind: 'leaf'; family: OpeningFamilyId; plan: OpeningType['plan']; leaves: OpeningLeaves; options: LeafOptions; leafProfile?: ProfileRef; mirror?: boolean }
  | { kind: 'glass'; glass: GlassSpec }
  /** Painel cego (opaco): espessura e material próprios. */
  | { kind: 'panel'; thickness: number; materialId?: Id }
  | { kind: 'louver'; blades?: number; materialId?: Id };

export interface CellNode {
  kind: 'cell';
  /** Estável: base do id das peças geradas ('cell-<id>-leaf-0'). */
  id: string;
  content: CellContent;
}

/**
 * Divisão: `cols` = filhos lado a lado, em `t` crescente; `rows` = filhos empilhados, em `z` crescente (de baixo para cima).
 * Entre dois filhos vizinhos há UM membro divisor (montante em `cols`, travessa em `rows`). Mínimo 2 filhos, no máximo 1 `fill`.
 */
export interface SplitNode {
  kind: 'split';
  id: string;
  axis: 'cols' | 'rows';
  children: ReadonlyArray<{ size: CellSize; node: CompositionNode }>;
  /** Perfil do divisor desta divisão (ausente = `DIVIDER_WIDTH_DEFAULT` com o material do batente). */
  divider?: ProfileRef;
}

export type CompositionNode = CellNode | SplitNode;

// ───────────────────────── Quadro, alizar, composição ─────────────────────────

export interface FrameSpec {
  /** Estilo existente: 'block' = sem peças de batente. */
  style: OpeningFrameStyle;
  profile: ProfileRef;
  depthMode: OpeningFrameDepthMode;
  /** Profundidade para `depthMode 'fixed'` (m); ausente = `profile.depth`. */
  fixedDepth?: number;
  /** Membro inferior: janela = peitoril do caixilho (padrão ligado); porta = soleira só se `threshold` do tipo existir. */
  sill?: ProfileRef | null;
}

export interface CasingDims {
  width: number;
  thickness: number;
  /** Recuo da aresta interna (m, ≥ 0): 0 = alinhada à face do batente; > 0 mostra `setback` do batente. */
  setback: number;
}

/** Faces do alizar: 'both' (padrão), 'swing'/'opposite' (relativo à folha principal), 'exterior'/'interior' (relativo à parede) ou 'none'. */
export type CasingFaces = 'both' | 'swing' | 'opposite' | 'exterior' | 'interior' | 'none';

export interface CasingSpec extends CasingDims {
  faces: CasingFaces;
  /** Dimensões próprias por face (ausente = as de cima). */
  exterior?: Partial<CasingDims>;
  interior?: Partial<CasingDims>;
  materialId?: Id;
}

/** Referência nominal (como `nominalRef`/`spanGap` do tipo): ver spec §2.5. */
export interface NominalSpec {
  ref: 'opening' | 'leaf';
  /** 'opening': vão total. 'leaf': folha nominal da célula `nominalCellId`; o vão é derivado (folha + gap + demais módulos). */
  width: number;
  height: number;
  gap?: { w: number; h: number };
  nominalCellId?: string;
}

export interface OpeningComposition {
  version: typeof COMPOSITION_VERSION;
  nominal: NominalSpec;
  frame: FrameSpec;
  layout: CompositionNode;
  casing?: CasingSpec;
}

/** Regras do alizar (decisão do dono; o 3D valida depois). Constantes lidas pelo motor e pela UI. */
export const CASING_RULES = {
  defaultFaces: 'both' as CasingFaces,
  defaultSetback: 0,
  /** Lados do anel: porta sem bandeira = 3 (sem o inferior); porta com bandeira superior sobe até o topo dela; janela = 4. */
  sidesDoor: 3,
  sidesWindow: 4,
  /** O anel contorna o CONJUNTO (envoltória da luz de todas as células), nunca cada módulo; sem alizar nos divisores internos. */
  surrounds: 'assembly' as const,
  /** Exclusivo com o retorno do acabamento (`closure`): com alizar o retorno é 'none'. */
  exclusiveWithClosure: true,
  /** Assenta na face acabada da parede: s de T/2 a T/2 + thickness (e o espelho). */
  seatsOnFinishedFace: true,
  defaultWidth: 0.07,
  defaultThickness: 0.015,
} as const;

// ───────────────────────── Resultado da resolução (contrato F3 → F4) ─────────────────────────

export interface Rect {
  t0: number;
  t1: number;
  z0: number;
  z1: number;
}

/** O que está de um lado de um membro: parede, vazio (piso/ar), ou uma célula (e como o membro a recebe). */
export type MemberNeighbor =
  | { kind: 'wall' | 'floor' }
  | { kind: 'cell'; cellId: string; treatment: 'stop' | 'glassRebate' | 'panelRebate' | 'plain' };

export type MemberRole = 'jamb' | 'head' | 'sill' | 'mullion' | 'transom' | 'threshold';

export interface ResolvedMember {
  id: string;
  role: MemberRole;
  /** Extensão no plano (t, z). A profundidade vem do modo de profundidade do quadro. */
  rect: Rect;
  profile: ProfileSpec;
  /** Vizinhos: `before` = lado de t menor (ou z menor), `after` = o outro. */
  before: MemberNeighbor;
  after: MemberNeighbor;
}

export interface ResolvedCell {
  id: string;
  /** Luz da célula (entre faces de membros), em coordenadas locais do vão. */
  luz: Rect;
  content: CellContent;
}

export interface ResolvedLayout {
  /** Vão total (conjunto) e envoltória da luz (área interna ao perímetro do quadro). */
  span: { width: number; height: number };
  luz: Rect;
  cells: ResolvedCell[];
  members: ResolvedMember[];
}

/** Anel do alizar de uma face: retângulo interno e externo; `openBottom` = sem lado inferior (porta). */
export interface CasingRing {
  face: 'exterior' | 'interior';
  inner: Rect;
  outer: Rect;
  openBottom: boolean;
  thickness: number;
}

/*
 * Funções a implementar (assinaturas; sem corpo aqui). F3: modelo e migração; F4: motor.
 *
 *   compositionOfType(t: OpeningType): OpeningComposition                     // F3: o tipo antigo vira composição de 1 célula (spec §7)
 *   normalizeComposition(c: unknown): OpeningComposition                       // F3: validação e padrões por leitura
 *   compositionIssue(c: OpeningComposition): string | null                     // F3: regras (1 fill, tamanhos > 0, ids únicos...)
 *   compositionSpan(c: OpeningComposition): { width: number; height: number }   // F3: vão total (nominalRef)
 *   resolveProfile(r: ProfileRef, presets: Readonly<Record<Id, ProfilePreset>>): ProfileSpec         // F3
 *   resolveLayout(c: OpeningComposition, presets: Readonly<Record<Id, ProfilePreset>>): ResolvedLayout // F4: tabela de decisão da spec §3
 *   casingRings(c: OpeningComposition, l: ResolvedLayout, kind: 'door' | 'window'): CasingRing[]       // F4: spec §4
 */
