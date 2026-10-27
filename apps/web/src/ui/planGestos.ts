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
