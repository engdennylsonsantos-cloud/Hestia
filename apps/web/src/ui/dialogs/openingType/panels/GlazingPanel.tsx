import type { ReactElement } from 'react';
import { OPENING_FRAME_DEFAULTS } from '@hestia/model';
import { NumField } from '../../../fields.tsx';
import { MaterialSelect, usePanelKit, type PanelProps } from './panelKit.tsx';

/** Caixilho e vidro (janela): espessura da folha/caixilho e o vidro. */
export function GlazingPanel({ d, onChange, support, materials }: PanelProps): ReactElement {
  const k = usePanelKit(d, onChange);
  return (
    <>
      {support.leafThickness ? (
        <div className="field-row"><label htmlFor="op-lt">Espessura da folha</label><NumField id="op-lt" value={d.leafThickness ?? OPENING_FRAME_DEFAULTS.windowLeaf} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => k.set({ leafThickness: v })} /></div>
      ) : null}
      {support.glassKind ? (
        <>
          <MaterialSelect id="op-glass" label="Material do vidro" value={d.glassMaterialId} materials={materials} onPick={(id) => k.set({ glassMaterialId: id })} />
          <div className="field-row"><label htmlFor="op-gt">Espessura do vidro</label><NumField id="op-gt" value={d.glassThickness ?? OPENING_FRAME_DEFAULTS.glass} scale={100} decimals={1} unit="cm" min={0.001} onCommit={(v) => k.set({ glassThickness: v })} /></div>
        </>
      ) : null}
    </>
  );
}
