import type { ReactElement } from 'react';
import { wallTypeUsage } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';

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
                <button
                  key={t.id}
                  className={`leaf${s.options.wallTypeId === t.id ? ' on' : ''}`}
                  title="Clique para usar este tipo ao desenhar. Duplo clique edita o tipo."
                  onClick={() => useUi.setState({ options: { ...s.options, wallTypeId: t.id } })}
                  onDoubleClick={() => useUi.setState({ dialog: 'wallType', dialogArg: t.id })}
                >
                  <Icon name="wall" size={14} /> {t.name}
                  <span className="meta">{wallTypeUsage(p, t.id)}</span>
                </button>
              ))}
            </details>
            <details>
              <summary>Portas</summary>
              {doors.map((t) => (
                <button key={t.id} className={`leaf${s.options.doorTypeId === t.id ? ' on' : ''}`} onClick={() => useUi.setState({ options: { ...s.options, doorTypeId: t.id } })} onDoubleClick={() => useUi.setState({ dialog: 'openingType', dialogArg: t.id })}>
                  <Icon name="door" size={14} /> {t.name}
                </button>
              ))}
            </details>
            <details>
              <summary>Janelas</summary>
              {windows.map((t) => (
                <button key={t.id} className={`leaf${s.options.windowTypeId === t.id ? ' on' : ''}`} onClick={() => useUi.setState({ options: { ...s.options, windowTypeId: t.id } })} onDoubleClick={() => useUi.setState({ dialog: 'openingType', dialogArg: t.id })}>
                  <Icon name="window" size={14} /> {t.name}
                </button>
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
          </div>
        </details>
      </div>
    </aside>
  );
}
