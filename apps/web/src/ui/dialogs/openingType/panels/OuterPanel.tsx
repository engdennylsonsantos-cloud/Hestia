import type { ReactElement } from 'react';
import { openingSillBoard } from '@hestia/model';
import { Check, NumField } from '../../../fields.tsx';
import { alternarAcabamento } from '../../openingTypeForm.ts';
import { THRESHOLD_KINDS, setThresholdKind, setThresholdThickness, thresholdKind, type OpeningThresholdKind } from '../openingTypeControls.ts';
import { usePanelKit, type PanelProps } from './panelKit.tsx';
import { CasingRows, ClosureSideRow } from './sharedRows.tsx';

/** Lado externo: retorno do acabamento, alizar e soleira/peitoril saliente. */
export function OuterPanel(props: PanelProps): ReactElement {
  const { d, onChange, support } = props;
  const { set } = usePanelKit(d, onChange);
  const sb = openingSillBoard(d);
  return (
    <>
      <ClosureSideRow d={d} onChange={onChange} lado="exterior" />
      <CasingRows {...props} />
      {support.threshold ? (
        <>
          <div className="field-row">
            <label htmlFor="op-threshold" title="Soleira/limiar da porta: uma peça só para os dois lados">Soleira</label>
            <select id="op-threshold" className="select" value={thresholdKind(d)} onChange={(e) => onChange(setThresholdKind(d, e.target.value as OpeningThresholdKind))}>
              {THRESHOLD_KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          {d.threshold ? (
            <div className="field-row"><label htmlFor="op-threshold-h">Soleira: altura</label><NumField id="op-threshold-h" value={d.threshold.thickness} scale={100} decimals={1} unit="cm" min={0.005} max={0.08} onCommit={(v) => onChange(setThresholdThickness(d, v))} /></div>
          ) : null}
        </>
      ) : null}
      {support.sillBoard ? (
        <>
          <div className="field-row"><label htmlFor="ot-ac-sb" title="Peitoril saliente, só de janela: projeção além de cada face da parede">Soleira saliente</label><Check id="ot-ac-sb" checked={sb !== null} onChange={(v) => onChange(alternarAcabamento(d, 'sillBoard', v))} /></div>
          {sb ? (
            <>
              <div className="field-row"><label htmlFor="ot-ac-sbp">Soleira: projeção</label><NumField id="ot-ac-sbp" value={sb.projection} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ sillBoard: { ...sb, projection: v } })} /></div>
              <div className="field-row"><label htmlFor="ot-ac-sbe">Soleira: espessura</label><NumField id="ot-ac-sbe" value={sb.thickness} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ sillBoard: { ...sb, thickness: v } })} /></div>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
