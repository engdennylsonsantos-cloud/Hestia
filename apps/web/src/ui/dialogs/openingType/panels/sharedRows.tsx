import type { ReactElement } from 'react';
import { openingCasing, type OpeningType, type WrapMode } from '@hestia/model';
import { Check, NumField } from '../../../fields.tsx';
import { alternarAcabamento, alternarSidelight, alternarTransom, hasAuthoredComposition } from '../../openingTypeForm.ts';
import { usePanelKit, type PanelProps } from './panelKit.tsx';

/** Bandeira superior e bandeiras laterais; cada um só aparece quando a tabela de suporte da família o aceita. */
export function TransomRows({ d, onChange, support }: PanelProps): ReactElement {
  const { set } = usePanelKit(d, onChange);
  // Com módulos editados, bandeira e laterais são células da composição: os campos antigos não valem mais.
  if ((support.transom || support.sidelights) && hasAuthoredComposition(d)) {
    return <p className="hint">Este tipo usa módulos: bandeira superior e laterais se editam no componente “Módulos”.</p>;
  }
  return (
    <>
      {support.transom ? (
        <>
          <div className="field-row"><label htmlFor="op-transom" title="Vidro fixo acima da folha">Bandeira superior</label><Check id="op-transom" checked={d.transom !== undefined} onChange={(v) => onChange(alternarTransom(d, v))} /></div>
          {d.transom !== undefined ? (
            <div className="field-row"><label htmlFor="op-transom-h">Bandeira: altura</label><NumField id="op-transom-h" value={d.transom.height} quantity="smallLength" onCommit={(v) => set({ transom: { height: v, fixed: d.transom?.fixed !== false } })} /></div>
          ) : null}
        </>
      ) : null}
      {support.sidelights ? (
        <>
          <div className="field-row"><label htmlFor="op-side-left" title="Vidro fixo à esquerda da folha">Bandeira esquerda</label><Check id="op-side-left" checked={d.sidelights?.left === true} onChange={(v) => onChange(alternarSidelight(d, 'left', v))} /></div>
          <div className="field-row"><label htmlFor="op-side-right" title="Vidro fixo à direita da folha">Bandeira direita</label><Check id="op-side-right" checked={d.sidelights?.right === true} onChange={(v) => onChange(alternarSidelight(d, 'right', v))} /></div>
          {d.sidelights !== undefined ? (
            <div className="field-row"><label htmlFor="op-side-w">Bandeira: largura</label><NumField id="op-side-w" value={d.sidelights.width} quantity="smallLength" onCommit={(v) => set({ sidelights: { left: d.sidelights?.left, right: d.sidelights?.right, width: v } })} /></div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** Ângulos de abertura em planta e no 3D: só nas famílias que giram (tabela de suporte: `angle`). */
export function AngleRows({ d, onChange, support }: PanelProps): ReactElement | null {
  const k = usePanelKit(d, onChange);
  if (!support.angle) return null;
  return (
    <>
      <div className="field-row"><label htmlFor="op-a2">Ângulo 2D</label><NumField id="op-a2" value={(k.angle2d * Math.PI) / 180} quantity="angle" onCommit={(v) => k.setField('angle2d', (v * 180) / Math.PI, k.angle2dFallback)} /></div>
      <div className="field-row"><label htmlFor="op-a3">Ângulo 3D</label><NumField id="op-a3" value={(k.angle3d * Math.PI) / 180} quantity="angle" onCommit={(v) => k.setField('angle3d', (v * 180) / Math.PI, k.angle3dFallback)} /></div>
    </>
  );
}

/** Alizar (liga/desliga e medidas). O alizar do tipo vale para as duas faces da parede. */
export function CasingRows({ d, onChange, support }: PanelProps): ReactElement | null {
  const { set } = usePanelKit(d, onChange);
  if (!support.casing) return null;
  const cas = openingCasing(d);
  return (
    <>
      <div className="field-row"><label htmlFor="ot-ac-al" title="Alizar em volta do vão, nas duas faces da parede">Alizar</label><Check id="ot-ac-al" checked={cas !== null} onChange={(v) => onChange(alternarAcabamento(d, 'casing', v))} /></div>
      {cas ? (
        <>
          <div className="field-row"><label htmlFor="ot-ac-alw">Alizar: largura</label><NumField id="ot-ac-alw" value={cas.width} quantity="smallLength" onCommit={(v) => set({ casing: { ...cas, width: v } })} /></div>
          <div className="field-row"><label htmlFor="ot-ac-ale">Alizar: espessura</label><NumField id="ot-ac-ale" value={cas.thickness} quantity="smallLength" onCommit={(v) => set({ casing: { ...cas, thickness: v } })} /></div>
        </>
      ) : null}
    </>
  );
}

type Lado = 'exterior' | 'interior';

/** O retorno do acabamento em um lado: null = segue o tipo de parede ('inherit'), senão se há retorno naquele lado. */
export function retornoNoLado(closure: OpeningType['closure'], lado: Lado): boolean | null {
  if (closure === 'inherit') return null;
  return closure === 'both' || closure === lado;
}

/** Fechamento resultante de ligar/desligar o retorno de um lado; com 'inherit' o outro lado parte de "sem retorno". */
export function fechamentoComLado(closure: OpeningType['closure'], lado: Lado, ligado: boolean): OpeningType['closure'] {
  const outro: Lado = lado === 'exterior' ? 'interior' : 'exterior';
  const outroLigado = closure !== 'inherit' && (closure === 'both' || closure === outro);
  const ext = lado === 'exterior' ? ligado : outroLigado;
  const int = lado === 'interior' ? ligado : outroLigado;
  const modo: WrapMode = ext && int ? 'both' : ext ? 'exterior' : int ? 'interior' : 'none';
  return modo;
}

/** Seletor do retorno do acabamento de um lado da parede (Seguir a parede / Com retorno / Sem retorno). */
export function ClosureSideRow({ d, onChange, lado }: Pick<PanelProps, 'd' | 'onChange'> & { lado: Lado }): ReactElement {
  const atual = retornoNoLado(d.closure, lado);
  const valor = atual === null ? 'inherit' : atual ? 'on' : 'off';
  const id = lado === 'exterior' ? 'op-clos-ext' : 'op-clos-int';
  return (
    <div className="field-row">
      <label htmlFor={id} title="Retorno do acabamento da parede no vão, neste lado; 'Seguir' usa o do tipo de parede nos dois lados">Retorno do acabamento</label>
      <select
        id={id}
        className="select"
        value={valor}
        onChange={(e) => onChange({ ...d, closure: e.target.value === 'inherit' ? 'inherit' : fechamentoComLado(d.closure, lado, e.target.value === 'on') })}
      >
        <option value="inherit">Seguir o tipo de parede</option>
        <option value="on">Com retorno</option>
        <option value="off">Sem retorno</option>
      </select>
    </div>
  );
}
