import { useState, type ReactElement } from 'react';
import { projectSheets } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { formatSheetNumber, numberPrefix, numberSequence, renumberCommand } from '../../editor/sheetNumbering.ts';
import { useUi } from '../../editor/state.ts';
import { NumField, Row, TextField } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';

/**
 * Numeração em lote das pranchas (Revit: *Sheet Issues/Revisions*): prefixo, início, passo e casas. A prévia mostra o
 * primeiro e o último número antes de gravar; as pranchas entram na ordem do navegador.
 */
export function RenumberSheetsDialog(): ReactElement {
  const p = useProject();
  const sheets = projectSheets(p);
  const first = sheets[0];
  const [prefix, setPrefix] = useState(first ? numberPrefix(first.number) : 'A');
  const [start, setStart] = useState((first && numberSequence(first.number)) ?? 101);
  const [step, setStep] = useState(1);
  const [padding, setPadding] = useState(3);
  const [err, setErr] = useState('');
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
  const ids = sheets.map((s) => s.id);
  const preview = (i: number): string => formatSheetNumber(prefix.trim(), start + i * step, padding);
  const ultimo = sheets.length - 1;
  const apply = (): void => {
    const cmd = renumberCommand(p, ids, { prefix: prefix.trim(), start, step, padding });
    if (!cmd) return setErr('Nenhuma prancha para renumerar.');
    try {
      editor.store.exec(cmd, 'Renumerar pranchas');
      useUi.setState({ status: `${sheets.length} prancha(s) renumerada(s): ${preview(0)} a ${preview(ultimo)}.` });
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Numeração recusada.');
    }
  };
  return (
    <Dialog
      title="Renumerar pranchas"
      sub="Numeração em lote, na ordem do navegador"
      onClose={close}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={apply} disabled={sheets.length === 0}>Renumerar</button>
        </>
      }
    >
      <Row label="Prefixo" htmlFor="rn-prefix">
        <TextField id="rn-prefix" value={prefix} placeholder="A" onCommit={setPrefix} />
      </Row>
      <Row label="Início" htmlFor="rn-start">
        <NumField id="rn-start" value={start} decimals={0} min={0} onCommit={setStart} />
      </Row>
      <Row label="Passo" htmlFor="rn-step">
        <NumField id="rn-step" value={step} decimals={0} min={1} onCommit={setStep} />
      </Row>
      <Row label="Casas" htmlFor="rn-padding">
        <NumField id="rn-padding" value={padding} decimals={0} min={0} max={10} onCommit={setPadding} />
      </Row>
      <Row label="Prévia" readOnly>
        <span className="val" id="rn-preview">
          {sheets.length === 0 ? 'Nenhuma prancha' : `${preview(0)} … ${preview(ultimo)}`}
        </span>
      </Row>
      <p className="hint">Enter ou sair do campo atualiza a prévia. Renumerar preserva a ordem das pranchas e entra como um único passo de desfazer (Ctrl+Z).</p>
      {err ? <p className="error" role="alert">{err}</p> : null}
    </Dialog>
  );
}
