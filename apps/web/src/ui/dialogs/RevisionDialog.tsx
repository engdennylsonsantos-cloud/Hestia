import { useState, type ReactElement } from 'react';
import { sheetOf } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { emitRevisionCommand, nextRevisionTag } from '../../editor/sheetNumbering.ts';
import { useUi } from '../../editor/state.ts';
import { Row, TextField } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';

/**
 * Emite revisão numa prancha (Revit: *Sheet Issues/Revisions*, ArchiCAD: *Revision History*): a tag é a próxima da
 * prancha, a data já vem de hoje e a revisão entra no histórico e no carimbo num único passo de desfazer.
 */
export function RevisionDialog({ sheetId }: { sheetId: string }): ReactElement | null {
  const p = useProject();
  const s = sheetOf(p, sheetId);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('pt-BR'));
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(s?.titleBlock.author ?? '');
  const [err, setErr] = useState('');
  if (!s) return null;
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
  const tag = nextRevisionTag(s.revisions);
  const emit = (): void => {
    const descricao = description.trim();
    if (!descricao) return setErr('Descreva a revisão.');
    const cmd = emitRevisionCommand(p, [s.id], {
      date: date.trim(),
      description: descricao,
      ...(author.trim() ? { by: author.trim() } : {}),
      tag,
    });
    if (!cmd) return setErr('Prancha inexistente.');
    try {
      editor.store.exec(cmd, 'Emitir revisão');
      useUi.setState({ status: `Revisão ${tag} emitida na prancha ${s.number}.` });
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Revisão recusada.');
    }
  };
  return (
    <Dialog
      title="Emitir revisão"
      sub={`${s.number} · ${s.name}`}
      onClose={close}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={emit}>Emitir revisão</button>
        </>
      }
    >
      <Row label="Tag" readOnly>
        <span className="val">{tag}</span>
      </Row>
      <Row label="Data" htmlFor="rev-date">
        <TextField id="rev-date" value={date} onCommit={setDate} />
      </Row>
      <Row label="Descrição" htmlFor="rev-desc">
        <TextField id="rev-desc" value={description} placeholder="O que mudou nesta revisão" onCommit={setDescription} />
      </Row>
      <Row label="Autor" htmlFor="rev-by">
        <TextField id="rev-by" value={author} placeholder="Em branco: sem autor" onCommit={setAuthor} />
      </Row>
      <p className="hint">A revisão entra no histórico da prancha e a tag vai para o carimbo. Ctrl+Z desfaz.</p>
      {err ? <p className="error" role="alert">{err}</p> : null}
    </Dialog>
  );
}
