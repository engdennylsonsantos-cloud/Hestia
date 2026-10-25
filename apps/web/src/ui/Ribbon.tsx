import type { ReactElement } from 'react';
import { TOOL_GROUPS, type ToolId } from '@hestia/tools';
import { isRoom, isStair, view3dOf, type Id, type Project } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useAtalhos } from '../editor/shortcutConfig.ts';
import { editThinLines, editView3D, thinLinesOn } from '../editor/graphicsActions.ts';
import { toggleRoofProjection, useUi } from '../editor/state.ts';
import { useI18n, toolLabel, I18N } from '../editor/i18n.ts';
import { Icon } from './Icon.tsx';
import { MoveLevelButton } from './MoveLevel.tsx';

/** Ações pontuais da faixa (não são ferramenta: rodam uma vez e mantêm a ferramenta atual). */
type ActionId = 'cotasAuto';

const ACTIONS: Record<ActionId, { labelKey: 'tool_cotasAuto'; icon: string; titlePt: string; titleEn: string; run: () => void }> = {
  cotasAuto: {
    labelKey: 'tool_cotasAuto',
    icon: 'cotasAuto',
    titlePt: 'Cotas automáticas do nível ativo: escolha o que cotar, por onde medir e em quais lados',
    titleEn: 'Automatic dimensions for active level',
    run: () => useUi.setState({ dialog: 'cotasAuto', dialogArg: null }),
  },
};

/** Ferramentas primárias de modelagem que recebem botão grande com destaque visual no padrão Revit */
const PRIMARY_TOOLS: Set<ToolId> = new Set(['wall', 'door', 'window', 'floor', 'ceiling', 'roof', 'stair', 'room', 'select']);

/** Botão pequeno, só ícone; o nome aparece no tooltip (title). */
function ToolButton({ id, primary = false, mini = false }: { id: ToolId; primary?: boolean; mini?: boolean }): ReactElement {
  const active = useUi((s) => s.tool === id);
  const lang = useI18n((s) => s.lang);
  const label = toolLabel(id, lang);
  const sc = useAtalhos((s) => s.mapa[id]);
  const isBig = primary || PRIMARY_TOOLS.has(id);

  if (mini) {
    return (
      <button
        className={`tbtn${active ? ' on' : ''}`}
        style={{ width: 22, height: 22, minWidth: 0, padding: 0, justifyContent: 'center' }}
        onClick={() => editor.setTool(id)}
        title={`${label}${sc ? ` (${sc})` : ''}`}
        aria-label={label}
      >
        <Icon name={id} size={20} />
      </button>
    );
  }

  return (
    <button
      className={`tbtn${isBig ? ' primary-tool' : ''}${active ? ' on' : ''}`}
      onClick={() => editor.setTool(id)}
      title={`${label}${sc ? ` (${sc})` : ''}`}
    >
      <Icon name={id} size={isBig ? 28 : 22} />
      <span>{label}</span>
      {sc ? <kbd>{sc}</kbd> : null}
    </button>
  );
}

/** Três espaços à direita do botão principal do grupo (Ambiente, Escada): o primeiro tem a ferramenta secundária; os outros ficam reservados. */
const MINI_SLOTS_STYLE = { display: 'flex', flexDirection: 'column', gap: 2 } as const;
const EMPTY_SLOT_STYLE = { width: 22, height: 22, boxSizing: 'border-box', border: '1px dashed currentColor', borderRadius: 'var(--r)', opacity: 0.35 } as const;

/** Mesmo visual do `ToolButton`, sem ferramenta nem atalho: executa a ação e mantém a ferramenta atual. */
function ActionButton({ id }: { id: ActionId }): ReactElement {
  const action = ACTIONS[id];
  const lang = useI18n((s) => s.lang);
  const label = I18N[lang][action.labelKey];
  return (
    <button className="tbtn" onClick={action.run} title={lang === 'pt' ? action.titlePt : action.titleEn}>
      <Icon name={action.icon} size={22} />
      <span>{label}</span>
    </button>
  );
}

function Toggle({ icon, label, on, onClick, title, disabled }: { icon: string; label: string; on: boolean; onClick: () => void; title?: string; disabled?: boolean }): ReactElement {
  return (
    <button className={`tbtn${on ? ' on' : ''}`} onClick={onClick} title={title ?? label} aria-pressed={on} disabled={disabled}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  );
}

/** Grupo "Escada" da aba Modificar: aparece com escada selecionada (editar croqui, tipo, tabela). */
function StairGroup({ stairs }: { stairs: Array<{ id: Id; typeId: Id }> }): ReactElement {
  const one = stairs.length === 1 ? stairs[0] : undefined;
  const lang = useI18n((s) => s.lang);
  return (
    <div className="rgroup">
      <div className="rgroup-tools">
        <button className="tbtn primary-tool" disabled={!one} onClick={() => editor.setTool('stair')} title={lang === 'pt' ? 'Editar o croqui da escada selecionada' : 'Edit stair sketch'}>
          <Icon name="stair" size={28} />
          <span>{lang === 'pt' ? 'Editar croqui' : 'Edit Sketch'}</span>
        </button>
        <button className="tbtn" onClick={() => useUi.setState({ dialog: 'stairType', dialogArg: stairs[0]!.typeId })} title={lang === 'pt' ? 'Abre o tipo da escada selecionada' : 'Stair types'}>
          <Icon name="type" size={22} />
          <span>{lang === 'pt' ? 'Tipos de escada' : 'Stair Types'}</span>
        </button>
        <button className="tbtn" onClick={() => useUi.setState({ dialog: 'stairSchedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de escadas' : 'Stair schedule'}>
          <Icon name="schedule" size={22} />
          <span>{lang === 'pt' ? 'Tabela de escadas' : 'Stair Schedule'}</span>
        </button>
      </div>
      <div className="rgroup-title">{I18N[lang].grp_stair}</div>
    </div>
  );
}

/** Escadas da seleção (para o grupo da aba Modificar). */
const stairsIn = (p: Project, ids: Id[]): Array<{ id: Id; typeId: Id }> =>
  ids.map((id) => p.elements[id]).filter(isStair).map((e) => ({ id: e.id, typeId: e.typeId }));

export function Ribbon(): ReactElement {
  const tab = useUi((s) => s.ribbon);
  const currentTool = useUi((s) => s.tool);
  const selection = useUi((s) => s.selection);
  const lang = useI18n((s) => s.lang);
  const t = I18N[lang];
  const s = useUi();
  const p = useProject();
  const selStairs = stairsIn(p, s.selection);
  // "Mesmo nome" só vale para ambientes: sem um ambiente na seleção, o botão fica desabilitado.
  const temAmbiente = s.selection.some((id) => isRoom(p.elements[id]));
  const v3 = view3dOf(p);
  const set = (p: Partial<typeof s>): void => useUi.setState(p);

  /** Alternadores da vista 3D gravam no projeto (um passo de desfazer cada). */
  const toggleView3D = (key: 'shadows' | 'edges' | 'openOpenings', label: string): void => {
    const patch = key === 'shadows' ? { shadows: !v3.shadows } : key === 'edges' ? { edges: !v3.edges } : { openOpenings: !(v3.openOpenings === true) };
    const r = editView3D(editor.store, patch, label);
    if (!r.ok) useUi.setState({ status: r.error ?? 'Não foi possível alterar a vista 3D.' });
  };

  /** Linhas finas da vista ativa */
  const thinAvailable = s.view === 'plan' || s.view === 'section';
  const thinTarget = s.view === 'section' ? 'section' : { levelId: s.levelId };
  const thin = thinAvailable && thinLinesOn(p, thinTarget);
  const toggleThin = (): void => {
    const r = editThinLines(editor.store, thinTarget, !thin);
    if (!r.ok) useUi.setState({ status: r.error ?? 'Não foi possível alterar as linhas finas.' });
  };

  // Determina se deve mostrar a aba contextual verde do Revit
  const hasActiveCreation = currentTool !== 'select';
  const hasSelection = selection.length > 0;
  const showContextualTab = hasActiveCreation || hasSelection;
  
  // Título contextual padrão Revit: "Modificar | Criar Parede" ou "Modify | Place Wall"
  const contextualTitle = hasActiveCreation
    ? (lang === 'pt' ? `Modificar | Inserir ${toolLabel(currentTool, lang)}` : `Modify | Place ${toolLabel(currentTool, lang)}`)
    : (lang === 'pt' ? `Modificar | Elementos (${selection.length})` : `Modify | Elements (${selection.length})`);

  const tabs: Array<[typeof tab, string]> = [
    ['arquitetura', t.ribbon_arch],
    ['modificar', t.ribbon_modify],
    ['vista', t.ribbon_view],
  ];
  void TOOL_GROUPS;

  const buildTools: ToolId[] = ['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'roofarrow', 'slope', 'roofextrusion'];
  const annotateTools: ToolId[] = ['dimension', 'text'];
  const modifyTools: ToolId[] = ['move', 'copy', 'rotate', 'mirror', 'array', 'offset', 'parallel', 'trim', 'align', 'joins', 'split', 'rehost'];

  return (
    <>
      <nav className="ribbon-tabs" aria-label="Abas da faixa de ferramentas">
        {tabs.map(([id, label]) => (
          <button key={id} className={`rtab${tab === id ? ' on' : ''}`} onClick={() => set({ ribbon: id })}>
            {label}
          </button>
        ))}
        {showContextualTab && (
          <button
            className={`rtab contextual${tab === 'modificar' ? ' on' : ''}`}
            onClick={() => set({ ribbon: 'modificar' })}
            title={lang === 'pt' ? 'Aba contextual de modificação / ferramenta ativa' : 'Contextual modify tab'}
          >
            {contextualTitle}
          </button>
        )}
      </nav>
      <div className="ribbon" role="toolbar" aria-label="Ferramentas">
        {tab === 'arquitetura' && (
          <>
            <div className="rgroup">
              <div className="rgroup-tools">
                <ToolButton id="select" primary />
              </div>
              <div className="rgroup-title">{t.grp_selection}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                {buildTools.map((id) => (
                  <ToolButton key={id} id={id} />
                ))}
              </div>
              <div className="rgroup-title">{t.grp_build}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <ToolButton id="stairrun" primary />
                <div style={MINI_SLOTS_STYLE}>
                  <ToolButton id="stair" mini />
                  <span style={EMPTY_SLOT_STYLE} aria-hidden="true" />
                  <span style={EMPTY_SLOT_STYLE} aria-hidden="true" />
                </div>
              </div>
              <div className="rgroup-title">{t.grp_stair}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <ToolButton id="room" primary />
                <div style={MINI_SLOTS_STYLE}>
                  <ToolButton id="roomsep" mini />
                  <span style={EMPTY_SLOT_STYLE} aria-hidden="true" />
                  <span style={EMPTY_SLOT_STYLE} aria-hidden="true" />
                </div>
              </div>
              <div className="rgroup-title">{t.grp_rooms}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                {annotateTools.map((id) => (
                  <ToolButton key={id} id={id} />
                ))}
                <ActionButton id="cotasAuto" />
              </div>
              <div className="rgroup-title">{t.grp_annotate}</div>
            </div>
          </>
        )}

        {tab === 'modificar' && (
          <>
            <div className="rgroup">
              <div className="rgroup-tools">
                <ToolButton id="select" primary />
              </div>
              <div className="rgroup-title">{t.grp_selection}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                {modifyTools.map((id) => (
                  <ToolButton key={id} id={id} />
                ))}
              </div>
              <div className="rgroup-title">{t.grp_modify}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <ToolButton id="attachroof" />
                <ToolButton id="detachroof" />
              </div>
              <div className="rgroup-title">{t.grp_attach}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <ToolButton id="measure" primary />
              </div>
              <div className="rgroup-title">{t.grp_measure}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <button className="tbtn" disabled={selection.length === 0} onClick={() => editor.selectAllOfSelectedType()} title={selection.length === 0 ? (lang === 'pt' ? 'Selecione um elemento para usar o mesmo tipo' : 'Select an element first') : lang === 'pt' ? 'Selecionar todas as instâncias do tipo' : 'Select all instances of type'}>
                  <Icon name="sametype" size={22} />
                  <span>{lang === 'pt' ? 'Mesmo tipo' : 'Same Type'}</span>
                </button>
                <button className="tbtn" disabled={!temAmbiente} onClick={() => editor.selectAllOfSelectedName()} title={temAmbiente ? (lang === 'pt' ? 'Seleciona todos os ambientes do nível com o mesmo nome (hoje só ambientes)' : 'Select all rooms with same name') : lang === 'pt' ? 'Selecione um ambiente primeiro; depois seleciona os ambientes com o mesmo nome' : 'Select a room first'}>
                  <Icon name="samename" size={22} />
                  <span>{lang === 'pt' ? 'Mesmo nome' : 'Same Name'}</span>
                </button>
              </div>
              <div className="rgroup-title">{lang === 'pt' ? 'Tipo' : 'Type'}</div>
            </div>

            {selStairs.length > 0 && <StairGroup stairs={selStairs} />}

            <div className="rgroup">
              <div className="rgroup-tools">
                <MoveLevelButton />
              </div>
              <div className="rgroup-title">{lang === 'pt' ? 'Nível' : 'Level'}</div>
            </div>
          </>
        )}

        {tab === 'vista' && (
          <>
            <div className="rgroup">
              <div className="rgroup-tools">
                <button className="tbtn primary-tool" onClick={() => (s.view === '3d' ? useUi.setState({ previewTick: s.previewTick + 1 }) : editor.zoomExtents())} title={lang === 'pt' ? 'Enquadrar tudo' : 'Zoom to fit'}>
                  <Icon name="fit" size={28} />
                  <span>{lang === 'pt' ? 'Enquadrar' : 'Fit to View'}</span>
                </button>
              </div>
              <div className="rgroup-title">{lang === 'pt' ? 'Navegar' : 'Navigate'}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <ToolButton id="section" primary />
              </div>
              <div className="rgroup-title">{t.sections}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <Toggle icon="grid" label={lang === 'pt' ? 'Grade' : 'Grid'} on={s.showGrid} onClick={() => set({ showGrid: !s.showGrid })} />
                <Toggle icon="layers" label={lang === 'pt' ? 'Subpavimento' : 'Underlay'} on={s.showUnderlay} onClick={() => set({ showUnderlay: !s.showUnderlay })} title={lang === 'pt' ? 'Mostrar pavimento abaixo apagado' : 'Show underlay'} />
                <Toggle icon="roof" label={lang === 'pt' ? 'Projeção cobertura' : 'Roof projection'} on={s.showRoofProjection} onClick={toggleRoofProjection} />
                <Toggle icon="plan" label={t.thin_lines} on={thin} disabled={!thinAvailable} onClick={toggleThin} title={t.thin_lines} />
              </div>
              <div className="rgroup-title">{lang === 'pt' ? 'Planta' : 'Plan'}</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <Toggle icon="sun" label={lang === 'pt' ? 'Sombras' : 'Shadows'} on={v3.shadows} onClick={() => toggleView3D('shadows', 'Alternar sombras')} />
                <Toggle icon="cube" label={lang === 'pt' ? 'Arestas' : 'Edges'} on={v3.edges} onClick={() => toggleView3D('edges', 'Alternar arestas')} />
                <Toggle icon="door" label={lang === 'pt' ? 'Abrir vãos' : 'Openings'} on={v3.openOpenings === true} onClick={() => toggleView3D('openOpenings', 'Alternar folhas')} />
              </div>
              <div className="rgroup-title">3D</div>
            </div>

            <div className="rgroup">
              <div className="rgroup-tools">
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'schedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de paredes' : 'Wall schedule'}>
                  <Icon name="schedule" size={22} />
                  <span>{lang === 'pt' ? 'Tabela paredes' : 'Wall Sched.'}</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'floorSchedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de pisos' : 'Floor schedule'}>
                  <Icon name="schedule" size={22} />
                  <span>{lang === 'pt' ? 'Tabela pisos' : 'Floor Sched.'}</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'slabSchedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de lajes' : 'Slab schedule'}>
                  <Icon name="schedule" size={22} />
                  <span>{lang === 'pt' ? 'Tabela lajes' : 'Slab Sched.'}</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'ceilingSchedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de forros' : 'Ceiling schedule'}>
                  <Icon name="schedule" size={22} />
                  <span>{lang === 'pt' ? 'Tabela forros' : 'Ceiling Sched.'}</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'roofSchedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de telhados' : 'Roof schedule'}>
                  <Icon name="schedule" size={22} />
                  <span>{lang === 'pt' ? 'Tabela telhados' : 'Roof Sched.'}</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'stairSchedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de escadas' : 'Stair schedule'}>
                  <Icon name="schedule" size={22} />
                  <span>{lang === 'pt' ? 'Tabela escadas' : 'Stair Sched.'}</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'roomSchedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de ambientes' : 'Room schedule'}>
                  <Icon name="schedule" size={22} />
                  <span>{lang === 'pt' ? 'Tabela ambientes' : 'Room Sched.'}</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'openingSchedule', dialogArg: null })} title={lang === 'pt' ? 'Tabela de aberturas' : 'Openings schedule'}>
                  <Icon name="schedule" size={22} />
                  <span>{lang === 'pt' ? 'Tabela vãos' : 'Openings Sched.'}</span>
                </button>
              </div>
              <div className="rgroup-title">{lang === 'pt' ? 'Tabelas' : 'Schedules'}</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
