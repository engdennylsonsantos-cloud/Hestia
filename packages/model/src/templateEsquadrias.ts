import type { Command } from './commands.ts';
import { DEFAULT_OPENING_TYPES } from './defaults.ts';
import { openingSpanOf } from './openingNominal.ts';
import type { Opening } from './types.ts';
import { makeWall } from './wall.ts';

/**
 * Mostruário de esquadrias — projeto de conferência visual do catálogo completo.
 *
 * Planta com **um nível**: a parede de baixo (y = 0) recebe todas as portas e a parede paralela acima (y = 8) recebe
 * todas as janelas, na ordem de `DEFAULT_OPENING_TYPES`. Cada vão fica com 1,5 m de folga para os vizinhos e para as
 * pontas da parede. As duas paredes têm o mesmo comprimento: o da categoria mais larga (no mínimo 40 m), porque o
 * catálogo completo não cabe em 40 m. A metade variada usa `flipHand` nos índices ímpares e `flipFacing` nos índices 2
 * e 3 de cada grupo de quatro, de modo que as quatro combinações aparecem em sequência sem depender da ordem das categorias.
 */
const COMPRIMENTO_MINIMO = 40;
const FOLGA = 1.5;
const Y_JANELAS = 8;
const H = 2.8;

/** Medidas do vão para as folgas; o tipo em si vem do catálogo (as dimensões são as dele). */
const tipos = DEFAULT_OPENING_TYPES;

/** Comprimento que uma categoria precisa: a soma das larguras com 1,5 m entre vizinhos e nas pontas. */
const comprimentoDe = (kind: 'door' | 'window'): number => tipos.filter((t) => t.kind === kind).reduce((soma, t) => soma + openingSpanOf(t).width + FOLGA, FOLGA);
const COMPRIMENTO = Math.max(COMPRIMENTO_MINIMO, comprimentoDe('door'), comprimentoDe('window'));

function parede(id: string, y: number): ReturnType<typeof makeWall> {
  return makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y }, b: { x: COMPRIMENTO, y }, height: H });
}

/** Vãos de uma categoria lado a lado, com 1,5 m entre eles e nas pontas da parede. */
function vãos(hostId: string, kind: 'door' | 'window', prefixo: string): Opening[] {
  const lista = tipos.filter((t) => t.kind === kind);
  let cursor = FOLGA;
  return lista.map((t, i) => {
    const offset = cursor + openingSpanOf(t).width / 2;
    cursor += openingSpanOf(t).width + FOLGA;
    return {
      id: `${prefixo}_${t.id}`,
      kind,
      typeId: t.id,
      hostId,
      offset,
      // Metade variada: flipHand nos ímpares e flipFacing no 3º e 4º de cada grupo de quatro.
      flipHand: i % 2 === 1,
      flipFacing: i % 4 >= 2,
      sillOverride: null,
      mark: t.code ?? '',
    };
  });
}

export function esquadrias(cmds: Command[]): void {
  // Um nível: o mostruário é uma planta única.
  cmds.push({ type: 'deleteLevel', id: 'lv_1' });
  // Etiquetas de código ligadas: no mostruário o código é o jeito de saber qual tipo está em cada vão.
  cmds.push({ type: 'setSettings', patch: { showOpeningTags: true } });
  const portas = parede('eq_w_portas', 0);
  const janelas = parede('eq_w_janelas', Y_JANELAS);
  cmds.push({ type: 'addWall', wall: portas }, { type: 'addWall', wall: janelas });
  for (const o of vãos('eq_w_portas', 'door', 'eq_o')) cmds.push({ type: 'addOpening', opening: o });
  for (const o of vãos('eq_w_janelas', 'window', 'eq_o')) cmds.push({ type: 'addOpening', opening: o });
}
