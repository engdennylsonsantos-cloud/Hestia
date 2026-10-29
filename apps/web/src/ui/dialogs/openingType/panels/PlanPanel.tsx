import type { ReactElement } from 'react';
import { openingLeafPlan, openingPlanDisplay, openingSwingStyle } from '@hestia/model';
import { Check } from '../../../fields.tsx';
import { usePanelKit, type PanelProps } from './panelKit.tsx';

/** Planta e corte: exibição, arco (só famílias que giram) e nível de detalhe 2D/3D. */
export function PlanPanel({ d, onChange, support }: PanelProps): ReactElement {
  const k = usePanelKit(d, onChange);
  return (
    <>
      <div className="field-row">
        <label htmlFor="op-plan">Exibição em planta</label>
        <select id="op-plan" className="select" value={openingPlanDisplay(d)} onChange={(e) => k.setField('planDisplay', e.target.value, openingPlanDisplay({}))}>
          <option value="symbolic">Simbólica</option>
          <option value="projected">Projetada</option>
        </select>
      </div>
      {support.angle ? (
        <>
          <div className="field-row">
            <label htmlFor="op-leaf-plan" title="Folha desenhada na planta: só a aberta, só a fechada ou as duas">Folha em planta</label>
            <select id="op-leaf-plan" className="select" value={openingLeafPlan(d)} onChange={(e) => k.setField('leafPlan', e.target.value, 'open')}>
              <option value="open">Só a aberta</option>
              <option value="closed">Só a fechada</option>
              <option value="both">As duas</option>
            </select>
          </div>
          <div className="field-row"><label htmlFor="op-swing" title="Arco do fecho desenhado na planta">Mostrar arco</label><Check id="op-swing" checked={d.showSwing !== false} onChange={(v) => { if (v) k.limpar('showSwing'); else k.set({ showSwing: false }); }} /></div>
          <div className="field-row">
            <label htmlFor="op-swing-style">Estilo do arco</label>
            <select id="op-swing-style" className="select" value={openingSwingStyle(d)} onChange={(e) => k.setField('swingStyle', e.target.value, openingSwingStyle({}))}>
              <option value="arc">Arco</option>
              <option value="dash">Tracejado</option>
              <option value="line">Linha</option>
            </select>
          </div>
        </>
      ) : null}
      <div className="field-row">
        <label htmlFor="op-d2">Detalhe 2D</label>
        <select id="op-d2" className="select" value={k.detail2d} onChange={(e) => k.setField('detail2d', e.target.value, k.detail2dFallback)}>
          <option value="scale">Sensível à escala</option>
          <option value="low">1:50 (baixo)</option>
          <option value="mid">1:100 (médio)</option>
          <option value="high">1:200 (alto)</option>
          <option value="off">Desligado</option>
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="op-d3">Detalhe 3D</label>
        <select id="op-d3" className="select" value={k.detail3d} onChange={(e) => k.setField('detail3d', e.target.value, k.detail3dFallback)}>
          <option value="view">Por vista</option>
          <option value="schematic">Esquemático</option>
          <option value="simple">Simplificado</option>
          <option value="full">Completo</option>
          <option value="off">Desligado</option>
        </select>
      </div>
    </>
  );
}
