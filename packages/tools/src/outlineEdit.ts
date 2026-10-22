import type { Vec2 } from '@hestia/geom';
import { isFloor, isSlab, type Id } from '@hestia/model';
import type { ToolEnv } from './types.ts';

/** Mensagem da barra de status quando a edição manual solta o contorno (decisão 0023 §8.2b). */
export const OUTLINE_DETACHED_MSG = 'O contorno deixou de acompanhar as paredes (estático). Use Revincular nas propriedades.';

/**
 * Grava um contorno editado de piso ou laje. Se o elemento está vinculado às paredes, SOLTA o vínculo (decisão 0023
 * §8.2b) no mesmo passo de desfazer da mudança do contorno — a edição manual vira estática, e a barra de status avisa.
 * Elemento sem vínculo (ou telhado) apenas troca o contorno.
 */
export function commitOutlineBoundary(env: ToolEnv, id: Id, ring: Vec2[]): void {
  const e = env.project().elements[id];
  const linked = (isFloor(e) || isSlab(e)) && e.outlineSource?.linked;
  if (!linked) {
    env.exec({ type: 'updateElements', ids: [id], patch: { boundary: ring } });
    return;
  }
  env.transaction('Editar contorno', () => {
    env.exec({ type: 'detachOutline', id });
    env.exec({ type: 'updateElements', ids: [id], patch: { boundary: ring } });
  });
  env.say(OUTLINE_DETACHED_MSG);
}
