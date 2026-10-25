import type { ReactElement } from 'react';
import { duplicateSheetCommand, addSheetAction } from '../editor/sheetActions.ts';
import { isCeiling, isFloor, isRoof, isSlab, isStair, isWall, openingFamilies, openingFamilyOf, projectSheets, type OpeningType } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { activateView } from '../editor/viewTabActions.ts';
import { Icon } from './Icon.tsx';
import { TypeRow } from './TypeRow.tsx';
import { ViewRow } from './ViewRow.tsx';

/** Agrupa os tipos de abertura por família (um nó por família, como no Revit); dentro do grupo, ordena pelo código. */
function openingGroups(kind: 'door' | 'window', types: OpeningType[]): Array<{ id: string; name: string; types: OpeningType[] }> {
  const byCode = (t: OpeningType): string => t.code ?? t.name;
  const groups: Array<{ id: string; name: string; types: OpeningType[] }> = [];
  for (const f of openingFamilies(kind)) {
    const items = types.filter((t) => openingFamilyOf(t)?.id === f.id);
    if (items.length) groups.push({ id: f.id, name: f.name, types: items });
  }
  const orphans = types.filter((t) => !openingFamilyOf(t));
  if (orphans.length) groups.push({ id: 'outros', name: 'Outros', types: orphans });
  for (const g of groups) g.types.sort((a, b) => byCode(a).localeCompare(byCode(b), 'pt-BR'));
  return groups;
}

/** Abre a prancha na aba de folha (decisão 0022). */
const openSheet = (id: string): void => activateView({ kind: 'sheet', sheetId: id });

/** Ações de uma prancha da lista: duplicar e excluir (cada uma é um passo de desfazer). */
function sheetRowAction(run: () => void, ok: string): void {
  try {
    run();
    useUi.setState({ status: ok });
  } catch (e) {
    useUi.setState({ status: e instanceof Error ? e.message : 'Operação recusada.' });
  }
}

/** Navegador de projeto: vistas, famílias (tipos) e materiais, como a árvore do Revit. */
export function Browser(): ReactElement {
  const p = useProject();
  const s = useUi();
  const walls = Object.values(p.wallTypes);
  const doors = Object.values(p.openingTypes).filter((t) => t.kind === 'door');
  const windows = Object.values(p.openingTypes).filter((t) => t.kind === 'window');
  const floorTypes = Object.values(p.floorTypes);
  const slabTypes = Object.values(p.slabTypes);
  const ceilingTypes = Object.values(p.ceilingTypes);
  const roofTypes = Object.values(p.roofTypes);
  const stairTypes = Object.values(p.stairTypes);
  const sections = p.views.filter((v) => v.kind === 'section');
  const elevations = p.views.filter((v) => v.kind === 'elevation');
  const sheets = projectSheets(p);
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
              <div className="levels">
                {p.levels.map((l) => (
                  <button key={l.id} className={`leaf${s.view === 'plan' && s.levelId === l.id ? ' on' : ''}`} onClick={() => activateView({ kind: 'plan', levelId: l.id })}>
                    <Icon name="plan" size={14} /> {l.name}
                    <span className="meta">{l.elevation.toFixed(2).replace('.', ',')} m</span>
                  </button>
                ))}
              </div>
            </details>
            <details open>
              <summary>3D</summary>
              <button className={`leaf${s.view === '3d' ? ' on' : ''}`} onClick={() => activateView({ kind: '3d' })}>
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
          <summary>Pranchas</summary>
          <div className="sub">
            {sheets.length === 0 ? <p className="tree-empty">Nenhuma prancha. Crie uma para montar a impressão.</p> : null}
            {sheets.map((sh) => (
              <div key={sh.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className={`leaf${s.view === 'sheet' && s.sheetId === sh.id ? ' on' : ''}`} style={{ flex: 1 }} onClick={() => openSheet(sh.id)}>
                  <Icon name="plan" size={14} /> {sh.number} {sh.name}
                  <span className="meta">{sh.size}</span>
                </button>
                <button className="chiplink" title="Propriedades da prancha" onClick={() => useUi.setState({ dialog: 'sheet', dialogArg: sh.id })}>Editar</button>
                <button className="chiplink" title="Duplicar prancha" onClick={() => sheetRowAction(() => { const c = duplicateSheetCommand(p, sh.id); if (c) editor.store.exec(c, 'Duplicar prancha'); }, 'Prancha duplicada.')}>Duplicar</button>
                <button className="chiplink" title="Excluir prancha" onClick={() => sheetRowAction(() => editor.store.exec({ type: 'removeSheet', id: sh.id }, 'Excluir prancha'), 'Prancha excluída.')}>Excluir</button>
              </div>
            ))}
            <button className="leaf" onClick={() => sheetRowAction(() => openSheet(addSheetAction(editor.store)), 'Prancha criada.')}>
              <Icon name="plus" size={14} /> Nova prancha
            </button>
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
              {openingGroups('door', doors).map((g) => (
                <details key={g.id}>
                  <summary>
                    {g.name}
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-faint)' }}>{g.types.length}</span>
                  </summary>
                  {g.types.map((t) => (
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
              ))}
            </details>
            <details>
              <summary>Janelas</summary>
              {openingGroups('window', windows).map((g) => (
                <details key={g.id}>
                  <summary>
                    {g.name}
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-faint)' }}>{g.types.length}</span>
                  </summary>
                  {g.types.map((t) => (
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
              <summary>Forros</summary>
              {ceilingTypes.map((t) => (
                <TypeRow
                  key={t.id}
                  kind="ceiling"
                  typeId={t.id}
                  name={t.name}
                  icon="ceiling"
                  active={s.options.ceilingTypeId === t.id}
                  onUse={() => useUi.setState((st) => ({ options: { ...st.options, ceilingTypeId: t.id } }))}
                  onEdit={() => useUi.setState({ dialog: 'ceilingType', dialogArg: t.id })}
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
            <button className="leaf" onClick={() => useUi.setState({ dialog: 'ceilingSchedule', dialogArg: null })}>
              <Icon name="file" size={14} /> Tabela de forros
              <span className="meta">{Object.values(p.elements).filter(isCeiling).length}</span>
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
