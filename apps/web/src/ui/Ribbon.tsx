import type { ReactElement } from 'react';
import { TOOL_GROUPS, TOOL_LABEL, TOOL_SHORTCUT, type ToolId } from '@hestia/tools';
import { isStair, type Id, type Project } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { toggleRoofProjection, useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';
import { MoveLevelButton } from './MoveLevel.tsx';

const GROUP_BY_TAB: Record<string, Array<{ title: string; tools: ToolId[] }>> = {
  arquitetura: [{ title: 'Construir', tools: ['wall', 'door', 'window', 'floor', 'slab', 'roof', 'roofarrow', 'slope', 'stair', 'stairrun'] }],
  modificar: [
    { title: 'Seleção', tools: ['select'] },
    { title: 'Modificar', tools: ['move', 'copy', 'rotate', 'mirror', 'array', 'offset', 'parallel', 'trim', 'align', 'joins', 'split', 'rehost'] },
    { title: 'Anexar', tools: ['attachroof', 'detachroof'] },
    { title: 'Medir', tools: ['measure'] },
  ],
};

const SOON: Array<{ icon: string; label: string }> = [{ icon: 'room', label: 'Ambiente' }];

function ToolButton({ id }: { id: ToolId }): ReactElement {
  const active = useUi((s) => s.tool === id);
  const sc = TOOL_SHORTCUT[id];
  return (
    <button className={`tbtn${active ? ' on' : ''}`} onClick={() => editor.setTool(id)} title={`${TOOL_LABEL[id]}${sc ? ` (${sc})` : ''}`}>
      <Icon name={id} size={22} />
      <span>{TOOL_LABEL[id]}</span>
      {sc ? <kbd>{sc}</kbd> : null}
    </button>
  );
}

function Toggle({ icon, label, on, onClick, title }: { icon: string; label: string; on: boolean; onClick: () => void; title?: string }): ReactElement {
  return (
    <button className={`tbtn${on ? ' on' : ''}`} onClick={onClick} title={title ?? label} aria-pressed={on}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  );
}

/** Grupo "Escada" da aba Modificar: aparece com escada selecionada (editar croqui, tipo, tabela). */
function StairGroup({ stairs }: { stairs: Array<{ id: Id; typeId: Id }> }): ReactElement {
  const one = stairs.length === 1 ? stairs[0] : undefined;
  return (
    <div className="rgroup">
      <div className="rgroup-tools">
        <button className="tbtn" disabled={!one} onClick={() => editor.setTool('stair')} title="Editar o croqui da escada selecionada (só uma)">
          <Icon name="stair" size={22} />
          <span>Editar croqui</span>
        </button>
        <button className="tbtn" onClick={() => useUi.setState({ dialog: 'stairType', dialogArg: stairs[0]!.typeId })} title="Abre o tipo da escada selecionada">
          <Icon name="file" size={22} />
          <span>Tipos de escada</span>
        </button>
        <button className="tbtn" onClick={() => useUi.setState({ dialog: 'stairSchedule', dialogArg: null })} title="Tabela de escadas com quantitativos e exportação CSV">
          <Icon name="file" size={22} />
          <span>Tabela de escadas</span>
        </button>
      </div>
      <div className="rgroup-title">Escada</div>
    </div>
  );
}

/** Escadas da seleção (para o grupo da aba Modificar). */
const stairsIn = (p: Project, ids: Id[]): Array<{ id: Id; typeId: Id }> =>
  ids.map((id) => p.elements[id]).filter(isStair).map((e) => ({ id: e.id, typeId: e.typeId }));

export function Ribbon(): ReactElement {
  const tab = useUi((s) => s.ribbon);
  const s = useUi();
  const p = useProject();
  const selStairs = stairsIn(p, s.selection);
  const set = (p: Partial<typeof s>): void => useUi.setState(p);
  const tabs: Array<[typeof tab, string]> = [
    ['arquitetura', 'Arquitetura'],
    ['modificar', 'Modificar'],
    ['vista', 'Vista'],
  ];
  void TOOL_GROUPS;
  return (
    <>
      <nav className="ribbon-tabs" aria-label="Abas da faixa de ferramentas">
        {tabs.map(([id, label]) => (
          <button key={id} className={`rtab${tab === id ? ' on' : ''}`} onClick={() => set({ ribbon: id })}>
            {label}
          </button>
        ))}
      </nav>
      <div className="ribbon" role="toolbar" aria-label="Ferramentas">
        {tab !== 'vista' &&
          GROUP_BY_TAB[tab]!.map((g) => (
            <div className="rgroup" key={g.title}>
              <div className="rgroup-tools">
                {g.tools.map((t) => (
                  <ToolButton key={t} id={t} />
                ))}
              </div>
              <div className="rgroup-title">{g.title}</div>
            </div>
          ))}
        {tab === 'modificar' && (
          <div className="rgroup">
            <div className="rgroup-tools">
              <button className="tbtn" onClick={() => editor.selectAllOfSelectedType()} title="Selecionar todas as instâncias do tipo da seleção (mesmo nível)">
                <Icon name="sametype" size={22} />
                <span>Mesmo tipo</span>
              </button>
            </div>
            <div className="rgroup-title">Tipo</div>
          </div>
        )}
        {tab === 'modificar' && selStairs.length > 0 && <StairGroup stairs={selStairs} />}
        {tab === 'modificar' && (
          <div className="rgroup">
            <div className="rgroup-tools">
              <MoveLevelButton />
            </div>
            <div className="rgroup-title">Nível</div>
          </div>
        )}
        {tab === 'arquitetura' && (
          <div className="rgroup">
            <div className="rgroup-tools">
              {SOON.map((x) => (
                <button key={x.label} className="tbtn" disabled title={`${x.label}: planejado para as próximas fases`}>
                  <Icon name={x.icon} size={22} />
                  <span>{x.label}</span>
                </button>
              ))}
            </div>
            <div className="rgroup-title">Em breve</div>
          </div>
        )}
        {tab === 'vista' && (
          <>
            <div className="rgroup">
              <div className="rgroup-tools">
                <button className="tbtn" onClick={() => (s.view === '3d' ? useUi.setState({ previewTick: s.previewTick + 1 }) : editor.zoomExtents())} title="Enquadrar tudo">
                  <Icon name="fit" size={22} />
                  <span>Enquadrar</span>
                </button>
              </div>
              <div className="rgroup-title">Navegar</div>
            </div>
            <div className="rgroup">
              <div className="rgroup-tools">
                <ToolButton id="section" />
              </div>
              <div className="rgroup-title">Cortes</div>
            </div>
            <div className="rgroup">
              <div className="rgroup-tools">
                <Toggle icon="grid" label="Grade" on={s.showGrid} onClick={() => set({ showGrid: !s.showGrid })} />
                <Toggle icon="layers" label="Subpavimento" on={s.showUnderlay} onClick={() => set({ showUnderlay: !s.showUnderlay })} title="Mostrar o pavimento abaixo, apagado" />
                <Toggle icon="roof" label="Mostrar projeção da cobertura" on={s.showRoofProjection} onClick={toggleRoofProjection} title="Mostrar a projeção tracejada da cobertura acima do corte (decisão 0013)" />
              </div>
              <div className="rgroup-title">Planta</div>
            </div>
            <div className="rgroup">
              <div className="rgroup-tools">
                <Toggle icon="sun" label="Sombras" on={s.shadows} onClick={() => set({ shadows: !s.shadows })} />
                <Toggle icon="cube" label="Arestas" on={s.edges} onClick={() => set({ edges: !s.edges })} />
              </div>
              <div className="rgroup-title">3D</div>
            </div>
            <div className="rgroup">
              <div className="rgroup-tools">
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'schedule', dialogArg: null })} title="Tabela de paredes com quantitativos e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de paredes</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'floorSchedule', dialogArg: null })} title="Tabela de pisos com área, volume e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de pisos</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'slabSchedule', dialogArg: null })} title="Tabela de lajes com área, volume por camada e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de lajes</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'roofSchedule', dialogArg: null })} title="Tabela de telhados com áreas, cumeeira, beiral, volume e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de telhados</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'stairSchedule', dialogArg: null })} title="Tabela de escadas com espelhos, piso, área, volume e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de escadas</span>
                </button>
              </div>
              <div className="rgroup-title">Documentar</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
