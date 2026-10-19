import { useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { profileMax, type Wall } from '@hestia/model';
import { ProfileDialog } from './dialogs/ProfileDialog.tsx';
import { Row } from './fields.tsx';

const CURVED = 'Perfil superior só em parede reta';

/**
 * Linha "Perfil superior" das restrições da parede. Só edita com UMA parede reta selecionada.
 * Montada com `key` pela seleção (Properties), então o diálogo fecha sozinho ao mudar a seleção.
 */
export function ProfileRow({ walls }: { walls: Wall[] }): ReactElement {
  const [open, setOpen] = useState(false);
  const single = walls.length === 1 ? walls[0]! : null;
  const curved = !!single && single.sag !== 0;
  const editable = !!single && !curved;
  const value = !single
    ? 'selecione uma parede'
    : single.topProfile
      ? `Poligonal · máx ${profileMax(single.topProfile).toFixed(2).replace('.', ',')} m`
      : 'Reto';
  return (
    <>
      <Row label="Perfil superior" htmlFor="p-profile">
        <span className="profile-cell">
          <span className="val soft">{value}</span>
          <button id="p-profile" className="btn small" disabled={!editable} onClick={() => setOpen(true)} title={curved ? CURVED : !single ? 'selecione uma parede' : undefined}>
            Editar…
          </button>
        </span>
      </Row>
      {curved && <div className="profile-note">{CURVED}</div>}
      {open && single && createPortal(<ProfileDialog wallId={single.id} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
