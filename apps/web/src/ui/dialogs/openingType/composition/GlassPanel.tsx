import { useState, type ReactElement } from 'react';
import {
  FRAMELESS_CLEARANCE_DEFAULT,
  GLASS_REBATE_DEFAULTS,
  compositionIssue,
  openingCompositionOf,
  resolveProfile,
  type GlassSpec,
  type OpeningComposition,
  type OpeningGlassKind,
} from '@hestia/model';
import { NumField } from '../../../fields.tsx';
import { GLASS_KINDS } from '../openingTypeControls.ts';
import type { PanelProps } from '../panels/panelKit.tsx';
import { aValidar, ajustarRebaixo, comBatente, comVidro, vidros } from './profileControls.ts';
import { Validar, useOpeningProfiles } from './ProfilePanel.tsx';

/**
 * Vidro das células de vidro da composição: tipo, espessura e montagem. O rebaixo é do perfil do batente (a validar);
 * sem perfil (frameless) a folga é a do modelo, sem campo no contrato.
 */
export function GlassPanel({ d, onChange }: PanelProps): ReactElement {
  const perfis = useOpeningProfiles();
  const c: OpeningComposition = openingCompositionOf(d);
  const grava = (next: OpeningComposition): void => onChange({ ...d, composition: next });
  const celulas = vidros(c);
  const [escolhida, setEscolhida] = useState<string | undefined>(undefined);
  const cel = celulas.find((x) => x.id === escolhida) ?? celulas[0];
  const vidro: GlassSpec | undefined = cel && cel.content.kind === 'glass' ? cel.content.glass : undefined;
  const erro = compositionIssue(c, perfis);
  if (!cel || !vidro) {
    return (
      <>
        <p className="hint">Esta composição não tem célula de vidro.</p>
        {erro ? <p className="error" role="alert">{erro}</p> : null}
      </>
    );
  }
  const batente = c.frame.profile;
  const rebaixo = resolveProfile(batente, perfis).glassRebate ?? GLASS_REBATE_DEFAULTS;
  const semPerfil = vidro.mounting === 'frameless';
  const comRebaixo = (patch: Parameters<typeof ajustarRebaixo>[2]): void => grava(comBatente(c, ajustarRebaixo(batente, perfis, patch)));
  return (
    <>
      {celulas.length > 1 ? (
        <div className="field-row">
          <label htmlFor="op-gl-cell">Célula de vidro</label>
          <select id="op-gl-cell" className="select" value={cel.id} onChange={(e) => setEscolhida(e.target.value)}>
            {celulas.map((x, i) => <option key={x.id} value={x.id}>Vidro {i + 1}</option>)}
          </select>
        </div>
      ) : null}
      <div className="field-row">
        <label htmlFor="op-gl-kind">Tipo de vidro</label>
        <select id="op-gl-kind" className="select" value={vidro.kind} onChange={(e) => grava(comVidro(c, cel.id, { kind: e.target.value as OpeningGlassKind }))}>
          {GLASS_KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="op-gl-t">Espessura do vidro</label>
        <NumField id="op-gl-t" value={vidro.thickness} scale={100} decimals={1} unit="cm" min={0.001} onCommit={(v) => grava(comVidro(c, cel.id, { thickness: v }))} />
      </div>
      <div className="field-row">
        <label htmlFor="op-gl-mount" title="Com rebaixo: o vidro entra no perfil do batente. Sem perfil: vidro temperado colado por folga">Montagem</label>
        <select id="op-gl-mount" className="select" value={vidro.mounting} onChange={(e) => grava(comVidro(c, cel.id, { mounting: e.target.value as GlassSpec['mounting'] }))}>
          <option value="rebate">Com rebaixo no perfil</option>
          <option value="frameless">Sem perfil (frameless)</option>
        </select>
      </div>
      <h4 className="op-subtitle">Rebaixo do perfil (batente)</h4>
      <div className="field-row">
        <label htmlFor="op-gl-rd" title="Quanto do vidro entra no perfil, no plano da folha">Profundidade do rebaixo<Validar on={aValidar(batente, perfis, 'glassRebate')} /></label>
        <NumField id="op-gl-rd" value={rebaixo.depth} scale={100} decimals={1} unit="cm" min={0} disabled={semPerfil} onCommit={(v) => comRebaixo({ depth: v })} />
      </div>
      <div className="field-row">
        <label htmlFor="op-gl-rc" title="Folga entre o vidro e o fundo do rebaixo">Folga do rebaixo<Validar on={aValidar(batente, perfis, 'glassRebate')} /></label>
        <NumField id="op-gl-rc" value={rebaixo.clearance} scale={1000} decimals={1} unit="mm" min={0} disabled={semPerfil} onCommit={(v) => comRebaixo({ clearance: v })} />
      </div>
      <div className="field-row">
        <label htmlFor="op-gl-bead" title="Largura visível do baguete (peça de fixação); 0 = sem baguete">Baguete<Validar on={aValidar(batente, perfis, 'glassRebate')} /></label>
        <NumField id="op-gl-bead" value={rebaixo.bead} scale={100} decimals={1} unit="cm" min={0} disabled={semPerfil} onCommit={(v) => comRebaixo({ bead: v })} />
      </div>
      <div className="field-row">
        <label htmlFor="op-gl-free" title="Folga do vidro temperado sem perfil ao redor e à ferragem de canto">Folga do vidro sem perfil</label>
        <NumField id="op-gl-free" value={FRAMELESS_CLEARANCE_DEFAULT} scale={1000} decimals={0} unit="mm" disabled onCommit={() => undefined} />
      </div>
      <p className="hint">Rebaixo, folga e baguete são a validar (R2 não confirma). A folga sem perfil é o padrão do modelo.</p>
      {erro ? <p className="error" role="alert">{erro}</p> : null}
    </>
  );
}
