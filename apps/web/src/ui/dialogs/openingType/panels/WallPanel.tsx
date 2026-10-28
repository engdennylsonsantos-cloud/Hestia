import type { ReactElement } from 'react';
import { openingLintel, openingSillBeam, type OpeningType } from '@hestia/model';
import { Check, NumField } from '../../../fields.tsx';
import { alternarAcabamento } from '../../openingTypeForm.ts';
import { usePanelKit, type PanelProps } from './panelKit.tsx';

/** Parede e vão: fechamento, vão bruto (folga) e verga/contraverga. */
export function WallPanel({ d, onChange, support }: PanelProps): ReactElement {
  const { set } = usePanelKit(d, onChange);
  const lin = openingLintel(d);
  const beam = openingSillBeam(d);
  return (
    <>
      <div className="field-row">
        <label htmlFor="op-clos" title="Substitui o retorno de acabamento definido no tipo de parede">Fechamento do vão</label>
        <select id="op-clos" className="select" value={d.closure} onChange={(e) => set({ closure: e.target.value as OpeningType['closure'] })}>
          <option value="inherit">Seguir o tipo de parede</option>
          <option value="none">Sem retorno</option>
          <option value="both">Retorno dos dois lados</option>
          <option value="exterior">Só lado externo</option>
          <option value="interior">Só lado interno</option>
        </select>
      </div>
      <div className="field-row"><label htmlFor="ot-ac-fw" title="Folga do vão bruto (furo na parede) em relação à largura do tipo; a esquadria não muda">Folga: largura</label><NumField id="ot-ac-fw" value={d.roughOversize?.w ?? 0} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ roughOversize: { w: v, h: d.roughOversize?.h ?? 0 } })} /></div>
      <div className="field-row"><label htmlFor="ot-ac-fh" title="Folga do vão bruto (furo na parede) em relação à altura do tipo">Folga: altura</label><NumField id="ot-ac-fh" value={d.roughOversize?.h ?? 0} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ roughOversize: { w: d.roughOversize?.w ?? 0, h: v } })} /></div>
      {support.lintel ? (
        <>
          <div className="field-row"><label htmlFor="ot-ac-vg" title="Verga: peça de concreto sobre o vão">Verga</label><Check id="ot-ac-vg" checked={lin !== null} onChange={(v) => onChange(alternarAcabamento(d, 'lintel', v))} /></div>
          {lin ? (
            <>
              <div className="field-row"><label htmlFor="ot-ac-vgo">Verga: transpasse</label><NumField id="ot-ac-vgo" value={lin.over} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ lintel: { ...lin, over: v } })} /></div>
              <div className="field-row"><label htmlFor="ot-ac-vgh">Verga: altura</label><NumField id="ot-ac-vgh" value={lin.height} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ lintel: { ...lin, height: v } })} /></div>
            </>
          ) : null}
        </>
      ) : null}
      {support.sillBeam ? (
        <>
          <div className="field-row"><label htmlFor="ot-ac-cv" title="Contraverga: peça de concreto sob o vão">Contraverga</label><Check id="ot-ac-cv" checked={beam !== null} onChange={(v) => onChange(alternarAcabamento(d, 'sillBeam', v))} /></div>
          {beam ? (
            <>
              <div className="field-row"><label htmlFor="ot-ac-cvo">Contrav.: transpasse</label><NumField id="ot-ac-cvo" value={beam.over} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ sillBeam: { ...beam, over: v } })} /></div>
              <div className="field-row"><label htmlFor="ot-ac-cvh">Contrav.: altura</label><NumField id="ot-ac-cvh" value={beam.height} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ sillBeam: { ...beam, height: v } })} /></div>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
