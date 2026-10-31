/**
 * Tolerância ao tremor do ponteiro (px): até este deslocamento o gesto ainda é clique. Era 3 px e um tremor de 4 px
 * perdia o clique (medido: 0/30 entregues); 6 px cobre mouse ruim e toque sem transformar arrasto em clique.
 */
export const LIMIAR_ARRASTO_PX = 6;

/** Clique × arrasto pelo deslocamento desde o `down`; o limite é inclusivo (6 px ainda é clique). */
export function decidirArrasto(deslocamentoPx: number): 'click' | 'drag' {
  return deslocamentoPx > LIMIAR_ARRASTO_PX ? 'drag' : 'click';
}

/** Atalho booleano usado no estado `moved` do gesto. */
export function passouDoLimiar(deslocamentoPx: number): boolean {
  return decidirArrasto(deslocamentoPx) === 'drag';
}

/**
 * Eventos que a solta envia à ferramenta: `up` sempre, `click` só sem arrasto. `arrastou` é o `moved` acumulado
 * (uma vez arrastado, o gesto não volta a ser clique nem que o ponteiro retorne ao ponto de partida).
 */
export function eventosDeSolta(arrastou: boolean): ReadonlyArray<'up' | 'click'> {
  return arrastou ? ['up'] : ['up', 'click'];
}

/** Condições do gesto com Shift na planta: desenho travado (ferramenta de desenho) ou arrasto da vista (pan). */
export interface GestosDaPlanta {
  shiftDesenho: boolean;
  shiftPan: boolean;
}

/**
 * Decide o papel do Shift no botão esquerdo da planta/corte, antes de qualquer chamada à ferramenta. Na Selecionar —
 * inclusive no Selecionar do esboço do perímetro (`selecionandoNoEsboco`) — o Shift é da seleção (soma e caixa), então
 * o gesto vai para a ferramenta. Numa ferramenta de desenho, o Shift trava ortogonal e só vira pan se o ponteiro se
 * mover (essa parte fica no ViewportCanvas); no corte ele arrasta a vista, como antes.
 */
export function gestosComShift(input: {
  view: string;
  botao: number;
  shift: boolean;
  espaco: boolean;
  ferramenta: string;
  selecionandoNoEsboco: boolean;
}): GestosDaPlanta {
  const selecionando = input.ferramenta === 'select' || input.selecionandoNoEsboco;
  const shiftDesenho = input.view === 'plan' && input.botao === 0 && input.shift && !input.espaco && !selecionando;
  const shiftPan = input.view !== '3d' && input.shift && !selecionando && !shiftDesenho;
  return { shiftDesenho, shiftPan };
}
