import type { ReactElement } from 'react';
import type { WallType } from '@hestia/model';
import { NumField, TextField } from '../fields.tsx';

interface OptionalProps {
  id: string;
  label: string;
  value: number | null;
  decimals: number;
  unit: string;
  min?: number;
  onChange: (v: number | null) => void;
}

/** Campo numérico opcional: a caixa marca se o valor foi informado (null = não informado). */
function OptionalNum({ id, label, value, decimals, unit, min, onChange }: OptionalProps): ReactElement {
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" aria-label={`${label} informado`} checked={value !== null} onChange={(e) => onChange(e.target.checked ? 0 : null)} />
        {value !== null ? (
          <NumField id={id} value={value} decimals={decimals} unit={unit} min={min} onCommit={(v) => onChange(v)} />
        ) : (
          <span className="hint">não informado</span>
        )}
      </span>
    </div>
  );
}

/** Parâmetros de desempenho e custo do tipo de parede (G3). Campos ausentes em arquivos antigos contam como não informados. */
export function TypeParams({ type, onChange }: { type: WallType; onChange: (patch: Partial<WallType>) => void }): ReactElement {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
      <legend style={{ color: 'var(--fg-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Desempenho e custo</legend>
      <div className="field-row">
        <label htmlFor="wt-cost" title="Custo por metro quadrado de face de parede, usado em estimativas">Custo</label>
        <NumField id="wt-cost" value={type.cost ?? 0} quantity="currency" min={0} onCommit={(v) => onChange({ cost: v })} />
      </div>
      {/* units-ok: unidade técnica de transmitância */}
      <OptionalNum id="wt-u" label="Transmitância U" value={type.thermalU ?? null} decimals={2} unit="W/m²K" min={0} onChange={(v) => onChange({ thermalU: v })} />
      <OptionalNum id="wt-rw" label="Isolamento Rw" value={type.acousticRw ?? null} decimals={0} unit="dB" min={0} onChange={(v) => onChange({ acousticRw: v })} />
      <OptionalNum id="wt-fire" label="Resistência ao fogo" value={type.fireRating ?? null} decimals={0} unit="min" min={0} onChange={(v) => onChange({ fireRating: v })} />
      <div className="field-row">
        <label htmlFor="wt-mfr">Fabricante</label>
        <TextField id="wt-mfr" value={type.manufacturer ?? ''} placeholder="Sistema ou fabricante de referência" onCommit={(v) => onChange({ manufacturer: v })} />
      </div>
    </fieldset>
  );
}
