import { Fragment, type ReactElement } from 'react';
import { newId, type Material, type WallStrip } from '@hestia/model';
import { NumField, TextField } from '../fields.tsx';
import { Icon } from '../Icon.tsx';

type Draft = Omit<WallStrip, 'id'>;

const SIDES: Array<[WallStrip['side'], string]> = [['exterior', 'Externo'], ['interior', 'Interno']];

const PRESETS: Array<{ label: string; strip: Draft }> = [
  { label: 'Rodapé 10 cm', strip: { name: 'Rodapé', side: 'interior', materialId: 'mat_madeira', thickness: 0.02, z0: 0, z1: 0.1 } },
  { label: 'Barra de azulejo 1,50 m', strip: { name: 'Barra de azulejo', side: 'interior', materialId: 'mat_ceramica', thickness: 0.01, z0: 0, z1: 1.5 } },
  { label: 'Friso externo', strip: { name: 'Friso', side: 'exterior', materialId: 'mat_argamassa', thickness: 0.02, z0: 2.4, z1: 2.6 } },
];

/** Mensagem de erro de uma faixa, ou `null` quando ela é válida. Usada também pelo diálogo para bloquear o OK. */
export function stripError(s: WallStrip): string | null {
  if (!(s.z1 > s.z0)) return 'a altura final deve ser maior que a inicial.';
  if (!(s.thickness > 0)) return 'a espessura deve ser maior que zero.';
  return null;
}

interface StripsTabProps {
  strips: WallStrip[];
  materials: Record<string, Material>;
  onChange: (next: WallStrip[]) => void;
  /** Abre o navegador de materiais para a faixa de índice `index`; quem escolhe é o diálogo pai. */
  onPickMaterial: (index: number) => void;
}

/** Aba "Faixas" do tipo de parede: edita `draft.strips` (rascunho local; grava só no OK do diálogo). */
export function StripsTab({ strips, materials, onChange, onPickMaterial }: StripsTabProps): ReactElement {
  const update = (i: number, patch: Partial<WallStrip>): void => onChange(strips.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const remove = (i: number): void => onChange(strips.filter((_, k) => k !== i));
  const add = (strip: Draft): void => onChange([...strips, { id: newId('st'), ...strip }]);
  const addBlank = (): void => add({ name: 'Faixa', side: 'interior', materialId: Object.keys(materials)[0] ?? '', thickness: 0.01, z0: 0, z1: 0.1 });
  return (
    <div>
      <p className="hint strips-help">
        Faixas ficam fora da espessura da parede, entre as alturas indicadas. O rodapé só aparece em planta se atravessar o plano de corte (1,20 m); no 3D e nos quantitativos sempre aparece.
      </p>
      <div className="strips-presets" role="group" aria-label="Presets de faixa">
        {PRESETS.map((p, k) => (
          <button key={p.label} id={`st-preset-${k}`} className="btn small" onClick={() => add(p.strip)}>{p.label}</button>
        ))}
      </div>
      <div className="strips-scroll">
        <table className="layers strips-table">
          <thead>
            <tr><th>Nome</th><th>Lado</th><th>Material</th><th>Espessura (cm)</th><th>Altura inicial (cm)</th><th>Altura final (cm)</th><th /></tr>
          </thead>
          <tbody>
            {strips.length === 0 && (
              <tr><td colSpan={7} className="strips-empty">Nenhuma faixa neste tipo.</td></tr>
            )}
            {strips.map((s, i) => {
              const m = materials[s.materialId];
              const err = stripError(s);
              return (
                <Fragment key={s.id}>
                  <tr>
                    <td><TextField id={`st-${s.id}-nome`} value={s.name} onCommit={(v) => update(i, { name: v })} /></td>
                    <td>
                      <select id={`st-${s.id}-lado`} className="select" aria-label={`Lado da faixa ${i + 1}`} value={s.side} onChange={(e) => update(i, { side: e.target.value as WallStrip['side'] })}>
                        {SIDES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td>
                      <button id={`st-${s.id}-mat`} className="btn small strip-mat" onClick={() => onPickMaterial(i)} title="Escolher material">
                        <span className="swatch" style={{ background: m?.color }} />
                        <span className="strip-mat-name">{m?.name ?? '—'}</span>
                      </button>
                    </td>
                    {/* min em metros: 0,001 m = 0,1 cm */}
                    <td><NumField id={`st-${s.id}-esp`} value={s.thickness} scale={100} decimals={1} min={0.001} onCommit={(v) => update(i, { thickness: v })} /></td>
                    <td><NumField id={`st-${s.id}-de`} value={s.z0} scale={100} decimals={1} min={0} onCommit={(v) => update(i, { z0: v })} /></td>
                    <td><NumField id={`st-${s.id}-ate`} value={s.z1} scale={100} decimals={1} min={0} onCommit={(v) => update(i, { z1: v })} /></td>
                    <td>
                      <button id={`st-${s.id}-del`} className="ibtn" onClick={() => remove(i)} aria-label={`Remover faixa ${i + 1}`}><Icon name="close" size={14} /></button>
                    </td>
                  </tr>
                  {err && (
                    <tr className="strip-err">
                      <td colSpan={7} role="alert">Faixa {i + 1}: {err}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="strips-foot">
        <button id="st-add" className="btn small" onClick={addBlank}>+ Adicionar faixa</button>
      </div>
    </div>
  );
}
