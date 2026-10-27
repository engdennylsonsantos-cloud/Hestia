import type { ReactElement } from 'react';
import { projectGridTypes } from '@hestia/model';
import type { GridMode, GridToolOptions } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { GRID_MODES, gridToolOf } from './gridUi.ts';

/** Barra da ferramenta Grade: modo de desenho e tipo. Trocar o modo recomeça o desenho em andamento (como o Piso). */
export function GridOptionsBar(): ReactElement {
  const p = useProject();
  const o = useUi((s) => s.options);
  const g = gridToolOf(o, p);
  const types = projectGridTypes(p);
  const setGrid = (patch: Partial<GridToolOptions>): void => {
    useUi.setState({ options: { ...useUi.getState().options, grid: { ...g, ...patch } } });
  };
  const trocaModo = (mode: GridMode): void => {
    setGrid({ mode });
    editor.setTool('grid');
  };
  return (
    <>
      <label>
        Modo
        <select id="opt-gridmode" className="select" value={g.mode} onChange={(e) => trocaModo(e.target.value as GridMode)}>
          {GRID_MODES.map((m) => <option key={m.mode} value={m.mode}>{m.label}</option>)}
        </select>
      </label>
      <label>
        Tipo
        <select id="opt-gridtype" className="select" value={g.typeId} onChange={(e) => setGrid({ typeId: e.target.value })}>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <button id="opt-gridtype-edit" className="btn small" onClick={() => useUi.setState({ dialog: 'gridType', dialogArg: g.typeId })}>
        Editar tipo…
      </button>
    </>
  );
}
