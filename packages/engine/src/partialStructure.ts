import type { PartialStructure, Project } from '@hestia/model';
import type { ResolvedLevel } from './resolve.ts';

/**
 * Exibição parcial de estrutura (decisão 0015 §2.5): devolve o nível com as camadas de parede filtradas (`noFinishes` sem
 * acabamento, `coreOnly` só o núcleo). Só desenho: não altera o modelo nem os quantitativos. `entire` devolve o mesmo objeto.
 * (Esqueleto: o corpo é implementado na frente de engine do plano de gráficos.)
 */
export function applyPartialStructure(_p: Project, level: ResolvedLevel, mode: PartialStructure): ResolvedLevel {
  return mode === 'entire' ? level : level;
}
