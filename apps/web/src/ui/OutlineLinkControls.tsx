import { useState, type ReactElement } from 'react';
import { outlineElementsOfLevel, suggestOutlineBatch, type OutlineBatch } from '@hestia/engine';
import type { Id } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { linkAllOutlines, linkOutcomeText, linkOutlinesToWalls, linkPreviewText, NO_CIRCUIT_TEXT, previewLinkOutlines } from '../editor/outlineLink.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';
import { Dialog } from './dialogs/Dialog.tsx';

/** Prévia com Confirmar / Cancelar antes de gravar o vínculo (decisão 0023 §8.2b). */
function LinkPreviewDialog({ title, sub, batch, onCancel, onConfirm }: { title: string; sub?: string; batch: OutlineBatch; onCancel: () => void; onConfirm: () => void }): ReactElement {
  return (
    <Dialog
      title={title}
      sub={sub}
      onClose={onCancel}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn primary" onClick={onConfirm}>Confirmar</button>
        </>
      }
    >
      <div className="hint" id="link-outline-preview">{linkPreviewText(batch)}</div>
    </Dialog>
  );
}

/** Botão "Vincular às paredes" do grupo Contorno: piso ou laje sem origem (croqui ou modelo pronto). */
export function LinkOutlineButton({ ids }: { ids: Id[] }): ReactElement {
  const [preview, setPreview] = useState<OutlineBatch | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const start = (): void => {
    const batch = previewLinkOutlines(editor.store.project, ids);
    setPreview(batch.vinculaveis.length > 0 ? batch : null);
    setReason(batch.vinculaveis.length > 0 ? null : NO_CIRCUIT_TEXT);
  };
  const confirm = (): void => {
    const o = linkOutlinesToWalls(editor.store, ids);
    useUi.setState({ status: linkOutcomeText(o) });
    setPreview(null);
  };
  return (
    <>
      <div className="row">
        <button className="btn small" disabled={ids.length === 0} onClick={start}>Vincular às paredes</button>
      </div>
      {reason && <div className="hint" id="p-outline-reason">{reason}</div>}
      {preview && <LinkPreviewDialog title="Vincular às paredes" batch={preview} onCancel={() => setPreview(null)} onConfirm={confirm} />}
    </>
  );
}

/** Botão "Vincular pisos e lajes" da faixa Modificar: aplica o lote ao nível ativo, com a mesma prévia agregada. */
export function LinkLevelButton(): ReactElement {
  const levelId = useUi((s) => s.levelId);
  const [preview, setPreview] = useState<OutlineBatch | null>(null);
  const start = (): void => {
    const batch = suggestOutlineBatch(editor.store.project, outlineElementsOfLevel(editor.store.project, levelId));
    if (batch.vinculaveis.length === 0) {
      useUi.setState({ status: batch.semCorrespondencia.length === 0 ? 'Não há pisos ou lajes estáticos neste nível.' : NO_CIRCUIT_TEXT });
      return;
    }
    setPreview(batch);
  };
  const confirm = (): void => {
    const o = linkAllOutlines(editor.store, levelId);
    useUi.setState({ status: linkOutcomeText(o) });
    setPreview(null);
  };
  const levelName = editor.store.project.levels.find((l) => l.id === levelId)?.name ?? levelId;
  return (
    <>
      <button className="tbtn" onClick={start} title="Vincular pisos e lajes do nível às paredes">
        <Icon name="room" size={22} />
        <span>Vincular pisos e lajes</span>
      </button>
      {preview && <LinkPreviewDialog title="Vincular pisos e lajes às paredes" sub={levelName} batch={preview} onCancel={() => setPreview(null)} onConfirm={confirm} />}
    </>
  );
}
