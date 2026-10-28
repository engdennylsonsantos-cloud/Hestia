import type { ReactElement } from 'react';
import { openingSillBoard } from '@hestia/model';
import { Check, NumField } from '../../../fields.tsx';
import { alternarAcabamento } from '../../openingTypeForm.ts';
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
