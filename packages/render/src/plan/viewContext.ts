import { resolveRoofs, viewContextOf, type ViewContext } from '@hestia/engine';
import { wallsOnLevel, type Id, type Project } from '@hestia/model';

/**
 * Cotas que a classificação da vista de um nível usa. Sem parede anexada, a faixa das paredes não lê piso, laje nem
 * telhado (ver `wallZRange`), e a faixa de um telhado do próprio nível lê só os telhados do nível: então basta resolver
 * o nível. Com parede anexada (piso, laje ou telhado), a faixa pode depender de elementos de outros níveis, e aí vale o
 * projeto inteiro, como antes. `viewContextOf` resolvia todos os níveis a cada abertura da planta, mesmo sem anexo.
 */
export function contextoDaVista(p: Project, levelId: Id): ViewContext {
  const anexada = wallsOnLevel(p, levelId).some((w) => w.attachBottomToFloor === true || w.attachTopToFloor === true || w.attachTopToRoof === true);
  if (anexada) return viewContextOf(p);
  return { floors: [], slabs: [], roofs: resolveRoofs(p, levelId) };
}
