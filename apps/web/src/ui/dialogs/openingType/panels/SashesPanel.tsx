import type { ReactElement } from 'react';
import { openingTiltAxis, type OpeningType } from '@hestia/model';
import { NumField } from '../../../fields.tsx';
import { setTiltAxis } from '../openingTypeControls.ts';
import { usePanelKit, type PanelProps } from './panelKit.tsx';
import { AngleRows, TransomRows } from './sharedRows.tsx';

/** Folhas e divisões (só janelas): tipo de abertura, nº de folhas, ângulos, grade, bandeira e luzes laterais. */
export function SashesPanel(props: PanelProps): ReactElement {
  const { d, onChange, family, support, leaves } = props;
  const k = usePanelKit(d, onChange);
  return (
    <>
      <div className="field-row"><label htmlFor="op-kind" title="A família do tipo; troque pelo seletor Família no alto do diálogo">Tipo de abertura</label><span id="op-kind">{family?.name ?? 'Outros'}</span></div>
      {leaves.length > 1 ? (
        <div className="field-row">
          <label htmlFor="op-leaves">Folhas</label>
          <select id="op-leaves" className="select" value={d.leaves} onChange={(e) => k.set({ leaves: Number(e.target.value) as OpeningType['leaves'] })}>
            {leaves.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      ) : null}
      <AngleRows {...props} />
      {support.tiltAxis ? (
        <>
          <div className="field-row">
            <label htmlFor="op-tilt-axis" title="Altura do eixo horizontal da basculante: central ou fora do centro">Eixo do basculante</label>
            <select
              id="op-tilt-axis"
              className="select"
              value={openingTiltAxis(d) === 0.5 ? 'central' : 'eccentric'}
              onChange={(e) => onChange(setTiltAxis(d, e.target.value === 'central' ? 0.5 : openingTiltAxis(d) === 0.5 ? 0.4 : openingTiltAxis(d)))}
            >
              <option value="central">Central</option>
              <option value="eccentric">Excêntrico</option>
            </select>
          </div>
          {openingTiltAxis(d) !== 0.5 ? (
            <div className="field-row"><label htmlFor="op-tilt-axis-value">Eixo: altura</label><NumField id="op-tilt-axis-value" value={openingTiltAxis(d) * 100} decimals={0} unit="%" min={20} max={80} onCommit={(v) => onChange(setTiltAxis(d, v / 100))} /></div>
          ) : null}
        </>
      ) : null}
      {support.grid ? (
        <>
          <div className="field-row"><label htmlFor="op-grid-c">Divisões: colunas</label><NumField id="op-grid-c" value={k.grid.cols} decimals={0} onCommit={(v) => k.setField('grid', { cols: v, rows: k.grid.rows }, k.gridFallback)} /></div>
          <div className="field-row"><label htmlFor="op-grid-r">Divisões: linhas</label><NumField id="op-grid-r" value={k.grid.rows} decimals={0} onCommit={(v) => k.setField('grid', { cols: k.grid.cols, rows: v }, k.gridFallback)} /></div>
        </>
      ) : null}
      <TransomRows {...props} />
    </>
  );
}
