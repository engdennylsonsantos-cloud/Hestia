import type { StrokeOp } from './types.ts';

/**
 * Linhas finas (decisão 0015, só na tela): cada traço da lista sai com 1 px no máximo, sem os pesos por categoria e
 * escala. Troca os objetos no lugar (não muda os traços que o chamador já tem). Feito antes dos realces de seleção e
 * de cursor, que mantêm a largura própria; a plotagem nunca chama esta função.
 */
export function thinStrokes(strokes: StrokeOp[]): void {
  strokes.forEach((s, i) => {
    if (s.papel) {
      // Traço de papel (sempre com 1 px ou mais): sai em 1 px, sem o peso de papel, que o shader aplicaria de novo.
      const fina: StrokeOp = { ...s, widthPx: 1 };
      delete fina.papel;
      strokes[i] = fina;
    } else if (s.widthPx > 1) strokes[i] = { ...s, widthPx: 1 };
  });
}
