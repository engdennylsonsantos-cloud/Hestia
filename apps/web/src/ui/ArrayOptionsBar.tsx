import type { ReactElement } from 'react';
import type { ArrayAnchor, ArrayKind } from '@hestia/tools';
import { useUi } from '../editor/state.ts';
import { NumField } from './fields.tsx';

/** Opções da ferramenta Matriz: tipo (linear ou radial), número de itens, "Mover para" e ângulo total (radial). */
export function ArrayOptionsBar(): ReactElement {
  const o = useUi((s) => s.options);
  const set = (patch: Partial<typeof o>): void => useUi.setState({ options: { ...useUi.getState().options, ...patch } });
  const radial = o.arrayKind === 'radial';
  return (
    <>
      <label>
        Tipo
        <select
          id="opt-arraykind"
          className="select"
          value={o.arrayKind ?? 'linear'}
          // Radial começa com "Último": 360° divide-se entre os itens (com "Segundo", 360° empilharia todos no mesmo lugar).
          onChange={(e) => set({ arrayKind: e.target.value as ArrayKind, ...(e.target.value === 'radial' ? { arrayAnchor: 'last' as ArrayAnchor } : {}) })}
        >
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
      </label>
      <label>
        Mover para
        <select id="opt-arrayanchor" className="select" value={o.arrayAnchor ?? 'second'} onChange={(e) => set({ arrayAnchor: e.target.value as ArrayAnchor })}>
          <option value="second">Segundo</option>
          <option value="last">Último</option>
        </select>
      </label>
      <label>
        Número de itens
        <NumField id="opt-count" value={o.arrayCount} decimals={0} onCommit={(v) => set({ arrayCount: Math.max(2, Math.round(v)) })} />
      </label>
      {radial && (
        <label>
          Ângulo total
          <NumField id="opt-arrayangle" value={o.arrayAngle ?? 360} decimals={1} unit="°" onCommit={(v) => set({ arrayAngle: v })} />
        </label>
      )}
    </>
  );
}
