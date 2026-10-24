import { useState, type ReactElement } from 'react';
import { sectionTitleOf, sheetOf, type SheetViewSource } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { addViewAction, SCALE_OPTIONS } from '../../editor/sheetActions.ts';
import { useUi } from '../../editor/state.ts';
import { Row } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';

interface Source {
  key: string;
  label: string;
  view: SheetViewSource;
}

/** Vistas que uma prancha pode mostrar: plantas dos níveis, cortes e elevações do projeto, e o 3D. */
function sourcesOf(p: ReturnType<typeof useProject>): Source[] {
  return [
    ...p.levels.map((l) => ({ key: `plan:${l.id}`, label: `Planta · ${l.name}`, view: { kind: 'plan' as const, levelId: l.id } })),
    ...p.views.map((v) => ({ key: `section:${v.id}`, label: `${v.kind === 'elevation' ? 'Elevação' : 'Corte'} · ${sectionTitleOf(v)}`, view: { kind: 'section' as const, sectionId: v.id } })),
    { key: '3d', label: 'Modelo 3D (quadro no PDF)', view: { kind: '3d' as const } },
  ];
}

/** "Adicionar vista" à prancha: escolhe a origem (planta, corte ou 3D) e a escala; a vista entra num lugar livre. */
export function AddViewDialog({ sheetId }: { sheetId: string }): ReactElement | null {
  const p = useProject();
  const sheet = sheetOf(p, sheetId);
  const sources = sourcesOf(p);
  const [key, setKey] = useState(sources[0]?.key ?? '3d');
  const [scale, setScale] = useState<number>(100);
  const [err, setErr] = useState('');
  if (!sheet) return null;
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
  const add = (): void => {
    const src = sources.find((x) => x.key === key);
    if (!src) return setErr('Escolha uma vista.');
    try {
      addViewAction(editor.store, sheetId, src.view, scale);
      useUi.setState({ status: 'Vista adicionada à prancha.' });
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Vista recusada.');
    }
  };
  return (
    <Dialog
      title="Adicionar vista"
      sub={`${sheet.number} · ${sheet.name}`}
      onClose={close}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={add} disabled={sources.length === 0}>Adicionar</button>
        </>
      }
    >
      <Row label="Vista" htmlFor="av-source">
        <select id="av-source" value={key} onChange={(e) => setKey(e.target.value)}>
          {sources.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </Row>
      <Row label="Escala" htmlFor="av-scale">
        <select id="av-scale" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
          {SCALE_OPTIONS.map((k) => (
            <option key={k} value={k}>1:{k}</option>
          ))}
        </select>
      </Row>
      {err ? <p className="error" role="alert">{err}</p> : null}
    </Dialog>
  );
}
