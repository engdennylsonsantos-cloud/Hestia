import type { Id, Project, ViewRange } from '@hestia/model';
import { classifyLevelEntries } from './viewClass.ts';

/**
 * Aberturas do nível cujo vão cruza o plano de corte da vista (z0 ≤ corte ≤ z1, decisão 0013 §4). A planta usa este
 * conjunto para decidir quais aberturas furam a parede: as demais não furam (peitoril acima do corte ou verga abaixo
 * dele) e a parede é desenhada inteira. Só afeta a planta; o modelo e a geometria 3D não mudam.
 */
export function openingsCrossingCut(p: Project, levelId: Id, range: ViewRange): Set<Id> {
  return new Set(
    classifyLevelEntries(p, levelId, range)
      .filter((e) => e.category === 'opening' && e.cls === 'cut')
      .map((e) => e.id),
  );
}
