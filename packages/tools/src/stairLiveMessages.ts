import type { StairRemaining } from '@hestia/engine';

/** Texto fixo do estado em que o nível de topo foi alcançado. */
export const TEXTO_ALCANCADO = 'nível de topo alcançado';

/** Número com vírgula decimal e casas fixas. */
const numero = (valor: number, casas: number): string => Math.abs(valor).toFixed(casas).replace('.', ','); // units-ok: mensagens ao vivo da escada/rampa usam a unidade já resolvida

/** Comprimento, 1 casa: `1,4 m`. */
const comprimento = (metros: number): string => `${numero(metros, 1)} m`;

/**
 * Falta de espelhos até o nível de topo (`falta` > 0) e o comprimento equivalente.
 * Ex.: `faltam 5 espelhos (≈ 1,4 m)`; singular `falta 1 espelho (≈ 0,3 m)`.
 */
export function textoFaltaEspelhos(falta: number, faltaLength: number): string {
  const espelhos = falta === 1 ? 'falta 1 espelho' : `faltam ${falta} espelhos`;
  return `${espelhos} (≈ ${comprimento(faltaLength)})`;
}

/**
 * Espelhos a mais no cursor (`excess` > 0): a escada termina antes do cursor.
 * Ex.: `passou 2 espelhos: a escada termina antes do cursor`; singular `passou 1 espelho: ...`.
 */
export function textoPassouEspelhos(excess: number): string {
  return `${excess === 1 ? 'passou 1 espelho' : `passou ${excess} espelhos`}: a escada termina antes do cursor`;
}

/**
 * Rótulo ao vivo da escada livre.
 * Ex.: `16 espelhos · 17,5 cm · piso 28,0 cm · faltam 5 espelhos (≈ 1,4 m)`.
 */
export function rotuloEscadaLivre(risers: number, riserHeight: number, tread: number, estado: string): string {
  return `${risers} espelhos · ${numero(riserHeight * 100, 1)} cm · piso ${numero(tread * 100, 1)} cm · ${estado}`;
}

/** Texto do estado do restante (falta / alcançado / passou). */
export function estadoDoRestante(r: StairRemaining): string {
  if (r.status === 'falta') return textoFaltaEspelhos(r.falta, r.faltaLength);
  if (r.status === 'alcancado') return TEXTO_ALCANCADO;
  return textoPassouEspelhos(r.excess);
}
