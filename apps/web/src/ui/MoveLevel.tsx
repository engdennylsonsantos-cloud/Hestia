import { useState, type ReactElement } from 'react';
import { type LevelKeep } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { LEVEL_KEEP_LABEL, levelBearingIds, moveToLevel, readLevelKeep, writeLevelKeep } from '../editor/levelActions.ts';
import { Dialog } from './dialogs/Dialog.tsx';

/** Diálogo "Mover para o nível" (aba Modificar ▸ Seleção e nível). */
export function MoveLevelDialog({ onClose }: { onClose: () => void }): ReactElement {
  const p = useProject();
  const sel = useUi((s) => s.selection);
  const movable = levelBearingIds(p, sel);
  const [levelId, setLevelId] = useState(() => p.levels.find((l) => l.id === useUi.getState().levelId)?.id ?? p.levels[0]?.id ?? '');
  const [keep, setKeep] = useState<LevelKeep>(readLevelKeep);
  const apply = (): void => {
    if (!levelId || movable.length === 0) return;
    writeLevelKeep(keep);
    const st = useUi.getState();
    useUi.setState({ status: moveToLevel(editor.store, st.selection, levelId, keep, st.levelId).message });
    onClose();
  };
  return (
    <Dialog
      title="Mover para o nível"
      sub={`${movable.length} ${movable.length === 1 ? 'elemento' : 'elementos'}`}
      onClose={onClose}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={apply} disabled={movable.length === 0 || !levelId}>Mover</button>
        </>
      }
    >
      <div className="prow">
        <label htmlFor="move-level-to">Nível</label>
        <select id="move-level-to" className="select" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          {p.levels.map((l) => (
            <option key={l.id} value={l.id}>{`${l.name} · ${l.elevation.toFixed(2).replace('.', ',')} m`}</option>
          ))}
        </select>
      </div>
      <div className="prow">
        <label htmlFor="move-level-keep">Ao trocar</label>
        <select id="move-level-keep" className="select" value={keep} onChange={(e) => setKeep(e.target.value === 'offset' ? 'offset' : 'elevation')}>
          {(Object.keys(LEVEL_KEEP_LABEL) as LevelKeep[]).map((k) => (
            <option key={k} value={k}>{LEVEL_KEEP_LABEL[k]}</option>
          ))}
        </select>
      </div>
      <div className="hint">Os elementos mudam de nível sem trocar a vista. Ctrl+Z desfaz.</div>
    </Dialog>
  );
}
