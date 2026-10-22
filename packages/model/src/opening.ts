import type { Id, OpeningLeaves, OpeningType, PlanSymbol, Project } from './types.ts';
import { acabamentoIssue, type OpeningAcabamento } from './openingExtras.ts';

/**
 * Família de abertura (Revit: família da porta/janela; ArchiCAD: Library Part). A família define o COMPORTAMENTO e o
 * SÍMBOLO de planta e quais contagens de folhas ela aceita; o tipo (`OpeningType`) escolhe a família e os valores; a
 * instância (`Opening`) guarda a posição, o lado da dobradiça e o sentido de abertura.
 *
 * `double` e `pivot` continuam em `PlanSymbol` para ler arquivos antigos: `double` é o giro com duas folhas (o símbolo
 * normaliza, ver `normalize` em `geom/openingSymbol.ts`) e a porta pivotante é mantida por decisão do dono do projeto.
 */
export type OpeningFamilyId =
  | 'door_swing'
  | 'door_double'
  | 'door_sliding'
  | 'door_pivot'
  | 'door_void'
  | 'window_fixed'
  | 'window_tilt'
  | 'window_casement'
  | 'window_sliding'
  | 'window_void';

export interface OpeningFamily {
  id: OpeningFamilyId;
  kind: 'door' | 'window';
  /** Símbolo de planta da família. */
  plan: PlanSymbol;
  /**
   * Contagens de folhas aceitas pela família. Porta: 1 (giro e pivotante), 2 (dupla e correr) ou 0 (vão livre). Janela:
   * 1 (fixa, basculante e maxim-ar), 2 ou 3 (correr) ou 0 (vão livre).
   */
  leaves: readonly OpeningLeaves[];
  /** Nome para a interface. */
  name: string;
}

/**
 * Famílias aceitas, na ordem em que a interface as oferece. Portas e janelas de correr têm sempre duas folhas no
 * símbolo (as folhas se deslocam em faces opostas); a janela de correr aceita ainda três, que o símbolo desenha em
 * faixas paralelas.
 */
export const OPENING_FAMILIES: readonly OpeningFamily[] = [
  { id: 'door_swing', kind: 'door', plan: 'swing', leaves: [1], name: 'Porta de giro' },
  { id: 'door_double', kind: 'door', plan: 'double', leaves: [2], name: 'Porta dupla' },
  { id: 'door_sliding', kind: 'door', plan: 'sliding', leaves: [2], name: 'Porta de correr' },
  { id: 'door_pivot', kind: 'door', plan: 'pivot', leaves: [1], name: 'Porta pivotante' },
  { id: 'door_void', kind: 'door', plan: 'swing', leaves: [0], name: 'Vão livre' },
  { id: 'window_fixed', kind: 'window', plan: 'fixed', leaves: [1], name: 'Janela fixa' },
  { id: 'window_tilt', kind: 'window', plan: 'tilt', leaves: [1], name: 'Janela basculante' },
  { id: 'window_casement', kind: 'window', plan: 'casement', leaves: [1], name: 'Janela maxim-ar' },
  { id: 'window_sliding', kind: 'window', plan: 'sliding', leaves: [2, 3], name: 'Janela de correr' },
  { id: 'window_void', kind: 'window', plan: 'fixed', leaves: [0], name: 'Vão livre' },
];

/** Famílias de porta ou de janela, na ordem da interface. */
export function openingFamilies(kind: OpeningType['kind']): OpeningFamily[] {
  return OPENING_FAMILIES.filter((f) => f.kind === kind);
}

/**
 * Família de um tipo de abertura, ou null quando a combinação (símbolo × folhas) não existe. O vão livre tem 0 folhas:
 * na porta o símbolo é o arco e na janela é a fixa, porque sem folha o desenho é só a soleira tracejada.
 */
export function openingFamilyOf(t: Pick<OpeningType, 'kind' | 'plan' | 'leaves'>): OpeningFamily | null {
  const families = openingFamilies(t.kind);
  const exact = families.find((f) => f.plan === t.plan && f.leaves.includes(t.leaves));
  if (exact) return exact;
  // Porta de duas folhas: o arquivo antigo guarda `double` e o editor pode gravar `swing` com 2 folhas. Os dois são a
  // mesma família (o símbolo normaliza `double` para `swing` com 2 folhas).
  if (t.kind === 'door' && t.leaves === 2 && (t.plan === 'swing' || t.plan === 'double')) {
    return families.find((f) => f.id === 'door_double') ?? null;
  }
  return null;
}

/** Contagens de folhas aceitas pelo tipo, ou vazio quando a família não existe. */
export function openingLeaves(t: Pick<OpeningType, 'kind' | 'plan' | 'leaves'>): readonly OpeningLeaves[] {
  return openingFamilyOf(t)?.leaves ?? [];
}

/** Nome da família do tipo ("Porta de giro"), ou null quando a combinação não existe. */
export function openingFamilyName(t: Pick<OpeningType, 'kind' | 'plan' | 'leaves'>): string | null {
  return openingFamilyOf(t)?.name ?? null;
}

/**
 * Regra do tipo que o modelo confere ao salvar (`upsertOpeningType`): a família e a contagem de folhas têm de existir, e o acabamento tem de estar nos limites.
 * Devolve a 1ª mensagem, ou null. O tipo é um schema fechado (nada de parâmetros autorais como no Revit): o que não
 * está em `OPENING_FAMILIES` não é desenhável e por isso é recusado.
 */
export function openingTypeIssue(t: Pick<OpeningType, 'kind' | 'plan' | 'leaves'> & OpeningAcabamento): string | null {
  if (!openingFamilyOf(t)) {
    const kind = t.kind === 'door' ? 'porta' : 'janela';
    const leaves = t.leaves === 0 ? 'sem folha (vão livre)' : `${t.leaves} folha${t.leaves > 1 ? 's' : ''}`;
    return `Combinação inválida: ${kind} com o símbolo "${t.plan}" e ${leaves}.`;
  }
  return acabamentoIssue(t);
}

/** Tipos favoritos do projeto, na ordem gravada (vazio quando não há nenhum). */
export function openingFavorites(p: Pick<Project, 'settings'>): Id[] {
  return p.settings?.favoriteOpeningTypes ?? [];
}

/** Lista de favoritos depois de ligar/desligar um tipo (função pura; o comando grava o resultado). */
export function nextOpeningFavorite(list: readonly Id[], id: Id): Id[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Liga ou desliga o favorito de um tipo no projeto (muda `p` no lugar, para uso do comando). */
export function toggleFavoriteIn(p: Project, id: Id): void {
  if (!p.openingTypes[id]) throw new Error('Tipo de abertura inexistente');
  p.settings = { ...p.settings, favoriteOpeningTypes: nextOpeningFavorite(p.settings.favoriteOpeningTypes ?? [], id) };
}
