import type { ReactElement } from 'react';
import { useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { addCeilingsAllRooms } from '../editor/ceilingRoomActions.ts';
import { NumField } from './fields.tsx';

/** Opções da ferramenta Forro: tipo e cota do topo, e o forro em todos os ambientes. Fica fora do OptionsBar, como a da laje. */
export function CeilingOptionsBar(): ReactElement {
  const p = useProject();
  const o = useUi((s) => s.options);
  const set = (patch: Partial<typeof o>): void => useUi.setState({ options: { ...useUi.getState().options, ...patch } });
  return (
    <>
      <label>
        Tipo
        <select id="opt-ceilingtype" className="select" value={o.ceilingTypeId ?? ''} onChange={(e) => set({ ceilingTypeId: e.target.value })}>
          {Object.values(p.ceilingTypes).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <label>
        Cota do topo
        <NumField id="opt-ceilingoffset" value={o.ceilingOffset ?? 2.6} onCommit={(v) => set({ ceilingOffset: v })} quantity="length" />
      </label>
      <button id="opt-ceilingall" className="btn small" onClick={() => addCeilingsAllRooms()} title="Cria um forro em cada ambiente de circuito fechado do nível que ainda não tem forro; um só Ctrl+Z desfaz tudo">
        Forro em todos os ambientes
      </button>
    </>
  );
}
