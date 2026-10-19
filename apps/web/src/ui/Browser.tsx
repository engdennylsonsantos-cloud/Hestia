import type { ReactElement } from 'react';
import { isWall } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';
import { TypeRow } from './TypeRow.tsx';

/** Navegador de projeto: vistas, famílias (tipos) e materiais, como a árvore do Revit. */
export function Browser(): ReactElement {
  const p = useProject();
  const s = useUi();
  const walls = Object.values(p.wallTypes);
  const doors = Object.values(p.openingTypes).filter((t) => t.kind === 'door');
  const windows = Object.values(p.openingTypes).filter((t) => t.kind === 'window');
  return (
    <aside className="side right" aria-label="Navegador de projeto">
      <div className="panel-head">
        <span>Navegador de projeto</span>
      </div>
      <div className="panel-scroll tree">
        <details open>
          <summary>Vistas</summary>
          <div className="sub">
            <details open>
              <summary>Plantas</summary>
              {p.levels.map((l) => (
                <button key={l.id} className={`leaf${s.view === 'plan' && s.levelId === l.id ? ' on' : ''}`} onClick={() => editor.selectLevel(l.id)}>
                  <Icon name="plan" size={14} /> {l.name}
                  <span className="meta">{l.elevation.toFixed(2).replace('.', ',')} m</span>
                </button>
              ))}
            </details>
            <details open>
              <summary>3D</summary>
              <button className={`leaf${s.view === '3d' ? ' on' : ''}`} onClick={() => editor.setView('3d')}>
                <Icon name="cube" size={14} /> Modelo 3D
              </button>
            </details>
          </div>
        </details>
        <details open>
          <summary>Famílias</summary>
          <div className="sub">
            <details open>
              <summary>Paredes</summary>
              {walls.map((t) => (
                <TypeRow
                  key={t.id}
                  kind="wall"
                  typeId={t.id}
                  name={t.name}
                  icon="wall"
                  active={s.options.wallTypeId === t.id}
                  onUse={() => useUi.setState((st) => ({ options: { ...st.options, wallTypeId: t.id } }))}
                  onEdit={() => useUi.setState({ dialog: 'wallType', dialogArg: t.id })}
                />
              ))}
            </details>
            <details>
              <summary>Portas</summary>
              {doors.map((t) => (
                <TypeRow
                  key={t.id}
                  kind="door"
                  typeId={t.id}
                  name={t.name}
                  icon="door"
                  active={s.options.doorTypeId === t.id}
                  onUse={() => useUi.setState((st) => ({ options: { ...st.options, doorTypeId: t.id } }))}
                  onEdit={() => useUi.setState({ dialog: 'openingType', dialogArg: t.id })}
                />
              ))}
            </details>
            <details>
              <summary>Janelas</summary>
              {windows.map((t) => (
                <TypeRow
                  key={t.id}
                  kind="window"
                  typeId={t.id}
                  name={t.name}
                  icon="window"
                  active={s.options.windowTypeId === t.id}
                  onUse={() => useUi.setState((st) => ({ options: { ...st.options, windowTypeId: t.id } }))}
                  onEdit={() => useUi.setState({ dialog: 'openingType', dialogArg: t.id })}
                />
              ))}
            </details>
          </div>
        </details>
        <details open>
          <summary>Projeto</summary>
          <div className="sub">
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'materials', dialogArg: null })}>
              <Icon name="layers" size={14} /> Materiais
              <span className="meta">{Object.keys(p.materials).length}</span>
            </button>
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'levels' })}>
              <Icon name="levels" size={14} /> Níveis
              <span className="meta">{p.levels.length}</span>
            </button>
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'schedule', dialogArg: null })}>
              <Icon name="file" size={14} /> Tabela de paredes
              <span className="meta">{Object.values(p.elements).filter(isWall).length}</span>
            </button>
          </div>
        </details>
      </div>
    </aside>
  );
}
