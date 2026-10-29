/**
 * Contrato da extensão Hestia no IFC (onda 0). O agente da onda 1 preenche a escrita/leitura; por enquanto só os nomes
 * e o formato do registro ficam congelados, para exportador e importador não divergirem.
 */

/** Property set de cada elemento nativo: `HestiaId`, `HestiaKind`, `HestiaType`, `HestiaJSON`. */
export const HESTIA_ELEMENT_PSET = 'Pset_Hestia_Element';
/** Property set do projeto: `HestiaVersion`, `SchemaVersion`, `SettingsJSON`. */
export const HESTIA_PROJECT_PSET = 'Pset_Hestia_Project';

/** Campos que o `HestiaJSON` de um elemento precisa carregar para reconstruí-lo sem heurística. */
export interface HestiaElementRecord {
  id: string;
  kind: string;
  levelId: string;
  typeId?: string;
  hostId?: string;
  /** Demais campos do elemento nativo (offset, baseOffset, height, flipped, joins, layers são do tipo, etc.). */
  [campo: string]: unknown;
}
