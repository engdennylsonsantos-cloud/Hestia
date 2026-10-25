import { dist, type Vec2 } from '@hestia/geom';
import { isWall, type Id, type Project } from '@hestia/model';

/** Aviso quando o canto já está feito: o aparar não grava nada (sem passo de desfazer vazio). */
export const NADA_A_APARAR = 'Nada a aparar: as paredes já se encontram.';

/** Algum ajuste de canto muda a parede (comparado com o projeto atual). Sem mudança, o aparar não grava nada. */
export function algumMudou(pr: Project, patches: Array<{ id: Id; patch: { a?: Vec2; b?: Vec2; sag?: number } }>): boolean {
  const mudou = (novo: Vec2 | undefined, atual: Vec2): boolean => !!novo && dist(novo, atual) > 1e-9;
  return patches.some(({ id, patch }) => {
    const w = pr.elements[id];
    if (!isWall(w)) return false;
    return mudou(patch.a, w.a) || mudou(patch.b, w.b) || (patch.sag !== undefined && Math.abs(patch.sag - (w.sag ?? 0)) > 1e-9);
  });
}
