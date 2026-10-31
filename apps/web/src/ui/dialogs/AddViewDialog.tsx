import { useState, type ReactElement } from 'react';
import { projectView3DPoints, sectionTitleOf, sheetInnerBox, sheetOf, type SheetViewSource } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { SCALE_OPTIONS } from '../../editor/sheetActions.ts';
import { addViewsAction, autoScaleForView, type InsertRequest } from '../../editor/sheetInsert.ts';
import { useUi } from '../../editor/state.ts';
import { Check, Row } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';

interface Source {
  key: string;
  label: string;
  view: SheetViewSource;
}

/**
 * Vistas que uma prancha pode mostrar: plantas dos níveis, cortes e elevações do projeto, e o 3D — uma opção por ponto
 * de vista salvo (decisão 0040), mais o enquadramento padrão para quando o catálogo está vazio ou como alternativa.
 */
function sourcesOf(p: ReturnType<typeof useProject>): Source[] {
  return [
    ...p.levels.map((l) => ({ key: `plan:${l.id}`, label: `Planta · ${l.name}`, view: { kind: 'plan' as const, levelId: l.id } })),
    ...p.views.map((v) => ({ key: `section:${v.id}`, label: `${v.kind === 'elevation' ? 'Elevação' : 'Corte'} · ${sectionTitleOf(v)}`, view: { kind: 'section' as const, sectionId: v.id } })),
    ...projectView3DPoints(p).map((ponto) => ({
      key: `3d:${ponto.id}`,
      label: `Modelo 3D · ${ponto.name}`,
      view: { kind: '3d' as const, pointId: ponto.id },
    })),
    { key: '3d', label: 'Modelo 3D (enquadramento padrão)', view: { kind: '3d' as const } },
  ];
}

/**
 * "Adicionar vista" à prancha: marca uma ou várias origens (plantas, cortes/elevações e o 3D — um ponto de vista salvo
 * por opção), escolhe a escala — ou deixa a automática — e insere todas no primeiro lugar livre, num único passo de
 * desfazer.
 */
export function AddViewDialog({ sheetId }: { sheetId: string }): ReactElement | null {
  const p = useProject();
  const sheet = sheetOf(p, sheetId);
  const sources = sourcesOf(p);
  const [keys, setKeys] = useState<ReadonlySet<string>>(() => new Set(sources[0] ? [sources[0].key] : []));
  const [scale, setScale] = useState<number | 'auto'>('auto');
  const [err, setErr] = useState('');
  if (!sheet) return null;
  const inner = sheetInnerBox(sheet);
  const selected = sources.filter((s) => keys.has(s.key));
  const first = selected[0];
  const auto = first ? autoScaleForView(p, first.view, { w: inner.x1 - inner.x0, h: inner.y1 - inner.y0 }) : null;
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
  const toggle = (key: string, on: boolean): void => {
    setKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const add = (): void => {
    if (selected.length === 0) return setErr('Marque pelo menos uma vista.');
    const reqs: InsertRequest[] = selected.map((s) => (scale === 'auto' ? { view: s.view } : { view: s.view, scale }));
    try {
      const ids = addViewsAction(editor.store, sheetId, reqs);
      useUi.setState({ status: `${ids.length} vista(s) adicionada(s).` });
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível adicionar as vistas.');
    }
  };
  return (
    <Dialog
      title="Adicionar vistas"
      sub={`${sheet.number} · ${sheet.name}`}
      onClose={close}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={add} disabled={selected.length === 0}>Adicionar</button>
        </>
      }
    >
      <Row label="Vistas">
        <div style={{ display: 'grid', gap: 4, maxHeight: 190, overflowY: 'auto' }}>
          {sources.map((s) => (
            <Check key={s.key} checked={keys.has(s.key)} onChange={(on) => toggle(s.key, on)}>
              {s.label}
            </Check>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button className="btn" onClick={() => setKeys(new Set(sources.map((s) => s.key)))}>Marcar todas</button>
          <button className="btn" onClick={() => setKeys(new Set())}>Limpar</button>
        </div>
      </Row>
      <Row label="Escala" htmlFor="av-scale">
        <select id="av-scale" value={scale} onChange={(e) => setScale(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
          <option value="auto">{auto === null ? 'Automática' : `Automática · 1:${auto}`}</option>
          {SCALE_OPTIONS.map((k) => (
            <option key={k} value={k}>1:{k}</option>
          ))}
        </select>
      </Row>
      {err ? <p className="error" role="alert">{err}</p> : null}
    </Dialog>
  );
}
