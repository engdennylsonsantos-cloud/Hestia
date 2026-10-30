import type { ReactElement } from 'react';
import { pedidoAreaMerge, responderAreaMerge } from '../../editor/areaMergePrompt.ts';
import { Dialog } from './Dialog.tsx';

/** Confirmação da regra de áreas: a maior fica, as menores são apagadas e a parede/separador é removido. */
export function AreaMergeDialog(): ReactElement | null {
  const pedido = pedidoAreaMerge();
  if (!pedido) return null;
  return (
    <Dialog
      title="Fusão de áreas"
      size="narrow"
      onClose={() => responderAreaMerge(false)}
      footer={
        <>
          <button className="btn" onClick={() => responderAreaMerge(false)}>Cancelar</button>
          <button className="btn primary" autoFocus onClick={() => responderAreaMerge(true)}>Confirmar e excluir menores</button>
        </>
      }
    >
      <p role="alert" style={{ whiteSpace: 'pre-line' }}>{pedido.message}</p>
    </Dialog>
  );
}
