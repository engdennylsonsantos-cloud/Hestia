import type { Id, Project } from '@hestia/model';

/**
 * Chave de conteúdo por nível da vista 3D. A malha de um nível fica válida enquanto a chave dele não muda. A chave junta:
 *   - a marca da vista (tema, arestas, sombras), que muda a cor e o tipo dos materiais e das arestas;
 *   - o resto do projeto (tipos, materiais, cotas, vista 3D, gráficos), que vale para todos os níveis;
 *   - o conteúdo do próprio nível e o dos vizinhos imediatos por cota (o de cima e o de baixo). Os vizinhos entram porque o
 *     corte e a junção de paredes, e a chegada de escada à laje de cima, dependem deles.
 * Elemento sem nível (que não é nem da própria camada de nível nem esquadria de parede de nível) entra no bloco global:
 * mudar um deles refaz tudo (conservador). Assim a dependência não precisa ser provada elemento a elemento.
 */

/** Hash de 53 bits (cyrb53) de um texto: chave curta e estável. A colisão é desprezível para comparar conteúdos de nível. */
export function hashTexto(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Nível de um elemento: o próprio `levelId`, ou, na esquadria, o da parede que a hospeda. Sem nível: null. */
function nivelDoElemento(elementos: Project['elements'], e: object): Id | null {
  const campos = e as { levelId?: unknown; hostId?: unknown };
  if (typeof campos.levelId === 'string') return campos.levelId;
  if (typeof campos.hostId === 'string') {
    const host = elementos[campos.hostId] as { levelId?: unknown } | undefined;
    if (typeof host?.levelId === 'string') return host.levelId;
  }
  return null;
}

/** Assinaturas do projeto: o bloco global, o conteúdo de cada nível e a ordem dos níveis por cota. */
export interface AssinaturasProjeto {
  global: string;
  nivel: Map<Id, string>;
  /** Ids dos níveis do mais baixo ao mais alto (cota; empate pela ordem do projeto). */
  ordem: Id[];
}

/** Assinaturas do projeto para as chaves dos níveis (uma passada sobre os elementos). */
export function assinaturasDoProjeto(p: Project): AssinaturasProjeto {
  const { elements, ...resto } = p;
  const porNivel = new Map<Id, string[]>();
  const globais: string[] = [];
  for (const id of Object.keys(elements)) {
    const e = elements[id]!;
    const linha = `${id}:${JSON.stringify(e)}`;
    const nivel = nivelDoElemento(elements, e);
    if (nivel === null) globais.push(linha);
    else {
      const lista = porNivel.get(nivel);
      if (lista) lista.push(linha);
      else porNivel.set(nivel, [linha]);
    }
  }
  const nivel = new Map<Id, string>();
  for (const l of p.levels) nivel.set(l.id, hashTexto((porNivel.get(l.id) ?? []).join('\n')));
  const ordem = p.levels
    .map((l, i) => ({ id: l.id, cota: l.elevation, i }))
    .sort((a, b) => a.cota - b.cota || a.i - b.i)
    .map((l) => l.id);
  return { global: hashTexto(`${JSON.stringify(resto)}\u0002${globais.join('\n')}`), nivel, ordem };
}

/**
 * Chave de cada nível do projeto. `marca` é a marca da vista (tema, arestas, sombras): entra em todas as chaves.
 * Duas chaves iguais garantem a mesma malha; uma chave diferente refaz o nível.
 */
export function chavesDeNivel(p: Project, marca: string): Map<Id, string> {
  const a = assinaturasDoProjeto(p);
  const out = new Map<Id, string>();
  a.ordem.forEach((id, i) => {
    const abaixo = i > 0 ? a.nivel.get(a.ordem[i - 1]!)! : '-';
    const acima = i < a.ordem.length - 1 ? a.nivel.get(a.ordem[i + 1]!)! : '-';
    out.set(id, hashTexto([marca, a.global, abaixo, a.nivel.get(id)!, acima].join('|')));
  });
  return out;
}
