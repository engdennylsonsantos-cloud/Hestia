import type { ReactElement } from 'react';
import { DEFAULT_RAMP_OPTIONS, type RampToolOptions } from '@hestia/tools';
import { formatRampRatio, type RampInputMode, type RampShape } from '@hestia/model';
import { useProject } from '../editor/controller.ts';
import { useI18n, I18N } from '../editor/i18n.ts';
import { useUi } from '../editor/state.ts';
import { NumField } from './fields.tsx';

const SHAPE_LABEL: Record<RampShape, string> = { straight: 'Reta', lshape: 'Em L', ushape: 'Em U' };

/**
 * Barra da ferramenta Rampa: forma (reta, L, U), largura, giro e profundidade do patamar (L/U), modo de entrada e, no
 * modo inclinação, o valor em % com a razão `1:X` ao lado. Campos vazios usam o padrão do tipo.
 */
export function RampOptionsBar(): ReactElement {
  const p = useProject();
  const t = I18N[useI18n((s) => s.lang)];
  const options = useUi((s) => s.options);
  const o: RampToolOptions = options.ramp ?? DEFAULT_RAMP_OPTIONS;
  const set = (patch: Partial<RampToolOptions>): void => {
    const cur = useUi.getState().options;
    useUi.setState({ options: { ...cur, ramp: { ...(cur.ramp ?? DEFAULT_RAMP_OPTIONS), ...patch } } });
  };
  const typeId = o.typeId && p.rampTypes[o.typeId] ? o.typeId : (Object.keys(p.rampTypes)[0] ?? '');
  const type = p.rampTypes[typeId];
  const turnable = o.shape !== 'straight';
  const slope = o.slope ?? type?.defaultSlope ?? 0;
  return (
    <>
      <label>
        Forma
        <select id="opt-rampshape" className="select" value={o.shape} onChange={(e) => set({ shape: e.target.value as RampShape })}>
          {(Object.keys(SHAPE_LABEL) as RampShape[]).map((s) => <option key={s} value={s}>{SHAPE_LABEL[s]}</option>)}
        </select>
      </label>
      <label>
        Largura
        <NumField
          id="opt-rampwidth"
          value={o.width ?? null}
          placeholder={type ? type.defaultWidth.toFixed(2).replace('.', ',') : undefined}
          unit="m"
          min={0.1}
          onCommit={(v) => set({ width: v })}
          onClear={() => set({ width: undefined })}
        />
      </label>
      {turnable && (
        <label>
          Giro
          <select id="opt-rampturn" className="select" value={o.turn} onChange={(e) => set({ turn: e.target.value as 'left' | 'right' })}>
            <option value="left">À esquerda</option>
            <option value="right">À direita</option>
          </select>
        </label>
      )}
      {turnable && (
        <label>
          Profundidade do patamar
          <NumField
            id="opt-ramplanding"
            value={o.landingDepth ?? null}
            placeholder={type ? Math.max(o.width ?? type.defaultWidth, type.landingMinLength).toFixed(2).replace('.', ',') : undefined}
            unit="m"
            min={0.1}
            onCommit={(v) => set({ landingDepth: v })}
            onClear={() => set({ landingDepth: undefined })}
          />
        </label>
      )}
      <label>
        Modo de entrada
        <select id="opt-rampmode" className="select" value={o.mode} onChange={(e) => set({ mode: e.target.value as RampInputMode })}>
          <option value="length">{t.ramp_mode_length}</option>
          <option value="slope">{t.ramp_mode_slope}</option>
        </select>
      </label>
      {o.mode === 'slope' && (
        <label>
          {t.ramp_prop_slope_target}
          <NumField id="opt-rampslope" value={slope} scale={100} unit="%" decimals={2} min={0.1} onCommit={(v) => set({ slope: v })} />
          <span className="hint" style={{ marginLeft: 6 }}>{formatRampRatio(slope)}</span>
        </label>
      )}
      <label>
        Tipo
        <select id="opt-ramptype" className="select" value={typeId} onChange={(e) => set({ typeId: e.target.value })}>
          {Object.values(p.rampTypes).map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </select>
      </label>
    </>
  );
}
