import type { ReactElement } from 'react';
import { TOOL_GROUPS, TOOL_LABEL, TOOL_SHORTCUT, type ToolId } from '@hestia/tools';
import { editor } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';
import { MoveLevelButton } from './MoveLevel.tsx';

const GROUP_BY_TAB: Record<string, Array<{ title: string; tools: ToolId[] }>> = {
  arquitetura: [{ title: 'Construir', tools: ['wall', 'door', 'window', 'floor', 'slab', 'roof', 'slope'] }],
  modificar: [
    { title: 'Seleção', tools: ['select'] },
    { title: 'Modificar', tools: ['move', 'copy', 'rotate', 'mirror', 'array', 'offset', 'parallel', 'trim', 'align', 'joins', 'split', 'rehost'] },
    { title: 'Medir', tools: ['measure'] },
  ],
};

const SOON: Array<{ icon: string; label: string }> = [
  { icon: 'stairs', label: 'Escada' },
  { icon: 'room', label: 'Ambiente' },
];

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

export function Ribbon(): ReactElement {
  const tab = useUi((s) => s.ribbon);
  const s = useUi();
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
              </div>
              <div className="rgroup-title">Documentar</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
