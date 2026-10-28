import type { ReactElement } from 'react';
import { CASING_RULES, compositionIssue, openingCompositionOf, type CasingFaces, type OpeningComposition } from '@hestia/model';
import { NumField } from '../../../fields.tsx';
import type { PanelProps } from '../panels/panelKit.tsx';
import { ALIZAR_FACES, alizarLigado, comAlizar } from './profileControls.ts';
import { useOpeningProfiles } from './ProfilePanel.tsx';

/**
 * Alizar do conjunto: faces, largura, espessura e recuo. Contorna a envoltória do conjunto (não os divisores internos).
 * Com alizar ligado, o retorno do acabamento (`closure`) fica desabilitado: o alizar cobre a face.
 */
export function CasingPanel({ d, onChange }: PanelProps): ReactElement {
  const perfis = useOpeningProfiles();
  const c: OpeningComposition = openingCompositionOf(d);
  const grava = (next: OpeningComposition): void => onChange({ ...d, composition: next });
  const k = c.casing;
  const ligado = alizarLigado(c);
  const erro = compositionIssue(c, perfis);
  return (
    <>
      <div className="field-row">
        <label htmlFor="op-cas-faces" title="Faces da parede com alizar; 'Lado da abertura' segue a folha principal">Faces</label>
        <select id="op-cas-faces" className="select" value={k?.faces ?? 'none'} onChange={(e) => grava(comAlizar(c, { faces: e.target.value as CasingFaces }))}>
          {ALIZAR_FACES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="op-cas-w" title="Largura do alizar visto de frente">Largura</label>
        <NumField id="op-cas-w" value={k?.width ?? CASING_RULES.defaultWidth} scale={100} decimals={1} unit="cm" min={0.001} disabled={!ligado} onCommit={(v) => grava(comAlizar(c, { width: v }))} />
      </div>
      <div className="field-row">
        <label htmlFor="op-cas-t" title="Espessura saliente do alizar sobre a face acabada da parede">Espessura</label>
        <NumField id="op-cas-t" value={k?.thickness ?? CASING_RULES.defaultThickness} scale={100} decimals={1} unit="cm" min={0.001} disabled={!ligado} onCommit={(v) => grava(comAlizar(c, { thickness: v }))} />
      </div>
      <div className="field-row">
        <label htmlFor="op-cas-sb" title="Recuo da aresta interna do alizar em relação à face do batente (0 = alinhada ao batente)">Recuo</label>
        <NumField id="op-cas-sb" value={k?.setback ?? CASING_RULES.defaultSetback} scale={1000} decimals={0} unit="mm" min={0} disabled={!ligado} onCommit={(v) => grava(comAlizar(c, { setback: v }))} />
      </div>
      {ligado ? (
        <>
          <div className="field-row">
            <label htmlFor="op-cas-closure" title="Retorno do acabamento na ombreira: não existe com alizar">Retorno do acabamento</label>
            <select id="op-cas-closure" className="select" value="off" disabled>
              <option value="off">Sem retorno</option>
            </select>
          </div>
          <p className="hint">Com alizar não há retorno do acabamento. Escolha faces: Nenhuma para voltar ao retorno.</p>
        </>
      ) : null}
      <p className="hint">O alizar contorna o conjunto; sem alizar nos divisores internos.</p>
      {erro ? <p className="error" role="alert">{erro}</p> : null}
    </>
  );
}
