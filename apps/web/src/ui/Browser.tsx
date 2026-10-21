import type { ReactElement } from 'react';
import { isFloor, isRoof, isSlab, isStair, isWall } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';
import { TypeRow } from './TypeRow.tsx';
import { ViewRow } from './ViewRow.tsx';

/** Navegador de projeto: vistas, famílias (tipos) e materiais, como a árvore do Revit. */
export function Browser(): ReactElement {
  const p = useProject();
  const s = useUi();
  const walls = Object.values(p.wallTypes);
  const doors = Object.values(p.openingTypes).filter((t) => t.kind === 'door');
  const windows = Object.values(p.openingTypes).filter((t) => t.kind === 'window');
  const floorTypes = Object.values(p.floorTypes);
  const slabTypes = Object.values(p.slabTypes);
  const roofTypes = Object.values(p.roofTypes);
  const stairTypes = Object.values(p.stairTypes);
  const sections = p.views.filter((v) => v.kind === 'section');
  const elevations = p.views.filter((v) => v.kind === 'elevation');
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
            <details open>
              <summary>Cortes</summary>
              {sections.length === 0 ? <p className="tree-empty">Nenhum corte. Use a ferramenta Corte (K) na planta.</p> : sections.map((v) => <ViewRow key={v.id} view={v} />)}
            </details>
            <details open>
              <summary>Elevações</summary>
              {elevations.map((v) => (
                <ViewRow key={v.id} view={v} />
              ))}
              <button className="leaf" onClick={() => editor.generateElevations()} title="Cria Norte, Sul, Leste e Oeste em volta das paredes do nível ativo. Substitui as elevações com o mesmo nome.">
                <Icon name="plus" size={14} /> Gerar elevações
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
            <details>
              <summary>Pisos</summary>
              {floorTypes.map((t) => (
                <TypeRow
                  key={t.id}
                  kind="floor"
                  typeId={t.id}
                  name={t.name}
                  icon="floor"
                  active={s.options.floorTypeId === t.id}
                  onUse={() => useUi.setState((st) => ({ options: { ...st.options, floorTypeId: t.id } }))}
                  onEdit={() => useUi.setState({ dialog: 'floorType', dialogArg: t.id })}
                />
              ))}
            </details>
            <details open>
              <summary>Lajes</summary>
              {slabTypes.map((t) => (
                <TypeRow
                  key={t.id}
                  kind="slab"
                  typeId={t.id}
                  name={t.name}
                  icon="slab"
                  active={s.options.slabTypeId === t.id}
                  onUse={() => useUi.setState((st) => ({ options: { ...st.options, slabTypeId: t.id } }))}
                  onEdit={() => useUi.setState({ dialog: 'slabType', dialogArg: t.id })}
                />
              ))}
            </details>
            <details open>
              <summary>Telhados</summary>
              {roofTypes.map((t) => (
                <TypeRow
                  key={t.id}
                  kind="roof"
                  typeId={t.id}
                  name={t.name}
                  icon="roof"
                  active={s.options.roofTypeId === t.id}
                  onUse={() => useUi.setState((st) => ({ options: { ...st.options, roofTypeId: t.id } }))}
                  onEdit={() => useUi.setState({ dialog: 'roofType', dialogArg: t.id })}
                />
              ))}
            </details>
            <details open>
              <summary>Escadas</summary>
              {stairTypes.map((t) => (
                <TypeRow
                  key={t.id}
                  kind="stair"
                  typeId={t.id}
                  name={t.name}
                  icon="stair"
                  active={s.options.stair?.typeId === t.id}
                  onUse={() => useUi.setState((st) => ({ options: { ...st.options, stair: { ...st.options.stair, typeId: t.id } } }))}
                  onEdit={() => useUi.setState({ dialog: 'stairType', dialogArg: t.id })}
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
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'lineWeights', dialogArg: null })} title="Tabela de pesos de linha por escala, pesos por categoria e limites de detalhe (decisão 0015)">
              <Icon name="file" size={14} /> Pesos de linha
            </button>
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'schedule', dialogArg: null })}>
              <Icon name="file" size={14} /> Tabela de paredes
              <span className="meta">{Object.values(p.elements).filter(isWall).length}</span>
            </button>
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'floorSchedule', dialogArg: null })}>
              <Icon name="file" size={14} /> Tabela de pisos
              <span className="meta">{Object.values(p.elements).filter(isFloor).length}</span>
            </button>
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'slabSchedule', dialogArg: null })}>
              <Icon name="file" size={14} /> Tabela de lajes
              <span className="meta">{Object.values(p.elements).filter(isSlab).length}</span>
            </button>
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'roofSchedule', dialogArg: null })}>
              <Icon name="file" size={14} /> Tabela de telhados
              <span className="meta">{Object.values(p.elements).filter(isRoof).length}</span>
            </button>
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'stairSchedule', dialogArg: null })}>
              <Icon name="file" size={14} /> Tabela de escadas
              <span className="meta">{Object.values(p.elements).filter(isStair).length}</span>
            </button>
          </div>
        </details>
      </div>
    </aside>
  );
}
