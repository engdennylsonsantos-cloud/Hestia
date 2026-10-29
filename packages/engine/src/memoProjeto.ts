import type { Project } from '@hestia/model';

/**
 * Memo por projeto para as resoluções caras do motor (escadas e rampas). O projeto é imutável: cada edição produz outro
 * objeto (Immer em `ProjectStore`), então a chave é a referência do objeto `Project`. Um WeakMap solta o memo junto com o
 * projeto antigo, e uma edição (mover/criar/apagar escada, rampa, nível ou tipo) cai em outro objeto, sem memo, e recalcula.
 * Mesma ideia de `memoDoProjeto` da planta (`packages/render/src/plan/resolucao.ts`), mas aqui no motor.
 */
const memo = new WeakMap<Project, Map<string, unknown>>();

/** Valor de `calcula` para o projeto e a chave; a primeira chamada calcula e as seguintes reaproveitam (inclusive `null`). */
export function memoDoProjetoMotor<T>(p: Project, chave: string, calcula: () => T): T {
  let porChave = memo.get(p);
  if (!porChave) {
    porChave = new Map();
    memo.set(p, porChave);
  }
  if (porChave.has(chave)) return porChave.get(chave) as T;
  const valor = calcula();
  porChave.set(chave, valor);
  return valor;
}
