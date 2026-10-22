import type { Vec2 } from '@hestia/geom';
import { ceilingOutline } from '@hestia/engine';
import { followsRoom, isCeiling, isFloor, isSlab, type Id } from '@hestia/model';
import type { ToolEnv } from './types.ts';

/** Mensagem da barra de status quando a edição manual solta o contorno (decisão 0023 §8.2b). */
export const OUTLINE_DETACHED_MSG = 'O contorno deixou de acompanhar as paredes (estático). Use Revincular nas propriedades.';

/** Mensagem da barra de status quando a edição de um forro que acompanha o ambiente o solta (decisão 0023 §13, P-5). */
export const CEILING_DETACHED_MSG = 'O forro deixou de acompanhar o ambiente (solto). Use Revincular ao ambiente nas propriedades.';

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

/**
 * Grava um contorno editado de forro (alças e Delete do vértice). Forro que acompanha o ambiente se SOLTA no mesmo passo de
 * desfazer, levando os furos do ambiente como estáticos; forro solto ou desenhado à mão só troca o contorno.
 */
export function commitCeilingBoundary(env: ToolEnv, id: Id, ring: Vec2[]): void {
  const p = env.project();
  const c = p.elements[id];
  if (!isCeiling(c)) return;
  if (!followsRoom(c)) {
    env.exec({ type: 'updateElements', ids: [id], patch: { boundary: ring } });
    return;
  }
  const { holes } = ceilingOutline(p, c);
  env.transaction('Editar contorno', () => {
    env.exec({ type: 'detachCeilingRoom', id });
    env.exec({ type: 'updateElements', ids: [id], patch: { boundary: ring, holes } });
  });
  env.say(CEILING_DETACHED_MSG);
}
