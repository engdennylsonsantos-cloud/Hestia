import { useState, type ReactElement } from 'react';
import { stairTypeIssue, stairTypeUsage, type StairRunStyle, type StairType, type StairUndersideStyle } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { keptStairType } from '../../editor/stairActions.ts';
import { duplicateStairType, stairTypeDeleteBlock, stairTypeError, tryDeleteStairType } from '../../editor/stairTypeActions.ts';
import { NumField, TextField } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';
import { StairSectionPreview } from './StairSectionPreview.tsx';

const STYLE_LABEL: Record<StairRunStyle, string> = { monolithic: 'Monolítico (concreto)', assembled: 'Piso e espelho (montado)', post: 'Poste central' };
const UNDERSIDE_LABEL: Record<StairUndersideStyle, string> = { smooth: 'Lisa', stepped: 'Escalonada' };

/**
 * Editor de tipo de escada (campos do `StairType`, decisão 0011 §1 item 8). O estilo decide a espessura: monolítico usa
 * a espessura estrutural (perpendicular à rampa) e a face inferior (decisão 0012); montado usa a espessura do piso e do
 * espelho; poste central (decisão 0014 §8) usa a espessura do degrau, a sobreposição e o material do poste, sem espelho.
 */
export function StairTypeDialog({ typeId }: { typeId: string }): ReactElement | null {
  const p = useProject();
  const src = p.stairTypes[typeId];
  const [draft, setDraft] = useState<StairType | null>(src ? structuredClone(src) : null);
  const [current, setCurrent] = useState(typeId);
  if (current !== typeId) {
    setCurrent(typeId);
    setDraft(p.stairTypes[typeId] ? structuredClone(p.stairTypes[typeId]!) : null);
  }
  if (!draft) return null;
  const usage = stairTypeUsage(p, draft.id);
  const error = stairTypeError(draft) ?? stairTypeIssue(draft);
  const mono = draft.runStyle === 'monolithic';
  const post = draft.runStyle === 'post';
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
  const set = (patch: Partial<StairType>): void => setDraft({ ...draft, ...patch });
  const setStyle = (runStyle: StairRunStyle): void =>
    set(
      runStyle === 'monolithic'
        ? { runStyle, structuralDepth: draft.structuralDepth || 0.2, treadThickness: 0, riserThickness: 0 }
        : runStyle === 'post'
          ? { runStyle, structuralDepth: 0, treadThickness: draft.treadThickness || 0.05, riserThickness: 0, treadOverlap: draft.treadOverlap || 0.025 }
          : { runStyle, structuralDepth: 0, treadThickness: draft.treadThickness || 0.03, riserThickness: draft.riserThickness || 0.02 },
    );
  const ok = (): void => {
    if (error) return;
    editor.store.exec({ type: 'upsertStairType', stairType: draft }, 'Editar tipo de escada');
    close();
  };
  const duplicate = (): void => {
    const id = duplicateStairType(editor.store, draft.id);
    if (id) useUi.setState({ dialogArg: id });
  };
  const del = (): void => {
    const r = tryDeleteStairType(editor.store, draft.id);
    if (!r.ok) {
      useUi.setState({ status: `Não foi possível excluir: ${r.error}` });
      return;
    }
    const ui = useUi.getState();
    if (ui.options.stair?.typeId === draft.id) {
      useUi.setState({ options: { ...ui.options, stair: { ...ui.options.stair, typeId: keptStairType(editor.project, undefined) } } });
    }
    close();
  };
  const blocked = stairTypeDeleteBlock(p, draft.id);
  return (
    <Dialog
      title="Propriedades do tipo de escada"
      sub={`Escada · usada em ${usage} ${usage === 1 ? 'escada' : 'escadas'}`}
      onClose={close}
      size="mid"
      footer={
        <>
          <button className="btn" onClick={duplicate}>Duplicar</button>
          <button className="btn danger" disabled={blocked !== null} title={blocked ?? 'Excluir tipo'} onClick={del}>Excluir</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={ok} disabled={error !== null} title={error ?? undefined}>OK</button>
        </>
      }
    >
      <div className="field-row">
        <label htmlFor="stt-name">Nome do tipo</label>
        <TextField id="stt-name" value={draft.name} onCommit={(v) => set({ name: v })} />
      </div>
      <div className="split">
        <div style={{ minWidth: 0 }}>
          <div className="field-row">
            <label htmlFor="stt-style">Estilo</label>
            <select id="stt-style" className="select" value={draft.runStyle} onChange={(e) => setStyle(e.target.value as StairRunStyle)}>
              {(Object.keys(STYLE_LABEL) as StairRunStyle[]).map((k) => <option key={k} value={k}>{STYLE_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="field-row"><label htmlFor="stt-riser">Espelho máximo (cm)</label><NumField id="stt-riser" value={draft.maxRiser} scale={100} decimals={1} min={0.01} onCommit={(v) => set({ maxRiser: v })} /></div>
          <div className="field-row"><label htmlFor="stt-tread">Piso mínimo (cm)</label><NumField id="stt-tread" value={draft.minTread} scale={100} decimals={1} min={0.01} onCommit={(v) => set({ minTread: v })} /></div>
          <div className="field-row"><label htmlFor="stt-width">Largura mínima do lance (cm)</label><NumField id="stt-width" value={draft.minRunWidth} scale={100} decimals={1} min={0.01} onCommit={(v) => set({ minRunWidth: v })} /></div>
          {mono ? (
            <>
              <div className="field-row"><label htmlFor="stt-depth">Espessura estrutural (perpendicular à rampa) (cm)</label><NumField id="stt-depth" value={draft.structuralDepth} scale={100} decimals={1} min={0.01} onCommit={(v) => set({ structuralDepth: v })} /></div>
              <div className="field-row">
                <label htmlFor="stt-underside">Face inferior</label>
                <select id="stt-underside" className="select" value={draft.undersideStyle} onChange={(e) => set({ undersideStyle: e.target.value as StairUndersideStyle })}>
                  {(Object.keys(UNDERSIDE_LABEL) as StairUndersideStyle[]).map((k) => <option key={k} value={k}>{UNDERSIDE_LABEL[k]}</option>)}
                </select>
              </div>
            </>
          ) : post ? (
            <>
              <div className="field-row"><label htmlFor="stt-tt">Espessura do degrau (cm)</label><NumField id="stt-tt" value={draft.treadThickness} scale={100} decimals={1} min={0.01} onCommit={(v) => set({ treadThickness: v })} /></div>
              <div className="field-row"><label htmlFor="stt-overlap">Sobreposição dos degraus (cm)</label><NumField id="stt-overlap" value={draft.treadOverlap} scale={100} decimals={1} min={0} onCommit={(v) => set({ treadOverlap: v })} /></div>
              <div className="field-row">
                <label htmlFor="stt-post-mat">Material do poste</label>
                <select id="stt-post-mat" className="select" value={draft.postMaterialId} onChange={(e) => set({ postMaterialId: e.target.value })}>
                  {Object.values(p.materials).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="field-row"><label htmlFor="stt-tt">Espessura do piso (cm)</label><NumField id="stt-tt" value={draft.treadThickness} scale={100} decimals={1} min={0.01} onCommit={(v) => set({ treadThickness: v })} /></div>
              <div className="field-row"><label htmlFor="stt-rt">Espessura do espelho (cm)</label><NumField id="stt-rt" value={draft.riserThickness} scale={100} decimals={1} min={0.01} onCommit={(v) => set({ riserThickness: v })} /></div>
            </>
          )}
          <div className="field-row"><label htmlFor="stt-nosing">Nariz (cm)</label><NumField id="stt-nosing" value={draft.nosing} scale={100} decimals={1} min={0} onCommit={(v) => set({ nosing: v })} /></div>
          <div className="field-row"><label htmlFor="stt-land">Espessura do patamar (cm)</label><NumField id="stt-land" value={draft.landingThickness} scale={100} decimals={1} min={0.01} onCommit={(v) => set({ landingThickness: v })} /></div>
          <div className="field-row"><label htmlFor="stt-head">Folga de cabeça mínima (m)</label><NumField id="stt-head" value={draft.minHeadroom} decimals={2} min={0.01} onCommit={(v) => set({ minHeadroom: v })} /></div>
          <div className="field-row">
            <label htmlFor="stt-mat">Material</label>
            <select id="stt-mat" className="select" value={draft.materialId} onChange={(e) => set({ materialId: e.target.value })}>
              {Object.values(p.materials).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field-row"><label htmlFor="stt-code">Código</label><TextField id="stt-code" value={draft.code} onCommit={(v) => set({ code: v })} /></div>
          <div className="field-row"><label htmlFor="stt-desc">Descrição</label><TextField id="stt-desc" value={draft.description} onCommit={(v) => set({ description: v })} /></div>
          <div className="field-row"><label htmlFor="stt-cost" title="Custo informativo do tipo (R$)">Custo (R$)</label><NumField id="stt-cost" value={draft.cost} decimals={2} min={0} onCommit={(v) => set({ cost: v })} /></div>
          {error && <p className="hint" role="alert" style={{ color: 'var(--danger, #b42318)', marginTop: 8 }}>{error}</p>}
        </div>
        <div>
          <StairSectionPreview type={draft} />
          <p className="hint" style={{ padding: '8px 2px' }}>
            Regras de espelho e piso valem para o lance calculado pela forma (reta, L, U). No croqui livre elas não bloqueiam, mas a altura real do espelho continua limitada pelo máximo.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
