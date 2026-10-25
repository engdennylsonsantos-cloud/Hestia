import { useRef, useState, type ReactElement } from 'react';
import type { SectionView } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { activateView } from '../editor/viewTabActions.ts';
import { Icon } from './Icon.tsx';

/** Corte ou elevação no navegador: duplo clique abre; abrir, renomear e excluir ficam ao lado. */
export function ViewRow({ view }: { view: SectionView }): ReactElement {
  const active = useUi((s) => s.view === 'section' && s.sectionId === view.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(view.name);
  // Enter, Esc e a perda de foco podem disparar em sequência; só o primeiro encerra a edição.
  const editingRef = useRef(false);

  const start = (): void => {
    editingRef.current = true;
    setDraft(view.name);
    setEditing(true);
  };
  const finish = (save: boolean): void => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    if (save && draft.trim() !== view.name) editor.renameView(view.id, draft);
  };

  const icon = view.kind === 'section' ? 'section' : 'elevation';
  if (editing) {
    return (
      <div className="type-row">
        <input
          className="input view-rename"
          aria-label={`Novo nome de ${view.name}`}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') finish(true);
            else if (e.key === 'Escape') finish(false);
          }}
          onBlur={() => finish(true)}
        />
      </div>
    );
  }
  return (
    <div className="type-row">
      <button className={`leaf${active ? ' on' : ''}`} title="Duplo clique abre a vista" onDoubleClick={() => activateView({ kind: 'section', viewId: view.id })}>
        <Icon name={icon} size={14} /> {view.name}
      </button>
      <div className="type-actions" role="group" aria-label={`Ações de ${view.name}`}>
        <button type="button" className="ibtn type-act" title="Abrir" aria-label={`Abrir ${view.name}`} onClick={() => activateView({ kind: 'section', viewId: view.id })}>
          <Icon name="chevron" size={13} />
        </button>
        <button type="button" className="ibtn type-act" title="Renomear" aria-label={`Renomear ${view.name}`} onClick={start}>
          <Icon name="edit" size={13} />
        </button>
        <button type="button" className="ibtn type-act danger" title="Excluir vista" aria-label={`Excluir ${view.name}`} onClick={() => editor.deleteView(view.id)}>
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
}
