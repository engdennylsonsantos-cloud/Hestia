import type { ReactElement } from 'react';
import { pedidoHostedLoss, responderHostedLoss } from '../../editor/hostedLossPrompt.ts';
import { Dialog } from './Dialog.tsx';

/**
 * Confirmação única das operações que deixariam aberturas fora da parede (Aparar, alças, cotas, Mover/Copiar).
 * Confirmar aplica a mudança e exclui as aberturas num só passo de desfazer; Cancelar não muda nada.
 */
export function HostedLossDialog(): ReactElement | null {
  const pedido = pedidoHostedLoss();
  if (!pedido) return null;
  return (
    <Dialog
      title="Aberturas fora da parede"
      size="narrow"
      onClose={() => responderHostedLoss(false)}
      footer={
        <>
          <button className="btn" onClick={() => responderHostedLoss(false)}>Cancelar</button>
          <button className="btn primary" autoFocus onClick={() => responderHostedLoss(true)}>Excluir elementos e continuar</button>
        </>
      }
    >
      <p role="alert">{pedido.message}</p>
    </Dialog>
  );
}
