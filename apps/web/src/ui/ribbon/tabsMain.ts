import { act, panel, soon, soonS, split, stack, t, tool, type RibbonTab } from './model.ts';
import { P_CLIPBOARD, P_CREATE, P_GEOMETRY, P_MEASURE, P_MODIFY, P_PROPS, P_SELECT, P_SELECTION_EXTRA, P_VIEW_MOD } from './panelsShared.ts';

/** Abas com ferramentas. Ordem e nomes dos painéis seguem o Revit 2024; o que ainda não existe é `soon` (esmaecido). */

export const TAB_ARQUITETURA: RibbonTab = {
  id: 'arquitetura',
  label: t('Arquitetura', 'Architecture'),
  panels: [
    P_SELECT,
    panel(
      'construir',
      t('Construir', 'Build'),
      tool('wall'),
      tool('door'),
      tool('window'),
      soon(t('Componente', 'Component'), 'component'),
      soon(t('Pilar', 'Column'), 'column'),
      split(tool('roof', 'large', { label: t('Telhado', 'Roof'), icon: 'roof' }), [
        tool('roof', 'small', { label: t('Telhado por perímetro', 'Roof by Footprint') }),
        tool('roofextrusion', 'small'),
        soon(t('Telhado por face', 'Roof by Face'), 'roof', 'small'),
      ]),
      tool('ceiling'),
      split(tool('floor', 'large', { label: t('Piso', 'Floor') }), [
        tool('floor', 'small', { label: t('Piso: Arquitetônico', 'Floor: Architectural') }),
        tool('slab', 'small', { label: t('Piso: Estrutural (Laje)', 'Floor: Structural (Slab)') }),
        soon(t('Piso por face', 'Floor by Face'), 'floor', 'small'),
      ]),
      stack(soonS(t('Sistema de fachada cortina', 'Curtain System'), 'curtain'), soonS(t('Grade de fachada cortina', 'Curtain Grid'), 'curtain'), soonS(t('Montante', 'Mullion'), 'curtain')),
    ),
    panel(
      'circulacao',
      t('Circulação', 'Circulation'),
      soon(t('Guarda-corpo', 'Railing'), 'railing'),
      soon(t('Rampa', 'Ramp'), 'ramp'),
      split(tool('stairrun', 'large', { label: t('Escada', 'Stair') }), [
        tool('stairrun', 'small', { label: t('Escada por lances', 'Stair by Run') }),
        tool('stair', 'small'),
      ]),
    ),
    panel('modelo', t('Modelo', 'Model'), stack(soonS(t('Texto do modelo', 'Model Text'), 'text'), soonS(t('Linha de modelo', 'Model Line'), 'detailLine'), soonS(t('Grupo de modelo', 'Model Group'), 'layers'))),
    panel(
      'ambiente',
      t('Ambiente e área', 'Room & Area'),
      tool('room'),
      stack(tool('roomsep', 'small'), soonS(t('Etiquetar ambiente', 'Tag Room'), 'tag')),
      soon(t('Área', 'Area'), 'room'),
      stack(soonS(t('Limite de área', 'Area Boundary'), 'roomsep'), soonS(t('Etiqueta de área', 'Tag Area'), 'tag')),
    ),
    panel('abertura', t('Abertura', 'Opening'), soon(t('Por face', 'By Face'), 'opening'), soon(t('Poço', 'Shaft'), 'opening'), soon(t('Parede', 'Wall'), 'opening'), soon(t('Vertical', 'Vertical'), 'opening'), soon(t('Água-furtada', 'Dormer'), 'opening')),
    panel('referencia', t('Referência', 'Datum'), act('levels', 'large', t('Nível', 'Level')), soon(t('Grade', 'Grid'), 'grid')),
    panel('plano-trabalho', t('Plano de trabalho', 'Work Plane'), soon(t('Definir', 'Set'), 'soon'), stack(soonS(t('Exibir', 'Show'), 'eye'), soonS(t('Plano de referência', 'Ref Plane'), 'soon'), soonS(t('Visualizador', 'Viewer'), 'soon'))),
  ],
};

export const TAB_ANOTAR: RibbonTab = {
  id: 'anotar',
  label: t('Anotar', 'Annotate'),
  panels: [
    panel(
      'cota',
      t('Cota', 'Dimension'),
      tool('dimension', 'large', { label: t('Alinhada', 'Aligned') }),
      act('cotasAuto'),
      stack(soonS(t('Cota de elevação', 'Spot Elevation'), 'dimension'), soonS(t('Coordenada de ponto', 'Spot Coordinate'), 'soon'), soonS(t('Inclinação de ponto', 'Spot Slope'), 'soon')),
    ),
    panel('detalhe', t('Detalhe', 'Detail'), soon(t('Linha de detalhe', 'Detail Line'), 'detailLine'), soon(t('Região', 'Region'), 'filledRegion'), soon(t('Componente de detalhe', 'Detail Component'), 'component'), soon(t('Nuvem de revisão', 'Revision Cloud'), 'soon')),
    panel('texto', t('Texto', 'Text'), tool('text'), stack(soonS(t('Verificar ortografia', 'Spelling'), 'soon'), soonS(t('Localizar/substituir', 'Find/Replace'), 'search'))),
    panel('etiqueta', t('Etiqueta', 'Tag'), soon(t('Etiquetar por categoria', 'Tag by Category'), 'tag'), soon(t('Etiquetar todos', 'Tag All'), 'tag')),
    panel('simbolo', t('Símbolo', 'Symbol'), soon(t('Símbolo', 'Symbol'), 'soon'), stack(soonS(t('Seta norte', 'North Arrow'), 'soon'), soonS(t('Caminho da escada', 'Stair Path'), 'soon'))),
  ],
};

export const TAB_VISTA: RibbonTab = {
  id: 'vista',
  label: t('Vista', 'View'),
  panels: [
    panel(
      'graficos',
      t('Gráficos', 'Graphics'),
      soon(t('Modelos de vista', 'View Templates'), 'layers'),
      act('graphicsVisibility'),
      soon(t('Filtros', 'Filters'), 'soon'),
      stack(act('thinLines', 'small'), soonS(t('Mostrar linhas ocultas', 'Show Hidden Lines'), 'eye'), soonS(t('Remover linhas ocultas', 'Remove Hidden Lines'), 'hide')),
      stack(act('grid', 'small'), act('underlay', 'small'), act('roofProjection', 'small')),
    ),
    panel('apresentacao', t('Apresentação', 'Presentation'), soon(t('Renderizar', 'Render'), 'cube'), soon(t('Galeria de renderização', 'Render Gallery'), 'sheet')),
    panel(
      'criar-vistas',
      t('Criar', 'Create'),
      act('view3d'),
      tool('section'),
      soon(t('Chamada', 'Callout'), 'soon'),
      split(act('genElevations', 'large'), [act('genElevations', 'small', t('Gerar 4 elevações', 'Generate 4 Elevations')), soon(t('Elevação (quadro)', 'Elevation (Frame)'), 'soon', 'small')]),
      soon(t('Vistas de planta', 'Plan Views'), 'plan'),
      soon(t('Vista de desenho', 'Drafting View'), 'soon'),
      soon(t('Legendas', 'Legends'), 'soon'),
      split(act('schedWalls', 'large', t('Tabelas', 'Schedules')), [
        act('schedWalls', 'small'), act('schedFloors', 'small'), act('schedSlabs', 'small'), act('schedCeilings', 'small'),
        act('schedRoofs', 'small'), act('schedStairs', 'small'), act('schedRooms', 'small'), act('schedOpenings', 'small'),
      ]),
    ),
    panel('prancha', t('Composição de pranchas', 'Sheet Composition'), act('newSheet'), soon(t('Vista', 'View'), 'plan'), soon(t('Linhas de correspondência', 'Matchline'), 'soon'), soon(t('Revisões', 'Revisions'), 'soon')),
    panel(
      'janelas',
      t('Janelas', 'Windows'),
      soon(t('Alternar janelas', 'Switch Windows'), 'soon'),
      soon(t('Fechar ocultas', 'Close Hidden'), 'soon'),
      soon(t('Janelas em cascata', 'Cascade'), 'soon'),
      soon(t('Lado a lado', 'Tile'), 'soon'),
      split(act('browser', 'large', t('Interface do usuário', 'User Interface')), [act('properties', 'small'), act('browser', 'small'), act('shortcutsConfig', 'small'), act('shortcuts', 'small')]),
    ),
  ],
};

export const TAB_GERENCIAR: RibbonTab = {
  id: 'gerenciar',
  label: t('Gerenciar', 'Manage'),
  panels: [
    panel(
      'configuracoes',
      t('Configurações', 'Settings'),
      act('materials'),
      soon(t('Estilos de objeto', 'Object Styles'), 'soon'),
      stack(soonS(t('Informações do projeto', 'Project Information'), 'soon'), soonS(t('Parâmetros do projeto', 'Project Parameters'), 'soon'), soonS(t('Unidades do projeto', 'Project Units'), 'soon')),
      stack(soonS(t('Transferir padrões', 'Transfer Standards'), 'soon'), soonS(t('Limpar não usados', 'Purge Unused'), 'soon'), act('lineWeights', 'small')),
    ),
    panel('gerenciar-projeto', t('Gerenciar projeto', 'Manage Project'), soon(t('Gerenciar links', 'Manage Links'), 'link'), soon(t('Gerenciar imagens', 'Manage Images'), 'sheet'), soon(t('Vista inicial', 'Starting View'), 'eye')),
    panel('fases', t('Fases', 'Phasing'), soon(t('Fases', 'Phases'), 'soon')),
    panel('consulta', t('Consulta', 'Inquiry'), soon(t('Selecionar por ID', 'Select by ID'), 'soon')),
    panel('macros', t('Macros', 'Macros'), soon(t('Gerenciador de macros', 'Macro Manager'), 'soon')),
  ],
};

export const TAB_MODIFICAR: RibbonTab = {
  id: 'modificar',
  label: t('Modificar', 'Modify'),
  panels: [P_SELECT, P_PROPS, P_CLIPBOARD, P_GEOMETRY, P_MODIFY, P_VIEW_MOD, P_MEASURE, P_CREATE, P_SELECTION_EXTRA],
};
