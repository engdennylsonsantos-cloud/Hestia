/**
 * Máquina pura do `down` adiado (D1). Depois de `editor.load()`/`newProject()` o mapa de viewports é limpo e só volta a
 * existir no quadro de render seguinte; o `onDown` do ViewportCanvas adia a entrega em vez de descartar o clique.
 * A máquina garante um único `down` por gesto e, se o `up` chegar antes da vista, uma sequência ordenada
 * `down → (drag) → up → click` — nunca um click solto.
 */

/** Limite de quadros à espera da vista (~0,5 s a 60 Hz): passou disso, o gesto é abandonado em silêncio. */
export const MAX_TENTATIVAS_VISTA = 30;

export interface EstadoCliqueAdiado {
  /** `armado`: o `down` ainda não chegou à ferramenta; `entregue`: já chegou; `desistiu`: a vista não apareceu no limite. */
  fase: 'armado' | 'entregue' | 'desistiu';
  /** Quadros de espera já gastos (ver `MAX_TENTATIVAS_VISTA`). */
  tentativas: number;
  /** O `up` chegou antes de a vista existir: a entrega fecha a sequência inteira. */
  soltou: boolean;
}

export type EventoCliqueAdiado =
  | { tipo: 'quadro'; vistaPronta: boolean }
  | { tipo: 'soltar' }
  | { tipo: 'cancelar' };

export type AcaoCliqueAdiado = 'nenhuma' | 'entregar-down' | 'entregar-solto' | 'abandonar';

export function cliqueAdiadoInicial(): EstadoCliqueAdiado {
  return { fase: 'armado', tentativas: 0, soltou: false };
}

/**
 * Decide o passo do `down` adiado. Devolve sempre um estado novo e nunca reabre um gesto já resolvido: `entregar-*`
 * acontece no máximo uma vez por gesto (eventos repetidos depois disso viram `nenhuma`).
 */
export function decidirCliqueAdiado(estado: EstadoCliqueAdiado, evento: EventoCliqueAdiado): { estado: EstadoCliqueAdiado; acao: AcaoCliqueAdiado } {
  if (estado.fase !== 'armado') return { estado, acao: 'nenhuma' };
  if (evento.tipo === 'soltar') return { estado: { ...estado, soltou: true }, acao: 'nenhuma' };
  if (evento.tipo === 'cancelar') return { estado: { ...estado, fase: 'desistiu' }, acao: 'abandonar' };
  if (evento.vistaPronta) return { estado: { ...estado, fase: 'entregue' }, acao: estado.soltou ? 'entregar-solto' : 'entregar-down' };
  const tentativas = estado.tentativas + 1;
  // Sem vista no limite: abandona sem down/up/click, para não criar geometria que o usuário não viu.
  if (tentativas >= MAX_TENTATIVAS_VISTA) return { estado: { ...estado, fase: 'desistiu', tentativas }, acao: 'abandonar' };
  return { estado: { ...estado, tentativas }, acao: 'nenhuma' };
}
