import type { ReactElement } from 'react';
import { OPENING_FRAME_DEFAULTS, type OpeningGlassKind } from '@hestia/model';
import { NumField } from '../../../fields.tsx';
import { GLASS_KINDS, setGlassKind, setLeafMaterialId } from '../openingTypeControls.ts';
import { MaterialSelect, usePanelKit, type PanelProps } from './panelKit.tsx';

/** Caixilho e vidro (janela): espessura da folha/caixilho e o vidro. */
export function GlazingPanel({ d, onChange, support, materials }: PanelProps): ReactElement {
  const k = usePanelKit(d, onChange);
  return (
    <>
      {support.leafThickness ? (
        <>
          <div className="field-row"><label htmlFor="op-lt">Espessura da folha</label><NumField id="op-lt" value={d.leafThickness ?? OPENING_FRAME_DEFAULTS.windowLeaf} quantity="smallLength" min={0.01} onCommit={(v) => k.set({ leafThickness: v })} /></div>
          <MaterialSelect id="op-leaf-mat" label="Material da folha" value={d.leafMaterialId ?? d.frameMaterialId} materials={materials} onPick={(id) => onChange(setLeafMaterialId(d, id))} />
        </>
      ) : null}
      {support.glassKind ? (
        <>
          <MaterialSelect id="op-glass" label="Material do vidro" value={d.glassMaterialId} materials={materials} onPick={(id) => k.set({ glassMaterialId: id })} />
          <div className="field-row">
            <label htmlFor="op-glass-kind">Tipo de vidro</label>
            <select id="op-glass-kind" className="select" value={d.glassKind ?? 'clear'} onChange={(e) => onChange(setGlassKind(d, e.target.value as OpeningGlassKind))}>
              {GLASS_KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div className="field-row"><label htmlFor="op-gt">Espessura do vidro</label><NumField id="op-gt" value={d.glassThickness ?? OPENING_FRAME_DEFAULTS.glass} quantity="smallLength" min={0.001} onCommit={(v) => k.set({ glassThickness: v })} /></div>
        </>
      ) : null}
    </>
  );
}
