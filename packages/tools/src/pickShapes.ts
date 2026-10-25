import { resolveFloors, resolveSlabs } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import type { MultiPolygon } from '@hestia/geom';

/**
 * Contorno resolvido de cada piso (ou laje) de um nível, por id, para a seleção na planta. O cursor se move a cada
 * quadro e a seleção chama o pick de piso e de laje em cada movimento: sem cache, cada chamada resolveria o nível de
 * novo. Guarda-se por projeto e nível (o projeto é imutável: cada edição cria outro objeto), com teto de `LIMITE`
 * níveis por projeto (o mais antigo sai).
 */

const LIMITE = 8;
const memo = new WeakMap<Project, Map<string, Map<Id, MultiPolygon>>>();

/** Contornos dos pisos (`piso`) ou das lajes (`laje`) do nível, por id. Mesma conta de `resolveFloors`/`resolveSlabs`. */
export function formasDoNivel(p: Project, levelId: Id, tipo: 'piso' | 'laje'): Map<Id, MultiPolygon> {
  let porNivel = memo.get(p);
  if (!porNivel) {
    porNivel = new Map();
    memo.set(p, porNivel);
  }
  const chave = `${tipo}|${levelId}`;
  const hit = porNivel.get(chave);
  if (hit) return hit;
  const mapa =
    tipo === 'piso'
      ? new Map(resolveFloors(p, levelId).map((r) => [r.floorId, r.polygon] as const))
      : new Map(resolveSlabs(p, levelId).map((r) => [r.slabId, r.polygon] as const));
  if (porNivel.size >= LIMITE) porNivel.delete(porNivel.keys().next().value as string);
  porNivel.set(chave, mapa);
  return mapa;
}
