import type { ReactElement } from 'react';
import { NumField, TextField } from '../../../fields.tsx';
import { usePanelKit, type PanelProps } from './panelKit.tsx';

/** Visão geral: nome e dimensões do tipo. A prévia (planta, elevação, corte, 3D) fica sempre visível à direita. */
export function OverviewPanel({ d, onChange, support }: PanelProps): ReactElement {
  const { set, setField } = usePanelKit(d, onChange);
  return (
    <>
      <div className="field-row"><label htmlFor="ot-name">Nome</label><TextField id="ot-name" value={d.name} onCommit={(v) => set({ name: v })} /></div>
      <div className="field-row"><label htmlFor="op-w">Largura</label><NumField id="op-w" value={d.width} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ width: v })} /></div>
      <div className="field-row"><label htmlFor="op-h">Altura</label><NumField id="op-h" value={d.height} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ height: v })} /></div>
      <div className="field-row"><label htmlFor="op-s">Peitoril</label><NumField id="op-s" value={d.sill} scale={100} decimals={0} unit="cm" min={0} onCommit={(v) => set({ sill: v })} /></div>
      {support.nominalRef ? (
        <>
          <div className="field-row">
            <label htmlFor="op-nominal" title="A que a largura e a altura se referem: ao vão/batente ou à folha nominal">Referência do tamanho</label>
            <select id="op-nominal" className="select" value={d.nominalRef ?? 'opening'} onChange={(e) => setField('nominalRef', e.target.value, 'opening')}>
              <option value="opening">Vão</option>
              <option value="leaf">Folha</option>
            </select>
          </div>
          <p className="hint" style={{ padding: '0 0 8px' }}>No Brasil, 80×210 é a folha; o vão na parede é maior.</p>
        </>
      ) : null}
    </>
  );
}
