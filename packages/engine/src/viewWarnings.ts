import type { Id, Project, ViewRange } from '@hestia/model';
import { classifyLevelEntries, type ViewCategory } from './viewClass.ts';

/** `hidden`: fora do intervalo (acima do topo ou abaixo da profundidade). `beyond`: abaixo da base, dentro da profundidade. */
export type ViewWarningKind = 'hidden' | 'beyond';

/** Aviso de intervalo de vista: os elementos de uma categoria num dado estado (decisão 0013 §4). */
export interface ViewRangeWarning {
  category: ViewCategory;
  kind: ViewWarningKind;
  count: number;
  /** Ids em ordem crescente. */
  ids: Id[];
  /** Texto pt-BR, ex.: "2 paredes fora do intervalo de vista.". */
  message: string;
}

const CATEGORY_ORDER: ViewCategory[] = ['wall', 'opening', 'floor', 'slab', 'roof', 'stair'];
const KIND_ORDER: ViewWarningKind[] = ['hidden', 'beyond'];

/** Substantivo no singular e no plural, por categoria. */
const NOUNS: Record<ViewCategory, readonly [string, string]> = {
  wall: ['parede', 'paredes'],
  opening: ['abertura', 'aberturas'],
  floor: ['piso', 'pisos'],
  slab: ['laje', 'lajes'],
  roof: ['telhado', 'telhados'],
  stair: ['escada', 'escadas'],
};

const TAIL: Record<ViewWarningKind, string> = {
  hidden: 'fora do intervalo de vista.',
  beyond: 'abaixo da base do intervalo de vista.',
};

const messageOf = (category: ViewCategory, kind: ViewWarningKind, count: number): string => {
  const [one, many] = NOUNS[category];
  return `${count} ${count === 1 ? one : many} ${TAIL[kind]}`;
};

/**
 * Avisos da vista do nível: um por categoria e estado (`hidden`, `beyond`) que tenha elementos, em ordem de categoria.
 * O telhado acima do topo também aparece (é o caso comum); quem decide mostrar é a interface.
 */
export function viewRangeWarnings(p: Project, levelId: Id, range: ViewRange): ViewRangeWarning[] {
  const entries = classifyLevelEntries(p, levelId, range);
  const out: ViewRangeWarning[] = [];
  for (const category of CATEGORY_ORDER) {
    for (const kind of KIND_ORDER) {
      const ids = entries.filter((e) => e.category === category && e.cls === kind).map((e) => e.id);
      if (ids.length === 0) continue;
      out.push({ category, kind, count: ids.length, ids, message: messageOf(category, kind, ids.length) });
    }
  }
  return out;
}
