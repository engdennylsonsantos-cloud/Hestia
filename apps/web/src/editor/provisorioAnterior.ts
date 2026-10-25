import type { Id, Project } from '@hestia/model';
import { nivelDoElemento, type AlteracaoProjeto, type ElementoGeometrico } from '@hestia/engine/src/fluxoPatch.ts';
import { elementoProvisorio } from '@hestia/engine/src/fluxoProvisorio.ts';

/** Contorno que um elemento tinha antes da edição, no nível onde ele estava. */
export interface AnteriorProvisorio {
  nivel: Id;
  elemento: ElementoGeometrico;
}

/**
 * Contornos, no projeto de antes, dos elementos que a edição alterou ou removeu. A tela desenha o provisório sobre o
 * último exato, que ainda traz o elemento na posição antiga: estes contornos dizem o que apagar. Elemento adicionado não
 * tem passado; elemento sem contorno barato (escada, ambiente) fica de fora, e o exato o corrige.
 */
export function contornosAnteriores(antes: Project, alteracao: AlteracaoProjeto): AnteriorProvisorio[] {
  const saida: AnteriorProvisorio[] = [];
  for (const id of [...alteracao.alterados, ...alteracao.removidos]) {
    const e = antes.elements[id];
    const nivel = e ? nivelDoElemento(antes, id) : null;
    if (!e || nivel === null) continue;
    const elemento = elementoProvisorio(antes, e, nivel);
    if (elemento && elemento.geometria.coords.length > 0) saida.push({ nivel, elemento });
  }
  return saida;
}
