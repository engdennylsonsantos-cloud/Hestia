import type { ReactElement } from 'react';
import { OPENING_SPAN_GAP_MAX, leafSizeOf, openingSpanGap, openingSpanOf } from '@hestia/model';
import { NumField, TextField } from '../../../fields.tsx';
import { cmTexto, setSpanGap } from '../openingTypeControls.ts';
import { useUnits } from '../../../useUnits.ts';
import { usePanelKit, type PanelProps } from './panelKit.tsx';

/** Visão geral: nome e dimensões do tipo. A prévia (planta, elevação, corte, 3D) fica sempre visível à direita. */
export function OverviewPanel({ d, onChange, support }: PanelProps): ReactElement {
  const units = useUnits();
  const { set, setField } = usePanelKit(d, onChange);
  const gap = openingSpanGap(d);
  const vao = openingSpanOf(d);
  const folha = leafSizeOf(d);
  return (
    <>
      <div className="field-row"><label htmlFor="ot-name">Nome</label><TextField id="ot-name" value={d.name} onCommit={(v) => set({ name: v })} /></div>
      <div className="field-row"><label htmlFor="op-w">Largura</label><NumField id="op-w" value={d.width} quantity="smallLength" min={0.2} onCommit={(v) => set({ width: v })} /></div>
      <div className="field-row"><label htmlFor="op-h">Altura</label><NumField id="op-h" value={d.height} quantity="smallLength" min={0.2} onCommit={(v) => set({ height: v })} /></div>
      <div className="field-row"><label htmlFor="op-s">Peitoril</label><NumField id="op-s" value={d.sill} quantity="smallLength" min={0} onCommit={(v) => set({ sill: v })} /></div>
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
      {support.nominalRef && d.nominalRef === 'leaf' ? (
        <>
          <div className="field-row"><label htmlFor="op-gap-w" title="Folga do vão sobre a folha, na largura (NBR 15930-2: 8 cm)">Folga do vão: largura</label><NumField id="op-gap-w" value={gap.w} quantity="smallLength" min={0} max={OPENING_SPAN_GAP_MAX} onCommit={(v) => onChange(setSpanGap(d, 'w', v))} /></div>
          <div className="field-row"><label htmlFor="op-gap-h" title="Folga do vão sobre a folha, na altura (NBR 15930-2: 5 cm)">Folga do vão: altura</label><NumField id="op-gap-h" value={gap.h} quantity="smallLength" min={0} max={OPENING_SPAN_GAP_MAX} onCommit={(v) => onChange(setSpanGap(d, 'h', v))} /></div>
          <div className="field-row"><label htmlFor="op-span-derived" title="Vão que o motor recorta na parede: a folha mais a folga">Vão derivado</label><span id="op-span-derived">{cmTexto(units, vao.width)} × {cmTexto(units, vao.height)}</span></div>
          <div className="field-row"><label htmlFor="op-leaf-size" title="Folha nominal: a medida que o tipo informa">Folha</label><span id="op-leaf-size">{cmTexto(units, folha.width)} × {cmTexto(units, folha.height)}</span></div>
        </>
      ) : null}
    </>
  );
}
