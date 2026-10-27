import type { ReactElement } from 'react';
import { useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { NumField } from './fields.tsx';

/**
 * Opções das ferramentas Laje (tipo e deslocamento do topo) e Inclinação (percentual). A inclinação só aparece na
 * ferramenta Inclinação: a laje não a usa (sai com `slope: null`). Fica fora do OptionsBar para que a barra principal só
 * repasse a escolha da ferramenta.
 */
export function SlabOptionsBar({ tool }: { tool: 'slab' | 'slope' }): ReactElement {
  const p = useProject();
  const o = useUi((s) => s.options);
  const set = (patch: Partial<typeof o>): void => useUi.setState({ options: { ...useUi.getState().options, ...patch } });
  const slope = (
    <label>
      Inclinação
      <NumField id="opt-slope" value={o.slabSlopePercent} onCommit={(v) => set({ slabSlopePercent: v })} unit="%" />
    </label>
  );
  if (tool === 'slope') {
    return (
      <>
        {slope}
        <span className="hint">Clique na origem e na direção do caimento. Enter aplica o percentual.</span>
      </>
    );
  }
  return (
    <>
      <label>
        Tipo
        <select id="opt-slabtype" className="select" value={o.slabTypeId} onChange={(e) => set({ slabTypeId: e.target.value })}>
          {Object.values(p.slabTypes).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <label>
        Deslocamento do topo
        <NumField id="opt-slaboffset" value={o.slabOffset} onCommit={(v) => set({ slabOffset: v })} unit="m" />
      </label>
    </>
  );
}
