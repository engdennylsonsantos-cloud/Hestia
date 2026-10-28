import type { ReactElement } from 'react';
import { OPENING_FRAME_DEFAULTS, type OpeningFrameDepthMode } from '@hestia/model';
import { NumField } from '../../../fields.tsx';
import { setRevealDepth } from '../openingTypeControls.ts';
import { FIELD_FRAME, MaterialSelect, usePanelKit, type PanelProps } from './panelKit.tsx';

const MODOS: ReadonlyArray<readonly [OpeningFrameDepthMode, string]> = [
  ['wall', 'Espessura acabada da parede'],
  ['core', 'Espessura do núcleo'],
  ['fixed', 'Valor fixo'],
];

/** Batente: estilo, perfil, profundidade (e como ela se liga à parede) e material. */
export function FramePanel({ d, onChange, materials }: PanelProps): ReactElement {
  const k = usePanelKit(d, onChange);
  const modo = d.frameDepthMode ?? 'wall';
  return (
    <>
      <div className="field-row">
        <label htmlFor="op-frame">Estilo do batente</label>
        <select id="op-frame" className="select" value={k.frameStyle} onChange={(e) => k.setField('frameStyle', e.target.value, k.frameFallback)}>
          {FIELD_FRAME.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="field-row"><label htmlFor="op-fw" title="Largura do perfil visto de frente (ombreiras, verga, soleira)">Largura do perfil</label><NumField id="op-fw" value={d.frameWidth ?? OPENING_FRAME_DEFAULTS.frameWidth} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => k.set({ frameWidth: v })} /></div>
      <div className="field-row">
        <label htmlFor="op-fdm" title="Como a profundidade do batente se liga à espessura da parede">Profundidade do batente</label>
        <select
          id="op-fdm"
          className="select"
          value={modo}
          onChange={(e) => (e.target.value === 'wall' ? k.limpar('frameDepthMode') : k.set({ frameDepthMode: e.target.value as OpeningFrameDepthMode }))}
        >
          {MODOS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      {modo === 'fixed' ? (
        <div className="field-row"><label htmlFor="op-fd" title="Profundidade do batente na espessura da parede (limitada à parede)">Profundidade do batente</label><NumField id="op-fd" value={d.frameDepth ?? OPENING_FRAME_DEFAULTS.frameDepth} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => k.set({ frameDepth: v })} /></div>
      ) : null}
      {modo !== 'wall' ? (
        <div className="field-row"><label htmlFor="op-reveal" title="Recuo do batente em relação à face da parede (ArchiCAD: Reveal)">Recuo do batente</label><NumField id="op-reveal" value={d.reveal?.depth ?? 0} scale={100} decimals={1} unit="cm" min={0} onCommit={(v) => onChange(setRevealDepth(d, v))} /></div>
      ) : null}
      <MaterialSelect id="op-mat" label="Material do caixilho" value={d.frameMaterialId} materials={materials} onPick={(id) => k.set({ frameMaterialId: id })} />
    </>
  );
}
