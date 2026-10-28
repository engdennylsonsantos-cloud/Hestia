import type { OpeningFamilyId } from './opening.ts';

/**
 * Quais opções do tipo se aplicam a cada família (decisão 0035, E3 §8). O diálogo esconde o que não se aplica e o motor
 * ignora o que não se aplica (sem erro e sem peça quebrada): a tabela é a única fonte.
 */
export interface OpeningOptionSupport {
  /** Bandeira superior. */
  transom: boolean;
  /** Bandeiras laterais. */
  sidelights: boolean;
  /** Divisões do vidro (colunas × linhas). */
  grid: boolean;
  /** Estilo da folha (lisa, almofadada, com vidro...). */
  leafStyle: boolean;
  /** Fração de vidro da folha (porta com vidro). */
  glassRatio: boolean;
  /** Maçaneta e fechadura. */
  handle: boolean;
  /** Dobradiças como peças. */
  hinges: boolean;
  /** Soleira/limiar de porta. */
  threshold: boolean;
  /** Alizar. */
  casing: boolean;
  /** Peitoril saliente. */
  sillBoard: boolean;
  /** Verga. */
  lintel: boolean;
  /** Contraverga. */
  sillBeam: boolean;
  /** Eixo da basculante. */
  tiltAxis: boolean;
  /** Estilo do batente e dimensões do perfil. */
  frame: boolean;
  /** Espessura da folha (há folha para espessar: janela fixa e vãos livres não têm). */
  leafThickness: boolean;
  /** Recuo do batente (reveal). */
  reveal: boolean;
  /** Dimensão nominal referida à folha (portas de giro). */
  nominalRef: boolean;
  /** Tipo de vidro. */
  glassKind: boolean;
  /** Ângulo de abertura (planta e 3D). */
  angle: boolean;
}

const NONE: OpeningOptionSupport = {
  leafThickness: false,
  transom: false, sidelights: false, grid: false, leafStyle: false, glassRatio: false, handle: false, hinges: false, threshold: false,
  casing: false, sillBoard: false, lintel: false, sillBeam: false, tiltAxis: false, frame: false, reveal: false, nominalRef: false, glassKind: false, angle: false,
};
const sup = (o: Partial<OpeningOptionSupport>): OpeningOptionSupport => ({ ...NONE, ...o });

// Maçaneta só nas portas de giro e dupla; grade (divisões do vidro) só em janela.
const DOOR_LEAF = { leafStyle: true, leafThickness: true, glassRatio: true, threshold: true, glassKind: true, casing: true, lintel: true, frame: true, reveal: true };

const TABLE: Record<OpeningFamilyId, OpeningOptionSupport> = {
  door_swing: sup({ ...DOOR_LEAF, handle: true, transom: true, sidelights: true, hinges: true, angle: true }),
  door_double: sup({ ...DOOR_LEAF, handle: true, transom: true, sidelights: true, hinges: true, angle: true }),
  door_dblact: sup({ ...DOOR_LEAF, hinges: false, angle: true }),
  door_pivot: sup({ ...DOOR_LEAF, transom: true, angle: true }),
  door_sliding: sup({ ...DOOR_LEAF, transom: true }),
  door_pocket: sup({ ...DOOR_LEAF }),
  door_bifold: sup({ leafStyle: true, leafThickness: true, threshold: true, casing: true, lintel: true, frame: true, reveal: true, angle: true }),
  door_accordion: sup({ leafThickness: true, casing: true, lintel: true, frame: true, reveal: true, angle: true }),
  door_garage: sup({ leafStyle: true, leafThickness: true, lintel: true, frame: true, reveal: true }),
  door_void: sup({ casing: true, lintel: true }),
  window_fixed: sup({ transom: true, sidelights: true, grid: true, glassKind: true, casing: true, sillBoard: true, lintel: true, sillBeam: true, frame: true, reveal: true }),
  window_hinged: sup({ leafThickness: true, transom: true, grid: true, glassKind: true, casing: true, sillBoard: true, lintel: true, sillBeam: true, frame: true, reveal: true, hinges: true, angle: true }),
  window_tilt: sup({ leafThickness: true, transom: true, grid: true, glassKind: true, casing: true, sillBoard: true, lintel: true, sillBeam: true, frame: true, reveal: true, tiltAxis: true, angle: true }),
  window_casement: sup({ leafThickness: true, transom: true, grid: true, glassKind: true, casing: true, sillBoard: true, lintel: true, sillBeam: true, frame: true, reveal: true, angle: true }),
  window_sliding: sup({ leafThickness: true, transom: true, grid: true, glassKind: true, casing: true, sillBoard: true, lintel: true, sillBeam: true, frame: true, reveal: true }),
  window_hung: sup({ leafThickness: true, grid: true, glassKind: true, casing: true, sillBoard: true, lintel: true, sillBeam: true, frame: true, reveal: true }),
  window_pivot: sup({ leafThickness: true, transom: true, grid: true, glassKind: true, casing: true, sillBoard: true, lintel: true, sillBeam: true, frame: true, reveal: true, angle: true }),
  window_louver: sup({ leafThickness: true, casing: true, sillBoard: true, lintel: true, sillBeam: true, frame: true, reveal: true, angle: true }),
  window_void: sup({ casing: true, sillBoard: true, lintel: true, sillBeam: true }),
};

// E3b: a referência nominal do tamanho (NBR 15930: "80 × 210" é a folha) só se aplica onde há folha para medir.
// Linha nova, separada da tabela acima: portas com folha; o vão livre fica de fora.
for (const id of ['door_swing', 'door_double', 'door_sliding', 'door_pivot', 'door_dblact', 'door_pocket', 'door_bifold', 'door_accordion', 'door_garage'] as const) {
  TABLE[id].nominalRef = true;
}

/** Opções aplicáveis à família (id de `OPENING_FAMILIES`). Família desconhecida: nada se aplica. */
export function openingOptionSupport(family: OpeningFamilyId | null | undefined): OpeningOptionSupport {
  return (family && TABLE[family]) || NONE;
}
