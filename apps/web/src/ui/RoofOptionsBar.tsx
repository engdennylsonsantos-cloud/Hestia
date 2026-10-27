import type { ReactElement } from 'react';
import { percentToDeg, roofAutoOffset, roofSlopeFromDegField } from '@hestia/tools';
import { useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { NumField } from './fields.tsx';

/**
 * Opções da ferramenta Telhado: tipo, inclinação (% e graus, convertidos entre si), balanço do beiral e cota do beiral.
 * Cota "Automática" usa a altura da parede mais alta do nível (2,8 m sem paredes). A forma não é opção: o telhado nasce
 * do perímetro, e a forma de um telhado existente se troca nas Propriedades.
 */
export function RoofOptionsBar(): ReactElement {
  const p = useProject();
  const o = useUi((s) => s.options);
  const levelId = useUi((s) => s.levelId);
  const set = (patch: Partial<typeof o>): void => useUi.setState({ options: { ...useUi.getState().options, ...patch } });
  const slope = o.roofSlope ?? 30;
  const offsetAuto = roofAutoOffset(p, levelId);
  return (
    <>
      <label>
        Tipo
        <select id="opt-rooftype" className="select" value={o.roofTypeId ?? ''} onChange={(e) => set({ roofTypeId: e.target.value })}>
          {Object.values(p.roofTypes).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <label>
        Inclinação
        <NumField id="opt-roofslope" value={slope} onCommit={(v) => set({ roofSlope: v })} unit="%" min={0.1} max={200} />
      </label>
      <label>
        Graus
        <NumField id="opt-roofdeg" value={percentToDeg(slope)} decimals={1} unit="°" min={0.1} max={63.4} onCommit={(v) => set({ roofSlope: roofSlopeFromDegField(v, percentToDeg(slope), slope) })} />
      </label>
      <label>
        Balanço
        <NumField id="opt-roofoverhang" value={o.roofOverhang ?? 0.5} onCommit={(v) => set({ roofOverhang: v })} unit="m" min={0} />
      </label>
      <label>
        Cota do beiral
        <NumField id="opt-roofoffset" value={o.roofOffset ?? offsetAuto} onCommit={(v) => set({ roofOffset: v })} unit="m" />
      </label>
      {o.roofOffset !== null && o.roofOffset !== undefined && (
        <button type="button" className="btn" onClick={() => set({ roofOffset: null })} title="Volta à altura da parede mais alta do nível">
          Automática
        </button>
      )}
      <span className="hint">Criar e editar o perímetro pela faixa. Depois de criado, cada aresta se edita na planta.</span>
    </>
  );
}
