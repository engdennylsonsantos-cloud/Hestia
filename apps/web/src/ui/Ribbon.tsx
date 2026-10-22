import type { ReactElement } from 'react';
import { TOOL_GROUPS, TOOL_LABEL, TOOL_SHORTCUT, type ToolId } from '@hestia/tools';
import { isStair, view3dOf, type Id, type Project } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { editThinLines, editView3D, thinLinesOn } from '../editor/graphicsActions.ts';
import { toggleRoofProjection, useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';
import { MoveLevelButton } from './MoveLevel.tsx';

const GROUP_BY_TAB: Record<string, Array<{ title: string; tools: ToolId[] }>> = {
  arquitetura: [
    { title: 'Construir', tools: ['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'roofarrow', 'slope', 'stair', 'stairrun'] },
    { title: 'Anotar', tools: ['dimension', 'text'] },
    { title: 'Ambientes', tools: ['room'] },
  ],
  modificar: [
    { title: 'Seleção', tools: ['select'] },
    { title: 'Modificar', tools: ['move', 'copy', 'rotate', 'mirror', 'array', 'offset', 'parallel', 'trim', 'align', 'joins', 'split', 'rehost'] },
    { title: 'Anexar', tools: ['attachroof', 'detachroof'] },
    { title: 'Medir', tools: ['measure'] },
  ],
};

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
  const v3 = view3dOf(p);
  const set = (p: Partial<typeof s>): void => useUi.setState(p);
  /** Alternadores da vista 3D gravam no projeto (um passo de desfazer cada). Recusa do comando: a mensagem vai para a barra de estado. */
  const toggleView3D = (key: 'shadows' | 'edges' | 'openOpenings', label: string): void => {
    const patch = key === 'shadows' ? { shadows: !v3.shadows } : key === 'edges' ? { edges: !v3.edges } : { openOpenings: !(v3.openOpenings === true) };
    const r = editView3D(editor.store, patch, label);
    if (!r.ok) useUi.setState({ status: r.error ?? 'Não foi possível alterar a vista 3D.' });
  };
  /** Linhas finas da vista ativa (planta do nível ou corte aberto); no 3D e na prancha o botão fica desabilitado. */
  const thinAvailable = s.view === 'plan' || s.view === 'section';
  const thinTarget = s.view === 'section' ? 'section' : { levelId: s.levelId };
  const thin = thinAvailable && thinLinesOn(p, thinTarget);
  const toggleThin = (): void => {
    const r = editThinLines(editor.store, thinTarget, !thin);
    if (!r.ok) useUi.setState({ status: r.error ?? 'Não foi possível alterar as linhas finas.' });
  };
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
              <button className="tbtn" onClick={() => editor.selectAllOfSelectedName()} title="Selecionar todos os ambientes com o mesmo nome dos selecionados (mesmo nível)">
                <Icon name="sametype" size={22} />
                <span>Mesmo nome</span>
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
                <Toggle icon="plan" label="Linhas finas" on={thin} disabled={!thinAvailable} onClick={toggleThin} title={thinAvailable ? 'Desenha os traços da vista ativa com 1 px, só na tela (gravado no projeto, desfazível); a plotagem mantém os pesos reais' : 'Disponível na planta e no corte'} />
              </div>
              <div className="rgroup-title">Planta</div>
            </div>
            <div className="rgroup">
              <div className="rgroup-tools">
                <Toggle icon="sun" label="Sombras" on={v3.shadows} onClick={() => toggleView3D('shadows', 'Alternar sombras do 3D')} title="Sombras projetadas no 3D (gravado no projeto, desfazível)" />
                <Toggle icon="cube" label="Arestas" on={v3.edges} onClick={() => toggleView3D('edges', 'Alternar arestas do 3D')} title="Arestas e silhuetas no 3D (gravado no projeto, desfazível)" />
                <Toggle icon="door" label="Abrir vãos" on={v3.openOpenings === true} onClick={() => toggleView3D('openOpenings', 'Alternar folhas abertas no 3D')} title="Abre as folhas no 3D: porta de giro a 90° e janela de correr/giro entreaberta (gravado no projeto, desfazível)" />
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
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'ceilingSchedule', dialogArg: null })} title="Tabela de forros com área, volume por camada e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de forros</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'roofSchedule', dialogArg: null })} title="Tabela de telhados com áreas, cumeeira, beiral, volume e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de telhados</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'stairSchedule', dialogArg: null })} title="Tabela de escadas com espelhos, piso, área, volume e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de escadas</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'roomSchedule', dialogArg: null })} title="Tabela de ambientes com número, área, perímetro, pé-direito, volume, acabamentos e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de ambientes</span>
                </button>
                <button className="tbtn" onClick={() => useUi.setState({ dialog: 'openingSchedule', dialogArg: null })} title="Tabela de portas e janelas com código do tipo, dimensões, folhas, quantidade e exportação CSV">
                  <Icon name="file" size={22} />
                  <span>Tabela de portas e janelas</span>
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
