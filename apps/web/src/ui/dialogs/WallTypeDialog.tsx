import { useMemo, useState, type ReactElement } from 'react';
import { FUNCTION_LABEL, coreRange, newId, totalThickness, wallTypeUsage, type Layer, type LayerFunction, type WallType } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { NumField, TextField } from '../fields.tsx';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';
import { MaterialsDialog } from './MaterialsDialog.tsx';
import { SectionPreview } from './SectionPreview.tsx';

const FUNCTIONS = Object.keys(FUNCTION_LABEL) as LayerFunction[];
type Tab = 'estrutura' | 'graficos' | 'identidade';

export function WallTypeDialog({ typeId }: { typeId: string }): ReactElement | null {
  const p = useProject();
  const src = p.wallTypes[typeId];
  const [draft, setDraft] = useState<WallType | null>(src ? structuredClone(src) : null);
  const [tab, setTab] = useState<Tab>('estrutura');
  const [pick, setPick] = useState<number | null>(null);
  const [current, setCurrent] = useState(typeId);
  if (current !== typeId) {
    setCurrent(typeId);
    setDraft(p.wallTypes[typeId] ? structuredClone(p.wallTypes[typeId]!) : null);
  }
  const usage = useMemo(() => (draft ? wallTypeUsage(p, draft.id) : 0), [p, draft]);
  if (!draft) return null;
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
  const core = coreRange(draft);
  const setLayer = (i: number, patch: Partial<Layer>): void => setDraft({ ...draft, layers: draft.layers.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const move = (i: number, d: -1 | 1): void => {
    const j = i + d;
    if (j < 0 || j >= draft.layers.length) return;
    const ls = [...draft.layers];
    [ls[i], ls[j]] = [ls[j]!, ls[i]!];
    setDraft({ ...draft, layers: ls });
  };
  const insert = (): void => {
    const at = Math.max(0, Math.min(draft.layers.length, core.first + 1));
    const ls = [...draft.layers];
    ls.splice(at, 0, { function: 'substrate', materialId: 'mat_reboco', thickness: 0.01, wraps: true });
    setDraft({ ...draft, layers: ls });
  };
  const remove = (i: number): void => {
    if (draft.layers.length > 1) setDraft({ ...draft, layers: draft.layers.filter((_, k) => k !== i) });
  };
  const ok = (): void => {
    editor.store.exec({ type: 'upsertWallType', wallType: draft }, 'Editar tipo de parede');
    close();
  };
  const duplicate = (): void => {
    const copy = { ...draft, id: newId('wt'), name: `${draft.name} (cópia)` };
    editor.store.exec({ type: 'upsertWallType', wallType: copy }, 'Duplicar tipo');
    useUi.setState({ dialogArg: copy.id });
  };
  const del = (): void => {
    try {
      editor.store.exec({ type: 'deleteWallType', id: draft.id });
      close();
    } catch (e) {
      useUi.setState({ status: e instanceof Error ? e.message : 'Não foi possível excluir.' });
    }
  };
  const tabBtn = (t: Tab, label: string): ReactElement => (
    <button className={`dtab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{label}</button>
  );
  return (
    <>
      <Dialog
        title="Propriedades do tipo"
        sub={`Parede · usado em ${usage} ${usage === 1 ? 'parede' : 'paredes'}`}
        onClose={close}
        footer={
          <>
            <button className="btn" onClick={duplicate}>Duplicar</button>
            <button className="btn danger" disabled={usage > 0 || draft.id === p.defaults.wallTypeId} title={usage > 0 ? 'Há paredes usando este tipo' : 'Excluir tipo'} onClick={del}>Excluir</button>
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={close}>Cancelar</button>
            <button className="btn primary" onClick={ok}>OK</button>
          </>
        }
      >
        <div className="field-row">
          <label htmlFor="wt-name">Nome do tipo</label>
          <TextField id="wt-name" value={draft.name} onCommit={(v) => setDraft({ ...draft, name: v })} />
        </div>
        <div className="dtabs">
          {tabBtn('estrutura', 'Estrutura')}
          {tabBtn('graficos', 'Gráficos')}
          {tabBtn('identidade', 'Identidade')}
        </div>
        {tab === 'estrutura' && (
          <div className="split">
            <div style={{ minWidth: 0 }}>
              <table className="layers">
                <thead>
                  <tr><th>#</th><th>Função</th><th>Material</th><th>Esp. (cm)</th><th title="Retorno no vão e nas extremidades">Envolve</th><th /></tr>
                </thead>
                <tbody>
                  <tr><td colSpan={6} style={{ color: 'var(--fg-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Face externa</td></tr>
                  {draft.layers.map((l, i) => {
                    const m = p.materials[l.materialId];
                    const inCore = i >= core.first && i <= core.last;
                    return (
                      <tr key={i} className={inCore ? 'core' : ''}>
                        <td className="mono">{i + 1}</td>
                        <td>
                          <select className="select" aria-label={`Função da camada ${i + 1}`} value={l.function} onChange={(e) => setLayer(i, { function: e.target.value as LayerFunction })}>
                            {FUNCTIONS.map((f) => <option key={f} value={f}>{FUNCTION_LABEL[f]}</option>)}
                          </select>
                        </td>
                        <td>
                          <button className="btn small" style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setPick(i)} title="Escolher material">
                            <span className="swatch" style={{ background: m?.color }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m?.name ?? '—'}</span>
                          </button>
                        </td>
                        <td><NumField value={l.thickness} scale={100} decimals={1} min={0} onCommit={(v) => setLayer(i, { thickness: v })} /></td>
                        <td><input type="checkbox" aria-label={`Camada ${i + 1} envolve`} checked={l.wraps} onChange={(e) => setLayer(i, { wraps: e.target.checked })} /></td>
                        <td>
                          <span className="iconrow">
                            <button className="ibtn" onClick={() => move(i, -1)} aria-label="Subir camada" disabled={i === 0}><Icon name="up" size={14} /></button>
                            <button className="ibtn" onClick={() => move(i, 1)} aria-label="Descer camada" disabled={i === draft.layers.length - 1}><Icon name="down" size={14} /></button>
                            <button className="ibtn" onClick={() => remove(i)} aria-label="Remover camada" disabled={draft.layers.length <= 1}><Icon name="close" size={14} /></button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr><td colSpan={6} style={{ color: 'var(--fg-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Face interna</td></tr>
                </tbody>
              </table>
              <div className="total"><span>Espessura total</span><strong>{(totalThickness(draft) * 100).toFixed(1).replace('.', ',')} cm</strong></div>
              <button className="btn small" onClick={insert}>+ Inserir camada</button>
            </div>
            <div>
              <SectionPreview type={draft} materials={p.materials} />
              <p className="hint" style={{ padding: '8px 2px' }}>
                O núcleo (faixa azul) vai da primeira à última camada de estrutura e define as linhas de localização “do núcleo”. Na junção, a camada de menor número de prioridade atravessa as demais.
              </p>
            </div>
          </div>
        )}
        {tab === 'graficos' && (
          <div>
            <p className="hint" style={{ padding: '0 0 8px' }}>A hachura de corte e as cores vêm do material de cada camada. Edite no navegador de materiais.</p>
            <table className="layers">
              <thead><tr><th>Camada</th><th>Material</th><th>Hachura</th></tr></thead>
              <tbody>
                {draft.layers.map((l, i) => {
                  const m = p.materials[l.materialId];
                  return (
                    <tr key={i}>
                      <td>{FUNCTION_LABEL[l.function]}</td>
                      <td><span className="swatch" style={{ background: m?.color }} /> {m?.name}</td>
                      <td>{m?.hatch}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p><button className="chiplink" onClick={() => setPick(0)}>Abrir navegador de materiais…</button></p>
          </div>
        )}
        {tab === 'identidade' && (
          <>
            <div className="field-row"><label htmlFor="wt-code">Código</label><TextField id="wt-code" value={draft.code} onCommit={(v) => setDraft({ ...draft, code: v })} /></div>
            <div className="field-row"><label htmlFor="wt-desc">Descrição</label><TextField id="wt-desc" value={draft.description} onCommit={(v) => setDraft({ ...draft, description: v })} /></div>
          </>
        )}
      </Dialog>
      {pick !== null && (
        <MaterialsDialog
          pickFor={draft.layers[pick]?.materialId ?? null}
          onPick={(id) => {
            if (tab === 'estrutura') setLayer(pick, { materialId: id });
            setPick(null);
          }}
          onClose={() => setPick(null)}
        />
      )}
    </>
  );
}
