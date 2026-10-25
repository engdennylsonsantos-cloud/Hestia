import type { ReactElement } from 'react';
import { roomCeilingHeight, roomsOnLevel } from '@hestia/model';
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
  const levelId = useUi((s) => s.levelId);
  const o = useUi((s) => s.options);
  const set = (patch: Partial<typeof o>): void => useUi.setState({ options: { ...useUi.getState().options, ...patch } });
  // Modo "No ambiente": o forro usa o pé-direito de cada ambiente (decisão 0021 §4), então a cota do campo não vale aqui.
  // Mostra o pé-direito do nível quando todos os ambientes têm o mesmo; senão, avisa que cada ambiente tem o seu.
  const mode = o.ceilingMode ?? 'poly';
  const heights = [...new Set(roomsOnLevel(p, levelId).map((r) => roomCeilingHeight(p, r)))];
  const roomHint = heights.length === 1 ? `usa o pé-direito do ambiente: ${heights[0]!.toFixed(2).replace('.', ',')} m` : 'usa o pé-direito de cada ambiente';
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
        <NumField id="opt-ceilingoffset" value={mode === 'room' && heights.length === 1 ? heights[0]! : o.ceilingOffset ?? 2.6} onCommit={(v) => set({ ceilingOffset: v })} unit="m" disabled={mode === 'room'} />
      </label>
      {mode === 'room' && <span className="hint">{roomHint}</span>}
      <button id="opt-ceilingall" className="btn small" onClick={() => addCeilingsAllRooms()} title="Cria um forro em cada ambiente de circuito fechado do nível que ainda não tem forro; um só Ctrl+Z desfaz tudo">
        Forro em todos os ambientes
      </button>
    </>
  );
}
