import { CLOSED, projectParts, type OpeningModel, type OpenState, type ProjectedRing } from '@hestia/engine';

/**
 * Projeção das peças para o corte/elevação com as seções do modelo (`OpeningPart.profile`). O motor projeta a caixa
 * envolvente; aqui a peça com seção troca o anel pela seção real:
 *
 * - corte transversal (`axis = 't'`): a travessa (`plane 'sz'`) é o próprio L em (s, z), com 6 vértices; a ombreira
 *   (`plane 'ts'`, extrudada em z) aparece como retângulo, a projeção do L ao longo de t;
 * - elevação (`axis = 's'`): as duas seções aparecem como o retângulo envolvente (projeção ao longo de s).
 *
 * Sem `profile`, o anel é o de `projectParts`, sem mudança.
 */
export function projetarComPerfis(m: OpeningModel, axis: 's' | 't', state: OpenState = CLOSED): ProjectedRing[] {
  return projectParts(m, axis, state).map((item) => {
    const profile = item.part.profile;
    if (!profile || axis !== 't' || profile.plane !== 'sz') return item;
    return { ...item, ring: profile.pts.map(([s, z]) => ({ u: s, z })) };
  });
}
