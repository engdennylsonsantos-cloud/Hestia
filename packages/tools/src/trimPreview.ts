import { frameOfWall, openingExtents, pointAt } from '@hestia/engine';
import { isOpening, type Command, type Id, type Project } from '@hestia/model';
import { hostedLossOfCommands } from './hostedLoss.ts';
import type { PreviewItem } from './types.ts';
import type { Vec2 } from '@hestia/geom';

/** Ajuste de uma extremidade ao canto; em arco, o `sag` é recalculado sobre a mesma circunferência. */
export interface EndPatch {
  a?: Vec2;
  b?: Vec2;
  sag?: number;
}

export interface TrimPatch {
  id: Id;
  patch: EndPatch;
}

/**
 * Comandos do ajuste: pontas e flecha no MESMO comando (`updateElements`), para a compensação de `offset` ver a
 * circunferência final de uma vez e a abertura manter a posição no mundo. Um passo único de desfazer.
 */
export function patchCommands(patches: readonly TrimPatch[]): Command[] {
  return patches.map(({ id, patch }): Command => ({
    type: 'updateElements',
    ids: [id],
    patch: { ...(patch.a ? { a: patch.a } : {}), ...(patch.b ? { b: patch.b } : {}), ...(patch.sag !== undefined ? { sag: patch.sag } : {}) },
  }));
}

/**
 * Prévia do Aparar: o tracejado mostra o eixo que fica em cada parede e, em vermelho, a extensão real das aberturas
 * que sairiam da parede (aviso visual; o diálogo só aparece na confirmação).
 */
export function trimPreviewItems(project: Project, patches: readonly TrimPatch[]): PreviewItem[] {
  const items: PreviewItem[] = [];
  for (const { id, patch } of patches) {
    const frame = frameOfWall(project, id);
    if (!frame || frame.arc) continue;
    items.push({ kind: 'line', a: patch.a ?? frame.a, b: patch.b ?? frame.b, dashed: true });
  }
  for (const loss of hostedLossOfCommands(project, patchCommands(patches))) {
    const opening = project.elements[loss.id];
    const frame = frameOfWall(project, loss.wallId);
    if (!isOpening(opening) || !frame) continue;
    const half = openingExtents(project, opening, frame, 1).frame;
    items.push({
      kind: 'line',
      a: pointAt(frame, opening.offset - half, frame.sMid),
      b: pointAt(frame, opening.offset + half, frame.sMid),
      tone: 'invalid',
    });
  }
  return items;
}
