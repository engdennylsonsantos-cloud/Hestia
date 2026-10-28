import type { ReactElement } from 'react';
import { NumField, TextField } from '../../../fields.tsx';
import { usePanelKit, type PanelProps } from './panelKit.tsx';

/** Visão geral: nome e dimensões do tipo. A prévia (planta, elevação, corte, 3D) fica sempre visível à direita. */
export function OverviewPanel({ d, onChange }: PanelProps): ReactElement {
  const { set } = usePanelKit(d, onChange);
  return (
    <>
      <div className="field-row"><label htmlFor="ot-name">Nome</label><TextField id="ot-name" value={d.name} onCommit={(v) => set({ name: v })} /></div>
      <div className="field-row"><label htmlFor="op-w">Largura</label><NumField id="op-w" value={d.width} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ width: v })} /></div>
      <div className="field-row"><label htmlFor="op-h">Altura</label><NumField id="op-h" value={d.height} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ height: v })} /></div>
      <div className="field-row"><label htmlFor="op-s">Peitoril</label><NumField id="op-s" value={d.sill} scale={100} decimals={0} unit="cm" min={0} onCommit={(v) => set({ sill: v })} /></div>
    </>
  );
}
