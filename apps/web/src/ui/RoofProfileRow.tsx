import { useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { formatQuantity, type Roof } from '@hestia/model';
import { RoofProfileDialog } from './dialogs/RoofProfileDialog.tsx';
import { Row } from './fields.tsx';
import { useUnits } from './useUnits.ts';

/**
 * Linha "Perfil" das Propriedades de um telhado por extrusão: resumo (trechos e altura máxima) e o botão que abre o
 * diálogo do perfil. Montada com `key` pelo telhado selecionado, então o diálogo fecha ao mudar a seleção.
 */
export function RoofProfileRow({ roof }: { roof: Roof }): ReactElement {
  const units = useUnits();
  const [open, setOpen] = useState(false);
  const segments = Math.max(0, roof.profile.length - 1);
  const value = roof.profile.length >= 2 ? `${segments} trechos · altura máx. ${formatQuantity(units, 'length', Math.max(...roof.profile.map((q) => q.z)))}` : 'sem perfil';
  return (
    <>
      <Row label="Perfil" htmlFor="p-rprofile">
        <span className="profile-cell">
          <span className="val soft">{value}</span>
          <button id="p-rprofile" className="btn small" onClick={() => setOpen(true)}>
            Perfil…
          </button>
        </span>
      </Row>
      {open && createPortal(<RoofProfileDialog roofId={roof.id} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
