import { useMemo, useState, type ReactElement } from 'react';
import { projectSheets, sheetDimsMm, sheetOf, type Id } from '@hestia/model';
import { buildSheetDrawList } from '@hestia/render';
import { exportSheetsPdf } from '@hestia/io';
import { editor, useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { savePdf } from '../../editor/savePdf.ts';
import { Dialog } from './Dialog.tsx';
import { TextField } from '../fields.tsx';

/**
 * Publicação das pranchas (Revit: *Print/Export PDF* em lote; ArchiCAD: *Publisher*): escolhe as pranchas, a ordem, se
 * sai um arquivo só ou um por prancha e o nome base. O PDF é o mesmo `exportSheetsPdf` da exportação rápida.
 */
export function PublishDialog(): ReactElement {
  const p = useProject();
  const sheets = useMemo(() => projectSheets(p), [p]);
  const [order, setOrder] = useState<Id[]>(() => sheets.map((s) => s.id));
  const [picked, setPicked] = useState<Set<Id>>(() => new Set(sheets.map((s) => s.id)));
  const [oneFile, setOneFile] = useState(true);
  const [base, setBase] = useState(p.name || 'projeto');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

  // Mantém a ordem com as pranchas atuais (o diálogo pode abrir com a lista já preenchida).
  const ordered = useMemo(() => {
    const known = new Set(sheets.map((s) => s.id));
    const kept = order.filter((id) => known.has(id));
    return [...kept, ...sheets.map((s) => s.id).filter((id) => !kept.includes(id))];
  }, [order, sheets]);

  const move = (id: Id, delta: -1 | 1): void => {
    const i = ordered.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    const next = [...ordered];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };
  const toggle = (id: Id): void =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selected = ordered.filter((id) => picked.has(id));
  const publish = async (): Promise<void> => {
    if (selected.length === 0) {
      setErr('Marque ao menos uma prancha para publicar.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const lists = selected.map((id) => buildSheetDrawList(p, id)).filter((l): l is NonNullable<typeof l> => l !== null);
      if (lists.length === 0) throw new Error('Nenhuma prancha válida para publicar.');
      const safe = (base.trim() || 'projeto').replace(/[\\/:*?"<>|]+/g, '-');
      if (oneFile) {
        const msg = await savePdf(`${safe}-pranchas.pdf`, exportSheetsPdf(lists, p.name));
        useUi.setState({ status: msg });
      } else {
        for (let i = 0; i < lists.length; i++) {
          const sheet = sheetOf(p, selected[i]!);
          const name = `${safe}-${sheet ? `${sheet.number}-${sheet.name}` : String(i + 1)}`.replace(/[\\/:*?"<>|]+/g, '-');
          await savePdf(`${name}.pdf`, exportSheetsPdf([lists[i]!], p.name));
        }
        useUi.setState({ status: `${lists.length} arquivo(s) publicado(s).` });
      }
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível publicar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Publicar pranchas"
      sub="PDF em lote, na ordem escolhida"
      onClose={close}
      size="mid"
      footer={
        <>
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" disabled={busy || selected.length === 0} onClick={() => void publish()}>
            {busy ? 'Publicando…' : oneFile ? 'Publicar PDF' : `Publicar ${selected.length} PDF`}
          </button>
        </>
      }
    >
      <label className="pub-row">
        <span>Nome base</span>
        <TextField id="pub-base" value={base} onCommit={setBase} />
      </label>
      <label className="pub-row">
        <input type="checkbox" checked={oneFile} onChange={(e) => setOneFile(e.target.checked)} />
        <span>Um arquivo com todas as pranchas (desmarque para um PDF por prancha)</span>
      </label>
      <div className="pub-list" role="list">
        {ordered.map((id, i) => {
          const s = sheetOf(p, id);
          if (!s) return null;
          const d = sheetDimsMm(s);
          return (
            <div className="pub-item" role="listitem" key={id}>
              <input type="checkbox" checked={picked.has(id)} aria-label={`Incluir ${s.number}`} onChange={() => toggle(id)} />
              <span className="pub-ord">{i + 1}</span>
              <span className="pub-name">
                <b>{s.number}</b> {s.name}
                <span className="val soft"> · {s.size} {d.w}×{d.h} mm · {s.viewports.length} vista{s.viewports.length === 1 ? '' : 's'}{s.revisions?.length ? ` · rev. ${s.titleBlock.revision || s.revisions[s.revisions.length - 1]!.tag}` : ''}</span>
              </span>
              <button className="btn small" title="Mover para cima" disabled={i === 0} onClick={() => move(id, -1)}>↑</button>
              <button className="btn small" title="Mover para baixo" disabled={i === ordered.length - 1} onClick={() => move(id, 1)}>↓</button>
            </div>
          );
        })}
        {sheets.length === 0 ? <p className="val soft">Nenhuma prancha no projeto. Crie uma e adicione vistas.</p> : null}
      </div>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <p className="val soft">Dica: a exportação rápida do menu Arquivo › Exportar › PDF publica todas as pranchas de uma vez.</p>
    </Dialog>
  );
}

/** Abre a publicação cuidando de prancha inexistente (o diálogo só aparece com o projeto atual). */
export function openPublish(): void {
  if (!editor.project) return;
  useUi.setState({ dialog: 'publish', dialogArg: null });
}
