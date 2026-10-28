import type { ReactElement } from 'react';
import type { PanelProps } from './panelKit.tsx';
import { CasingRows, ClosureSideRow } from './sharedRows.tsx';

/** Lado interno: retorno do acabamento e alizar (o alizar do tipo vale para as duas faces). */
export function InnerPanel(props: PanelProps): ReactElement {
  return (
    <>
      <ClosureSideRow d={props.d} onChange={props.onChange} lado="interior" />
      <CasingRows {...props} />
      {props.support.threshold ? <p className="hint">A soleira vale para os dois lados (veja Lado externo)</p> : null}
    </>
  );
}
