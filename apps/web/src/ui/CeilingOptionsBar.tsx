import type { ReactElement } from 'react';
import type { CeilingMode } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { addCeilingsAllRooms } from '../editor/ceilingRoomActions.ts';
import { NumField } from './fields.tsx';

const MODES: Array<[CeilingMode, string]> = [
  ['poly', 'Contorno por pontos'],
  ['rect', 'Retângulo (2 cantos)'],
  ['room', 'No ambiente (clique no ambiente)'],
  ['hole', 'Furo (forro selecionado)'],
];

/** Opções da ferramenta Forro: tipo, modo e cota do topo. Fica fora do OptionsBar, como a da laje. */
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
        Modo
        <select
          id="opt-ceilingmode"
          className="select"
          value={o.ceilingMode ?? 'poly'}
          onChange={(e) => {
            // Trocar o modo reinicia o desenho em andamento (o modo é lido pela ferramenta a cada passo).
            set({ ceilingMode: e.target.value as CeilingMode });
            editor.setTool('ceiling');
          }}
        >
          {MODES.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        Cota do topo
        <NumField id="opt-ceilingoffset" value={o.ceilingOffset ?? 2.6} onCommit={(v) => set({ ceilingOffset: v })} unit="m" />
      </label>
      <button id="opt-ceilingall" className="btn small" onClick={() => addCeilingsAllRooms()} title="Cria um forro em cada ambiente de circuito fechado do nível que ainda não tem forro; um só Ctrl+Z desfaz tudo">
        Forro em todos os ambientes
      </button>
    </>
  );
}
