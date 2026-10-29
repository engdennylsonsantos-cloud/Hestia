import type { SketchIssue, SketchIssueCode, SketchResult, SketchTarget } from '@hestia/geom';
import { defaultUnits, formatQuantity, type ResolvedUnits } from '@hestia/model';

/** Textos do perímetro (pt-BR): títulos dos grupos, rótulos de ferramenta, barra de status e lista de problemas. */

/** Título do grupo nas propriedades e da seção do elemento. */
export const PERIMETER_TITLE: Record<SketchTarget, string> = {
  roof: 'Perímetro do telhado',
  floor: 'Perímetro do piso',
  slab: 'Perímetro da laje',
  ceiling: 'Perímetro do forro',
};

/** Nome da ferramenta: barra de opções e aba "Modificar | …". */
export const PERIMETER_TOOL: Record<SketchTarget, string> = {
  roof: 'Criar perímetro do telhado',
  floor: 'Criar perímetro do piso',
  slab: 'Criar perímetro da laje',
  ceiling: 'Criar perímetro do forro',
};

/** Nome da ferramenta no idioma inglês (aba contextual em en). */
export const PERIMETER_TOOL_EN: Record<SketchTarget, string> = {
  roof: 'Create Roof Perimeter',
  floor: 'Create Floor Perimeter',
  slab: 'Create Slab Perimeter',
  ceiling: 'Create Ceiling Perimeter',
};

/** O que Concluir grava, para o rótulo do botão ("grava o telhado"). */
const GRAVA: Record<SketchTarget, string> = { roof: 'o telhado', floor: 'o piso', slab: 'a laje', ceiling: 'o forro' };

const ISSUE_TEXT: Record<SketchIssueCode, string> = {
  open: 'Laço aberto: uma ponta não encontra outra linha.',
  'too-few': 'Laço com menos de três lados.',
  'zero-length': 'Há uma linha de comprimento zero.',
  'self-cross': 'Uma linha cruza outra do mesmo laço.',
  overlap: 'Linhas colineares se sobrepõem.',
  'loops-cross': 'Dois laços se cruzam.',
  'loops-touch': 'Dois laços se tocam.',
  'hole-outside': 'O furo não fica inteiro dentro do contorno externo.',
  'hole-in-hole': 'Um laço dentro de furo não é permitido.',
  'multi-outer': 'Há dois contornos externos separados.',
  empty: 'Não há linhas para formar um contorno.',
};

/** Texto de um código de problema do contorno. */
export const issueText = (code: SketchIssueCode): string => ISSUE_TEXT[code];

/** Problemas do rascunho com o texto em pt-BR, na ordem em que o deduzidor os achou. */
export type IssueLine = SketchIssue & { text: string };

export function issueLines(result: SketchResult): IssueLine[] {
  return result.issues.map((i) => ({ ...i, text: ISSUE_TEXT[i.code] }));
}

/** Ajuda do modo, mostrada ao entrar e enquanto o contorno não estiver fechado. */
export function perimeterHint(target: SketchTarget): string {
  if (target === 'roof') {
    return `${PERIMETER_TOOL.roof}: clique nos vértices para ajustar. O triângulo de cada aresta define a inclinação. Use Aparar/Estender, Dividir e Deslocar nas linhas para fechar o contorno. Concluir grava, Cancelar descarta.`;
  }
  return `${PERIMETER_TOOL[target]}: clique nos vértices para ajustar. Concluir grava, Cancelar descarta.`;
}

/** Mensagem da barra de status conforme o resultado da dedução do contorno. */
export function sketchStatus(target: SketchTarget, result: SketchResult | null): string {
  if (!result) return perimeterHint(target);
  if (result.ok) return `Contorno fechado: Concluir grava ${GRAVA[target]}.`;
  const [first, ...rest] = result.issues;
  if (!first) return perimeterHint(target);
  if (rest.length === 0) return ISSUE_TEXT[first.code];
  return `${ISSUE_TEXT[first.code]} Mais ${rest.length} ${rest.length === 1 ? 'problema' : 'problemas'} na lista.`;
}

/** Dica do botão Concluir: diz o que grava, ou por que ainda não pode gravar. */
export function finishTitle(target: SketchTarget, result: SketchResult | null): string {
  if (result?.ok) return `Concluir perímetro (grava ${GRAVA[target]})`;
  const first = result?.issues[0];
  return first ? `Concluir indisponível: ${ISSUE_TEXT[first.code]}` : 'Concluir indisponível: desenhe um contorno fechado';
}

/** Dados de uma aresta para a mensagem da barra de status. */
export interface EdgeStatusInput {
  index: number;
  lengthM: number;
  /** Só telhado. Ausente nos demais alvos. */
  definesSlope?: boolean;
  slopePct?: number;
}

/** Mensagem ao selecionar uma aresta: comprimento, e no telhado se define inclinação. */
export function edgeStatus(e: EdgeStatusInput, units: ResolvedUnits = defaultUnits()): string {
  const head = `Aresta ${e.index + 1}`;
  if (e.definesSlope === undefined) return `${head}: ${formatQuantity(units, 'length', e.lengthM)}.`;
  if (!e.definesSlope) return `${head}: não define inclinação.`;
  return `${head}: define inclinação (${formatQuantity(units, 'slope', (e.slopePct ?? 0) / 100)}).`;
}
