import { useMemo, type ReactElement } from 'react';
import {
  DIVIDER_WIDTH_DEFAULT,
  STOP_WIDTH_DEFAULT,
  compositionIssue,
  formatQuantity,
  openingCompositionOf,
  openingProfilesOf,
  resolveProfile,
  type OpeningComposition,
  type ProfileMaterial,
  type ProfileRef,
  type ProfileRole,
  type ProfileSection,
  type ResolvedUnits,
} from '@hestia/model';
import { useProject } from '../../../../editor/controller.ts';
import { useUnits } from '../../../useUnits.ts';
import { NumField } from '../../../fields.tsx';
import type { PanelProps } from '../panels/panelKit.tsx';
import { ajustarCampo, aValidar, comBatente, comDivisor, divisores, fonteDaRef, presetsParaPapel, trocarPreset, type Profiles } from './profileControls.ts';

const MATERIAIS: Record<ProfileMaterial, string> = { wood: 'Madeira', aluminum: 'Alumínio', pvc: 'PVC', glass: 'Vidro' };
const SECOES: Record<ProfileSection, string> = {
  rect: 'Retângulo',
  rect_rebate: 'Retângulo com rebaixo',
  L: 'L',
  T: 'T',
  chambered: 'Com câmaras',
  none: 'Sem perfil',
};

/** Presets do projeto, com o mapa recalculado só quando o projeto muda. */
export function useOpeningProfiles(): Profiles {
  const projeto = useProject();
  return useMemo(() => openingProfilesOf(projeto), [projeto]);
}

/** Marca "a validar" ao lado do campo que o preset não confirma (R2). */
export function Validar({ on }: { on: boolean }): ReactElement | null {
  return on ? <span className="hint"> a validar</span> : null;
}

interface PerfilRowsProps {
  id: string;
  titulo: string;
  papel: ProfileRole;
  /** Referência do perfil; ausente = divisor no padrão (sem campos para editar). */
  valor: ProfileRef | undefined;
  perfis: Profiles;
  units: ResolvedUnits;
  onChange: (next: ProfileRef | undefined) => void;
  /** O divisor pode voltar ao padrão do modelo. */
  comPadrao?: boolean;
}

/** Um perfil do quadro: preset, campos de sobreposição (`override`) e leitura de material, seção e fonte. */
function PerfilRows({ id, titulo, papel, valor, perfis, units, onChange, comPadrao }: PerfilRowsProps): ReactElement {
  const presets = presetsParaPapel(papel, perfis);
  const select = valor === undefined ? '' : 'presetId' in valor ? valor.presetId : 'inline';
  return (
    <>
      <div className="field-row">
        <label htmlFor={`${id}-preset`} title={`Perfil do ${titulo.toLowerCase()} (presets do projeto)`}>{titulo}</label>
        <select
          id={`${id}-preset`}
          className="select"
          value={select}
          onChange={(e) => onChange(e.target.value === '' ? undefined : trocarPreset(e.target.value))}
        >
          {comPadrao ? <option value="">Padrão do divisor</option> : null}
          {valor && 'inline' in valor ? <option value="inline">Perfil próprio do tipo</option> : null}
          {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {valor === undefined ? (
        <p className="hint">Divisor no padrão: largura {formatQuantity(units, 'smallLength', DIVIDER_WIDTH_DEFAULT, { decimals: 1, trim: true })}, material do batente.</p>
      ) : (
        <>
          <div className="field-row">
            <label htmlFor={`${id}-w`} title="Largura visível na face da parede (o J do motor)">Largura visível<Validar on={aValidar(valor, perfis, 'visibleWidth')} /></label>
            <NumField id={`${id}-w`} value={resolveProfile(valor, perfis).visibleWidth} quantity="smallLength" min={0} onCommit={(v) => onChange(ajustarCampo(valor, perfis, 'visibleWidth', v))} />
          </div>
          <div className="field-row">
            <label htmlFor={`${id}-d`} title="Profundidade na direção da parede (vale só com profundidade 'fixa' no quadro)">Profundidade<Validar on={aValidar(valor, perfis, 'depth')} /></label>
            <NumField id={`${id}-d`} value={resolveProfile(valor, perfis).depth} quantity="smallLength" min={0} onCommit={(v) => onChange(ajustarCampo(valor, perfis, 'depth', v))} />
          </div>
          <div className="field-row">
            <label htmlFor={`${id}-s`} title="Batedor: lábio que encosta na folha (seções com rebaixo, L e T)">Batedor<Validar on={aValidar(valor, perfis, 'stopWidth')} /></label>
            <NumField id={`${id}-s`} value={resolveProfile(valor, perfis).stopWidth ?? STOP_WIDTH_DEFAULT} quantity="smallLength" min={0} onCommit={(v) => onChange(ajustarCampo(valor, perfis, 'stopWidth', v))} />
          </div>
          <div className="field-row">
            <label>Material e seção</label>
            <span>
              {MATERIAIS[resolveProfile(valor, perfis).material]} · {SECOES[resolveProfile(valor, perfis).section]}
              <Validar on={aValidar(valor, perfis, 'section')} />
            </span>
          </div>
          <p className="hint">Fonte: {fonteDaRef(valor, perfis)}</p>
        </>
      )}
    </>
  );
}

/** Perfis do quadro: batente e divisores (cada divisão interna da composição). Escreve em `composition` do tipo. */
export function ProfilePanel({ d, onChange }: PanelProps): ReactElement {
  const units = useUnits();
  const perfis = useOpeningProfiles();
  const c: OpeningComposition = openingCompositionOf(d);
  const grava = (next: OpeningComposition): void => onChange({ ...d, composition: next });
  const erro = compositionIssue(c, perfis);
  return (
    <>
      <PerfilRows id="op-pf-batente" titulo="Batente" papel="frame" valor={c.frame.profile} perfis={perfis} units={units} onChange={(r) => r && grava(comBatente(c, r))} />
      {divisores(c.layout).map((s, i) => (
        <PerfilRows
          key={s.id}
          id={`op-pf-div-${s.id}`}
          titulo={`Divisor ${i + 1} (${s.axis === 'cols' ? 'montante' : 'travessa'})`}
          papel="divider"
          valor={s.divider}
          perfis={perfis}
          units={units}
          comPadrao
          onChange={(r) => grava(comDivisor(c, s.id, r))}
        />
      ))}
      {erro ? <p className="error" role="alert">{erro}</p> : null}
    </>
  );
}
