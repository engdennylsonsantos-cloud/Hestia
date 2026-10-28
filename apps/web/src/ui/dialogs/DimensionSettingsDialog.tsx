import { useState, type ReactElement } from 'react';
import type { OpeningDimRef, WallDimRef } from '@hestia/model';
import { editor } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { Dialog } from './Dialog.tsx';
import { OPENING_OPTIONS, WALL_OPTIONS, applyDraft, defaultDraft, draftFromProject, type DimensionDraft } from './dimensionSettingsModel.ts';

const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

/** "Cotas…" em Padrões do projeto: referências das cotas dinâmicas e quando elas aparecem. */
export function DimensionSettingsDialog(): ReactElement {
  const [draft, setDraft] = useState<DimensionDraft>(() => draftFromProject(editor.project));
  const confirmar = (): void => {
    editor.store.exec({ type: 'setSettings', patch: { dimensions: applyDraft(draft) } });
    close();
  };
  return (
    <Dialog
      title="Cotas do projeto"
      sub="Referências das cotas dinâmicas que aparecem ao colocar e ao selecionar"
      size="mid"
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={() => setDraft(defaultDraft())}>Restaurar padrões</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={confirmar}>OK</button>
        </>
      }
    >
      <div className="prow">
        <label htmlFor="dim-wall">Referência de paredes</label>
        <div>
          <select id="dim-wall" className="select" autoFocus value={draft.wallRef} onChange={(e) => setDraft({ ...draft, wallRef: e.target.value as WallDimRef })}>
            {WALL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="prow">
        <label htmlFor="dim-opening">Referência de portas e janelas</label>
        <div>
          <select id="dim-opening" className="select" value={draft.openingRef} onChange={(e) => setDraft({ ...draft, openingRef: e.target.value as OpeningDimRef })}>
            {OPENING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="prow">
        <label htmlFor="dim-place">Mostrar ao colocar</label>
        <input id="dim-place" type="checkbox" checked={draft.showOnPlacement} onChange={(e) => setDraft({ ...draft, showOnPlacement: e.target.checked })} />
      </div>
      <div className="prow">
        <label htmlFor="dim-select">Mostrar ao selecionar</label>
        <input id="dim-select" type="checkbox" checked={draft.showOnSelection} onChange={(e) => setDraft({ ...draft, showOnSelection: e.target.checked })} />
      </div>
    </Dialog>
  );
}
