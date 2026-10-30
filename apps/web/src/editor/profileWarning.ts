import { areaPlanOf, isFloor, isOpening, isWall, resolveViewProfile, type Id, type Project } from '@hestia/model';

/**
 * Política R1: ao criar um elemento de modelo que o perfil da planta de área oculta, a ferramenta segue funcionando
 * (não bloqueia), mas a barra de status avisa que a vista não o mostra. Devolve a mensagem, ou null.
 */
export function hiddenCreationWarning(before: Project, after: Project, planId: Id): string | null {
  const plan = areaPlanOf(after, planId);
  if (!plan) return null;
  const ly = resolveViewProfile(plan).layers;
  if (ly.walls !== 'hidden' && ly.openings && ly.floors) return null;
  const hidden = new Set<string>();
  for (const [id, e] of Object.entries(after.elements)) {
    if (before.elements[id]) continue;
    if (isWall(e) && ly.walls === 'hidden') hidden.add('paredes');
    else if (isOpening(e) && !ly.openings) hidden.add('aberturas');
    else if (isFloor(e) && !ly.floors) hidden.add('pisos');
  }
  if (!hidden.size) return null;
  return `Criado, mas esta vista oculta ${[...hidden].join(' e ')} (perfil da vista). Ajuste a visibilidade para vê-lo.`;
}
