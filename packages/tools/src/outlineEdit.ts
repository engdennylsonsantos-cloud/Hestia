import type { Vec2 } from '@hestia/geom';
import { isFloor, isSlab, type Id } from '@hestia/model';
import type { ToolEnv } from './types.ts';

/**
 * Grava um contorno editado de piso ou laje. Se o elemento está vinculado às paredes, SOLTA o vínculo (decisão 0023
 * §8.2b) no mesmo passo de desfazer da mudança do contorno — a edição manual vira estática. Elemento sem vínculo (ou
 * telhado) apenas troca o contorno.
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
}
